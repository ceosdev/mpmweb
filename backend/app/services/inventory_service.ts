import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Inventory, { type InventoryStatus } from '#models/inventory'
import InventoryItem from '#models/inventory_item'
import InventoryProductGroup from '#models/inventory_product_group'
import ProductGroup from '#models/product_group'
import type User from '#models/user'
import type { TenantContext } from '#services/tenant_context'
import inventoryRepository from '#repositories/inventory_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { QTY_SCALE, fromScaled, toScaled } from '#utils/decimal'

export interface ListParams {
  openingFrom?: string
  openingTo?: string
  status?: InventoryStatus
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface OpenInventoryDTO {
  openingDate: Date
  /** Empty means "all groups". */
  productGroupIds: number[]
}

export interface ShowOptions {
  /** Shows the system balance and the difference (counting is blind otherwise). */
  reveal: boolean
}

/** Correlated subqueries — "Itens" and "Contados" of the listing. */
const ITEM_COUNT_SQL = `(select count(*) from inventory_items
                          where inventory_items.inventory_id = inventories.id)`
const COUNTED_COUNT_SQL = `(select count(*) from inventory_items
                             where inventory_items.inventory_id = inventories.id
                               and inventory_items.counted_quantity is not null)`

const SORT_EXPRESSIONS: Record<string, string> = {
  // Ordem do ciclo de vida (Aberto → Fechado).
  status: `(case inventories.status when 'open' then 1 when 'closed' then 2 else 3 end)`,
}

const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  opening_date: 'opening_date',
  closed_at: 'closed_at',
}

const OPEN_ALREADY_MESSAGE = 'Já existe um inventário em aberto.'

export class InventoryService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20
    const direction: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc'

    const query = this.headerQuery(tenant)

    const sortExpression = params.sort && SORT_EXPRESSIONS[params.sort]
    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    if (sortExpression) {
      query.orderByRaw(`${sortExpression} ${direction}`).orderBy('id', 'desc')
    } else if (sortColumn) {
      query.orderBy(sortColumn, direction).orderBy('id', 'desc')
    } else {
      query.orderBy('opening_date', 'desc').orderBy('id', 'desc')
    }

    if (params.openingFrom) query.where('opening_date', '>=', params.openingFrom)
    if (params.openingTo) query.where('opening_date', '<=', params.openingTo)
    if (params.status) query.where('status', params.status)

    const result = await query.paginate(page, perPage)
    const hasOpen = await inventoryRepository.hasOpen(tenant.company.id)
    return {
      data: result.all().map((row) => this.serialize(row)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
        hasOpen,
      },
    }
  }

  /**
   * Header plus items ordered by product description. The count is **blind**
   * unless `reveal` is set or the inventory is closed: the system balance and
   * the difference are then left out of the payload (absent, not `null`).
   */
  async show(tenant: TenantContext, id: number, options: ShowOptions) {
    const row = await this.findOrFail(tenant, id)
    const items = await InventoryItem.query()
      .join('products', 'products.id', 'inventory_items.product_id')
      .where('inventory_items.company_id', tenant.company.id)
      .where('inventory_items.inventory_id', row.id)
      .select('inventory_items.*')
      .preload('product', (query) => query.preload('unit'))
      .orderBy('products.description', 'asc')
      .orderBy('inventory_items.id', 'asc')

    const revealed = options.reveal || row.status === 'closed'
    const countedCount = items.filter((item) => item.countedQuantity !== null).length

    return {
      ...this.serialize(row, { itemCount: items.length, countedCount }),
      hasTools: items.some((item) => item.product.type === 'tool'),
      items: items.map((item) => this.serializeItem(item, revealed)),
    }
  }

  /**
   * Opens an inventory (spec, *A transação*): checks there is no open one,
   * inserts the header, the chosen groups and — in a single
   * `INSERT … SELECT` — the snapshot of every eligible product. No eligible
   * product → 422 and rollback.
   */
  async open(tenant: TenantContext, user: User, dto: OpenInventoryDTO) {
    const companyId = tenant.company.id

    let id: number
    try {
      id = await db.transaction(async (trx) => {
        if (await this.hasOpen(companyId, trx)) {
          throw new BusinessException(OPEN_ALREADY_MESSAGE)
        }
        await this.assertGroups(companyId, dto.productGroupIds, trx)

        const row = new Inventory()
        row.merge({
          companyId,
          openingDate: DateTime.fromJSDate(dto.openingDate),
          openedByUserId: user.id,
          status: 'open',
        })
        row.useTransaction(trx)
        await row.save()

        if (dto.productGroupIds.length > 0) {
          await InventoryProductGroup.createMany(
            dto.productGroupIds.map((productGroupId) => ({
              companyId,
              inventoryId: row.id,
              productGroupId,
            })),
            { client: trx }
          )
        }

        const inserted = await this.insertItems(companyId, row.id, dto.productGroupIds, trx)
        if (inserted === 0) {
          throw new BusinessException(
            'Nenhum produto ativo com controle de estoque nos grupos escolhidos.'
          )
        }
        return row.id
      })
    } catch (error) {
      // Race between two openings: the partial unique index is the guarantee.
      if (isOpenInventoryViolation(error)) throw new BusinessException(OPEN_ALREADY_MESSAGE)
      throw error
    }

    const created = await this.headerQuery(tenant).where('inventories.id', id).firstOrFail()
    return this.serialize(created)
  }

  async destroy(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      if (row.status !== 'open') {
        throw new BusinessException('Inventário já finalizado.')
      }

      await InventoryItem.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('inventory_id', id)
        .delete()
      await InventoryProductGroup.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('inventory_id', id)
        .delete()

      try {
        row.useTransaction(trx)
        await row.delete()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException(
            'Não é possível excluir este inventário porque ele possui vínculos.'
          )
        }
        throw error
      }
    })
  }

  // -------------------------------------------------------------- internals

  async findOrFail(tenant: TenantContext, id: number) {
    const row = await this.headerQuery(tenant).where('inventories.id', id).first()
    if (!row) throw new NotFoundException('Inventário não encontrado.')
    return row
  }

  /** Loads with a row lock — serializes concurrent writes. */
  async lock(tenant: TenantContext, id: number, trx: TransactionClientContract) {
    const row = await Inventory.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('id', id)
      .forUpdate()
      .first()
    if (!row) throw new NotFoundException('Inventário não encontrado.')
    return row
  }

  /** Header query with the counters and the relations `serialize` reads. */
  private headerQuery(tenant: TenantContext) {
    return inventoryRepository
      .query(tenant.company.id)
      .preload('openedBy')
      .preload('closedBy')
      .preload('groups', (query) => query.preload('productGroup'))
      .select('inventories.*')
      .select(db.raw(`${ITEM_COUNT_SQL} as item_count`))
      .select(db.raw(`${COUNTED_COUNT_SQL} as counted_count`))
  }

  private async hasOpen(companyId: number, trx: TransactionClientContract) {
    const row = await Inventory.query({ client: trx })
      .where('company_id', companyId)
      .where('status', 'open')
      .first()
    return row !== null
  }

  /** Every chosen group must be an **active** group of the company. */
  private async assertGroups(
    companyId: number,
    groupIds: number[],
    trx: TransactionClientContract
  ) {
    if (groupIds.length === 0) return
    const found = await ProductGroup.query({ client: trx })
      .where('company_id', companyId)
      .where('is_active', true)
      .whereIn('id', groupIds)
    if (found.length !== new Set(groupIds).size) {
      throw new BusinessException('Grupo de produto inválido.')
    }
  }

  /** One `INSERT … SELECT` with the balance snapshot. Returns the row count. */
  private async insertItems(
    companyId: number,
    inventoryId: number,
    groupIds: number[],
    trx: TransactionClientContract
  ): Promise<number> {
    const bindings: Array<number | number[]> = [inventoryId, companyId]
    let groupFilter = ''
    if (groupIds.length > 0) {
      groupFilter = 'and products.product_group_id = any(?::int[])'
      bindings.push(groupIds)
    }
    const result = await trx.rawQuery(
      `insert into inventory_items
         (company_id, inventory_id, product_id, stock_quantity, counted_quantity, created_at, updated_at)
       select products.company_id, ?, products.id, coalesce(products.quantity_in_stock, 0), null, now(), now()
         from products
        where products.company_id = ?
          and products.is_active = true
          and products.controls_stock = true
          ${groupFilter}`,
      bindings
    )
    return Number(result.rowCount ?? 0)
  }

  private serialize(
    row: Inventory,
    counts?: { itemCount: number; countedCount: number }
  ) {
    return {
      id: row.id,
      openingDate: row.openingDate.toISODate(),
      status: row.status,
      closedAt: row.closedAt?.toISO() ?? null,
      openedByName: row.openedBy?.name ?? null,
      closedByName: row.closedBy?.name ?? null,
      groups: (row.groups ?? [])
        .map((group) => ({
          id: group.productGroupId,
          description: group.productGroup?.description ?? '',
        }))
        .sort((a, b) => a.description.localeCompare(b.description, 'pt-BR')),
      itemCount: counts?.itemCount ?? Number(row.$extras.item_count ?? 0),
      countedCount: counts?.countedCount ?? Number(row.$extras.counted_count ?? 0),
    }
  }

  private serializeItem(item: InventoryItem, revealed: boolean) {
    const base = {
      id: item.id,
      productId: item.productId,
      productDescription: item.product.description,
      unitOfMeasure: item.product.unit?.description ?? null,
      productType: item.product.type,
      countedQuantity: item.countedQuantity,
    }

    if (!revealed) {
      return { ...base, state: item.countedQuantity === null ? 'uncounted' : 'counted' }
    }

    const stock = toScaled(item.stockQuantity, QTY_SCALE)
    if (item.countedQuantity === null) {
      return {
        ...base,
        stockQuantity: item.stockQuantity,
        difference: null,
        stockAtClose: item.stockAtClose,
        state: 'uncounted' as const,
      }
    }
    const difference = toScaled(item.countedQuantity, QTY_SCALE) - stock
    return {
      ...base,
      stockQuantity: item.stockQuantity,
      difference: fromScaled(difference, QTY_SCALE),
      stockAtClose: item.stockAtClose,
      state: difference === 0n ? ('match' as const) : ('divergent' as const),
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

function isOpenInventoryViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code, constraint } = error as { code?: string; constraint?: string }
  return code === '23505' && constraint === 'inventories_company_open_uq'
}

export default new InventoryService()
