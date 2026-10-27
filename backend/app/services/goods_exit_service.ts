import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import GoodsExit, {
  type GoodsExitConsumerType,
  type GoodsExitStatus,
  type GoodsExitType,
} from '#models/goods_exit'
import GoodsExitItem from '#models/goods_exit_item'
import Product from '#models/product'
import ProductAsset from '#models/product_asset'
import type { TenantContext } from '#services/tenant_context'
import goodsExitRepository from '#repositories/goods_exit_repository'
import employeeRepository from '#repositories/employee_repository'
import productAssetRepository from '#repositories/product_asset_repository'
import productRepository from '#repositories/product_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { todayIso } from '#utils/dates'
import { PRICE_SCALE, QTY_SCALE, fromScaled, lineGrossCents, toScaled } from '#utils/decimal'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  /** Nome do funcionário, descrição do ativo ou do produto do ativo. */
  consumer?: string
  exitType?: GoodsExitType
  operationFrom?: string
  operationTo?: string
  /** Múltipla escolha. Vazio/ausente = **todos**. */
  statuses?: GoodsExitStatus[]
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * Σ de `round(qtd × unit_cost, 2)` em reais (custo nulo conta como 0), como
 * subquery correlacionada. `round(numeric, 2)` do PostgreSQL arredonda meio
 * para longe do zero — para positivos é o half-up de `lineGrossCents`.
 */
const REQUESTED_VALUE_SQL = `(select coalesce(sum(round(goods_exit_items.requested_quantity * coalesce(goods_exit_items.unit_cost, 0), 2)), 0)
                                from goods_exit_items
                               where goods_exit_items.goods_exit_id = goods_exits.id)`

/** Igual ao anterior, com a quantidade consumida (`null` até finalizar → 0). */
const CONSUMED_VALUE_SQL = `(select coalesce(sum(round(coalesce(goods_exit_items.consumed_quantity, 0) * coalesce(goods_exit_items.unit_cost, 0), 2)), 0)
                               from goods_exit_items
                              where goods_exit_items.goods_exit_id = goods_exits.id)`

/** Nome exibido do consumidor — a mesma regra de `consumerName` em `serialize`. */
const CONSUMER_NAME_SQL = `coalesce(
  (select employees.name from employees where employees.id = goods_exits.employee_id),
  (select products.description || ' – ' || product_assets.description
     from product_assets join products on products.id = product_assets.product_id
    where product_assets.id = goods_exits.product_asset_id))`

const SORT_EXPRESSIONS: Record<string, string> = {
  consumer: `(${CONSUMER_NAME_SQL})`,
  requested_value: REQUESTED_VALUE_SQL,
  consumed_value: CONSUMED_VALUE_SQL,
  // Ordem do ciclo de vida (Aberta → Entregue → Finalizada → Devolvida).
  status: `(case goods_exits.status
              when 'open' then 1
              when 'delivered' then 2
              when 'finalized' then 3
              when 'returned' then 4
              else 5
            end)`,
}

const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  exit_type: 'exit_type',
  operation_date: 'operation_date',
}

export interface GoodsExitItemDTO {
  productId: number
  /** Decimal string, up to 4 places. Never a `number`. */
  requestedQuantity: string
}

export interface CreateGoodsExitDTO {
  exitType: GoodsExitType
  consumerType: GoodsExitConsumerType
  productAssetId?: number
  employeeId?: number
  notes?: string
  items: GoodsExitItemDTO[]
}

export type UpdateGoodsExitDTO = CreateGoodsExitDTO

export class GoodsExitService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20
    const direction: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc'

    const query = goodsExitRepository
      .query(tenant.company.id)
      .preload('employee')
      .preload('productAsset', (q) => q.preload('product'))
      .preload('requestedBy')
      .select('goods_exits.*')
      .select(db.raw(`${REQUESTED_VALUE_SQL} as requested_value`))
      .select(db.raw(`${CONSUMED_VALUE_SQL} as consumed_value`))

    const sortExpression = params.sort && SORT_EXPRESSIONS[params.sort]
    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    if (sortExpression) {
      query
        .orderByRaw(`${sortExpression} ${direction === 'desc' ? 'desc' : 'asc'}`)
        .orderBy('id', 'desc')
    } else if (sortColumn) {
      query.orderBy(sortColumn, direction)
    } else {
      query.orderBy('operation_date', 'desc').orderBy('id', 'desc')
    }

    if (params.id) query.where('id', params.id)

    if (params.consumer) {
      const term = `%${params.consumer.toLowerCase()}%`
      query.whereRaw(
        `(exists (select 1 from employees where employees.id = goods_exits.employee_id and lower(employees.name) like ?)
          or exists (select 1 from product_assets join products on products.id = product_assets.product_id
                      where product_assets.id = goods_exits.product_asset_id
                        and (lower(product_assets.description) like ? or lower(products.description) like ?)))`,
        [term, term, term]
      )
    }
    if (params.exitType) query.where('exit_type', params.exitType)
    if (params.operationFrom) query.where('operation_date', '>=', params.operationFrom)
    if (params.operationTo) query.where('operation_date', '<=', params.operationTo)
    if (params.statuses && params.statuses.length > 0) query.whereIn('status', params.statuses)

    const result = await query.paginate(page, perPage)
    return {
      data: result.all().map((row) => this.serialize(row)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
      },
    }
  }

  async show(tenant: TenantContext, id: number) {
    const row = await this.findOrFail(tenant, id)
    await row.load('employee')
    await row.load('productAsset', (q) => q.preload('product'))
    await row.load('requestedBy')
    const items = await this.loadItems(tenant, row.id)
    return this.serialize(row, items)
  }

  async create(tenant: TenantContext, dto: CreateGoodsExitDTO, userId: number) {
    const id = await db.transaction(async (trx) => {
      this.assertToolConsumer(dto)
      await this.assertConsumer(tenant, dto)
      const products = await this.assertItems(tenant, dto)

      const row = new GoodsExit()
      row.merge({
        companyId: tenant.company.id,
        exitType: dto.exitType,
        ...this.consumerValues(dto),
        notes: dto.notes || null,
        operationDate: DateTime.fromISO(todayIso()),
        requestedByUserId: userId,
        status: 'open',
      })
      row.useTransaction(trx)
      await row.save()

      await this.replaceItems(tenant, row.id, dto.items, products, trx)
      return row.id
    })

    return this.show(tenant, id)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateGoodsExitDTO) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      this.assertOpen(row)

      if (dto.exitType !== row.exitType) {
        throw new BusinessException('O tipo de saída não pode ser alterado.')
      }
      this.assertToolConsumer(dto)

      // Vínculos já gravados continuam válidos mesmo inativos/vendidos — só uma
      // *troca* para um inválido é rejeitada.
      const previousProductIds = await this.loadProductIds(tenant, row.id, trx)
      await this.assertConsumer(tenant, dto, {
        employeeId: row.employeeId,
        productAssetId: row.productAssetId,
      })
      const products = await this.assertItems(tenant, dto, previousProductIds)

      row.merge({ ...this.consumerValues(dto), notes: dto.notes || null })
      row.useTransaction(trx)
      await row.save()

      // Substituição em bloco: apaga todos e reinsere.
      await this.replaceItems(tenant, row.id, dto.items, products, trx)
    })

    return this.show(tenant, id)
  }

  async destroy(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      this.assertOpen(row)

      await GoodsExitItem.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('goods_exit_id', id)
        .delete()

      try {
        row.useTransaction(trx)
        await row.delete()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException('Não é possível excluir esta saída porque ela possui vínculos.')
        }
        throw error
      }
    })
  }

  // -------------------------------------------------------------- helpers

  /** With `trx`, reads inside the caller's transaction. */
  async loadItems(tenant: TenantContext, exitId: number, trx?: TransactionClientContract) {
    return GoodsExitItem.query(trx ? { client: trx } : {})
      .where('company_id', tenant.company.id)
      .where('goods_exit_id', exitId)
      .preload('product', (query) => query.preload('unit'))
      .orderBy('id', 'asc')
  }

  private async loadProductIds(
    tenant: TenantContext,
    exitId: number,
    trx: TransactionClientContract
  ): Promise<number[]> {
    const rows = await GoodsExitItem.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('goods_exit_id', exitId)
    return rows.map((row) => row.productId)
  }

  async findOrFail(tenant: TenantContext, id: number) {
    const row = await goodsExitRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Saída de mercadoria não encontrada.')
    return row
  }

  /** Carrega com lock da linha — serializa escritas concorrentes. */
  async lock(tenant: TenantContext, id: number, trx: TransactionClientContract) {
    const row = await GoodsExit.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('id', id)
      .forUpdate()
      .first()
    if (!row) throw new NotFoundException('Saída de mercadoria não encontrada.')
    return row
  }

  assertOpen(row: GoodsExit) {
    if (row.status !== 'open') {
      throw new BusinessException('Operação não permitida: a saída não está aberta.')
    }
  }

  /** Saída de ferramentas é sempre para funcionário (antes do check do banco). */
  private assertToolConsumer(dto: CreateGoodsExitDTO) {
    if (dto.exitType === 'tool' && dto.consumerType !== 'employee') {
      throw new BusinessException('A saída de ferramentas exige um funcionário como consumidor.')
    }
  }

  private consumerValues(dto: CreateGoodsExitDTO) {
    return dto.consumerType === 'employee'
      ? { consumerType: dto.consumerType, employeeId: dto.employeeId!, productAssetId: null }
      : { consumerType: dto.consumerType, employeeId: null, productAssetId: dto.productAssetId! }
  }

  /**
   * Consumidor do tenant: funcionário **ativo** ou ativo **não vendido**. Na
   * edição, o vínculo já gravado (`current`) passa mesmo inválido.
   */
  private async assertConsumer(
    tenant: TenantContext,
    dto: CreateGoodsExitDTO,
    current?: { employeeId: number | null; productAssetId: number | null }
  ) {
    if (dto.consumerType === 'employee') {
      if (!dto.employeeId) throw new BusinessException('Selecione o funcionário.')
      const employee = await employeeRepository.findById(tenant.company.id, dto.employeeId)
      if (!employee || (!employee.isActive && employee.id !== current?.employeeId)) {
        throw new BusinessException('Funcionário inválido.')
      }
      return
    }

    if (!dto.productAssetId) throw new BusinessException('Selecione o ativo.')
    const asset = await productAssetRepository
      .queryByCompany(tenant.company.id)
      .where('id', dto.productAssetId)
      .first()
    if (!asset || (asset.situation === 'sold' && asset.id !== current?.productAssetId)) {
      throw new BusinessException('Ativo inválido.')
    }
  }

  /**
   * Regras dos produtos (spec, *Salvar*): do tenant, sem repetição, quantidade
   * > 0, ativo (ou já na saída), controla estoque, do tipo da saída e — na de
   * ferramentas — com custo. Devolve os produtos por id.
   */
  private async assertItems(
    tenant: TenantContext,
    dto: CreateGoodsExitDTO,
    previousProductIds: number[] = []
  ): Promise<Map<number, Product>> {
    const productIds = [...new Set(dto.items.map((item) => item.productId))]
    const found = await productRepository.query(tenant.company.id).whereIn('id', productIds)
    if (found.length !== productIds.length) throw new BusinessException('Produto inválido.')
    const products = new Map(found.map((product) => [product.id, product]))
    const grandfathered = new Set(previousProductIds)
    const expectedType = dto.exitType === 'tool' ? 'tool' : 'consumable'

    const seen = new Set<number>()
    for (const item of dto.items) {
      const product = products.get(item.productId)!

      if (seen.has(item.productId)) {
        throw new BusinessException(
          `O produto ${product.description} aparece mais de uma vez na saída.`
        )
      }
      seen.add(item.productId)

      if (toScaled(item.requestedQuantity, QTY_SCALE) <= 0n) {
        throw new BusinessException(
          `A quantidade do produto ${product.description} deve ser maior que zero.`
        )
      }

      const usable =
        (product.isActive || grandfathered.has(product.id)) &&
        product.controlsStock &&
        product.type === expectedType
      if (!usable) {
        throw new BusinessException(
          `O produto ${product.description} não pode ser usado nesta saída.`
        )
      }

      if (dto.exitType === 'tool') {
        if (!product.costPrice || toScaled(product.costPrice, PRICE_SCALE) <= 0n) {
          throw new BusinessException(
            `Produto ${product.description} com preço de custo zerado ou inexistente.`
          )
        }
      }
    }

    return products
  }

  private async replaceItems(
    tenant: TenantContext,
    exitId: number,
    items: GoodsExitItemDTO[],
    products: Map<number, Product>,
    trx: TransactionClientContract
  ) {
    await GoodsExitItem.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('goods_exit_id', exitId)
      .delete()

    await GoodsExitItem.createMany(
      items.map((item) => ({
        companyId: tenant.company.id,
        goodsExitId: exitId,
        productId: item.productId,
        requestedQuantity: item.requestedQuantity,
        consumedQuantity: null,
        // Foto do custo atual do produto (null se não tem).
        unitCost: products.get(item.productId)!.costPrice,
      })),
      { client: trx }
    )
  }

  private itemCents(quantity: string | null, unitCost: string | null): bigint {
    return lineGrossCents(quantity ?? '0', unitCost ?? '0')
  }

  serialize(row: GoodsExit, items?: GoodsExitItem[]) {
    // No list os totais vêm das subqueries (reais, 2 casas); no show, soma os
    // itens pelo caminho BigInt.
    const extras = row.$extras as { requested_value?: string; consumed_value?: string }
    const requestedCents = items
      ? items.reduce((sum, i) => sum + this.itemCents(i.requestedQuantity, i.unitCost), 0n)
      : toScaled(extras.requested_value ?? '0', 2)
    const consumedCents = items
      ? items.reduce((sum, i) => sum + this.itemCents(i.consumedQuantity, i.unitCost), 0n)
      : toScaled(extras.consumed_value ?? '0', 2)

    const asset: ProductAsset | undefined = row.productAsset
    const consumerName =
      row.consumerType === 'employee'
        ? (row.employee?.name ?? null)
        : asset
          ? `${asset.product?.description ?? ''} – ${asset.description}`
          : null

    return {
      id: row.id,
      exitType: row.exitType,
      consumerType: row.consumerType,
      consumerLabel: row.consumerType === 'employee' ? 'Funcionário' : 'Ativo',
      employeeId: row.employeeId,
      productAssetId: row.productAssetId,
      consumerName,
      assetCode: asset?.assetCode ?? null,
      operationDate: row.operationDate.toISODate(),
      requestedByUserId: row.requestedByUserId,
      requestedByName: row.requestedBy?.name ?? null,
      notes: row.notes,
      status: row.status,
      finalizedAt: row.finalizedAt?.toISO() ?? null,
      deliveredAt: row.deliveredAt?.toISO() ?? null,
      returnedAt: row.returnedAt?.toISO() ?? null,
      requestedValue: Number(requestedCents) / 100,
      consumedValue: Number(consumedCents) / 100,
      items: items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        productDescription: item.product?.description ?? null,
        productType: item.product?.type ?? null,
        unitOfMeasure: item.product?.unit?.description ?? null,
        // Strings: 4 and 10 places do not fit a `number`.
        requestedQuantity: fromScaled(toScaled(item.requestedQuantity, QTY_SCALE), QTY_SCALE),
        consumedQuantity:
          item.consumedQuantity === null
            ? null
            : fromScaled(toScaled(item.consumedQuantity, QTY_SCALE), QTY_SCALE),
        unitCost:
          item.unitCost === null
            ? null
            : fromScaled(toScaled(item.unitCost, PRICE_SCALE), PRICE_SCALE),
        requestedValue: Number(this.itemCents(item.requestedQuantity, item.unitCost)) / 100,
        consumedValue: Number(this.itemCents(item.consumedQuantity, item.unitCost)) / 100,
      })),
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new GoodsExitService()
