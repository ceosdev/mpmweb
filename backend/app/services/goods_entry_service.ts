import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import GoodsEntry, { type GoodsEntryStatus } from '#models/goods_entry'
import GoodsEntryItem from '#models/goods_entry_item'
import Product from '#models/product'
import PaymentType from '#models/payment_type'
import Payable from '#models/payable'
import PayableSettlement from '#models/payable_settlement'
import type { TenantContext } from '#services/tenant_context'
import goodsEntryRepository from '#repositories/goods_entry_repository'
import supplierRepository from '#repositories/supplier_repository'
import documentTypeRepository from '#repositories/document_type_repository'
import paymentTypeRepository from '#repositories/payment_type_repository'
import productRepository from '#repositories/product_repository'
import payableService from '#services/payable_service'
import payableSettlementService from '#services/payable_settlement_service'
import goodsEntryStock, { resolveStockEffect } from '#services/goods_entry_stock'
import { splitInstallments, installmentDueDates } from '#utils/installments'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { todayIso } from '#utils/dates'
import { QTY_SCALE, fromScaled, lineGrossCents, toScaled } from '#utils/decimal'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). Nunca editável, só pesquisável. */
  id?: number
  documentNumber?: string
  supplierId?: number
  operationFrom?: string
  operationTo?: string
  issueFrom?: string
  issueTo?: string
  /** Múltipla escolha. Vazio/ausente = **todos**. */
  statuses?: GoodsEntryStatus[]
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * Total dos produtos (Σ de `round(quantity * unit_price, 2) - discount`), em
 * reais, como subquery correlacionada. `round(numeric, 2)` do PostgreSQL arredonda
 * meio **para longe do zero** — para valores positivos é o half-up de
 * `lineGrossCents`, então SQL e BigInt concordam.
 */
const ITEMS_TOTAL_SQL = `(select coalesce(sum(round(goods_entry_items.quantity * goods_entry_items.unit_price, 2) - goods_entry_items.discount), 0)
                            from goods_entry_items
                           where goods_entry_items.goods_entry_id = goods_entries.id)`

/**
 * Valor da nota (`netAmount`) — **a mesma fórmula** que `netAmountCents` serializa:
 * `Σ(round(q × p, 2) − desconto do item) − desconto da NF-e + ST + IPI + frete +
 * seguro + outras`. Se divergir, a listagem mostra um valor e ordena por outro.
 */
const NET_AMOUNT_SQL = `(${ITEMS_TOTAL_SQL} - goods_entries.discount + goods_entries.icms_st + goods_entries.ipi
                          + goods_entries.freight + goods_entries.insurance + goods_entries.other_expenses)`

/**
 * Ordenações que **não são coluna** desta tabela: fornecedor e tipo de documento
 * vivem atrás de uma FK, `net_amount` é calculado dos filhos e `status` precisa
 * da ordem do ciclo de vida, não da alfabética do slug em inglês.
 *
 * Subquery correlacionada em vez de `join`: o `paginate` do Lucid conta linhas, e
 * manter uma única fonte no `from` evita qualquer surpresa na contagem.
 */
const SORT_EXPRESSIONS: Record<string, string> = {
  supplier: '(select name from suppliers where suppliers.id = goods_entries.supplier_id)',
  document_type:
    '(select description from document_types where document_types.id = goods_entries.document_type_id)',
  net_amount: NET_AMOUNT_SQL,
  // Ordem do ciclo de vida (Aberta → Finalizada → Cancelada).
  status: `(case goods_entries.status
              when 'open' then 1
              when 'finalized' then 2
              when 'cancelled' then 3
              else 4
            end)`,
}

const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  document_number: 'document_number',
  issue_date: 'issue_date',
  operation_date: 'operation_date',
}

export interface GoodsEntryItemDTO {
  productId: number
  /** Decimal string, up to 4 places. Never a `number`. */
  quantity: string
  /** Decimal string, up to 10 places. */
  unitPrice: string
  discount?: number
}

export interface CreateGoodsEntryDTO {
  documentTypeId: number
  documentNumber: string
  series?: string
  subSeries?: string
  /** VineJS parses `YYYY-MM-DD` into a `Date`; the model wants a luxon DateTime. */
  issueDate: Date
  supplierId: number
  discount?: number
  icmsSt?: number
  ipi?: number
  freight?: number
  insurance?: number
  otherExpenses?: number
  paymentTypeId: number
  installmentCount: number
  firstDueDate: Date
  items: GoodsEntryItemDTO[]
}

export type UpdateGoodsEntryDTO = CreateGoodsEntryDTO

/** Teto de unidades por item de produto ativo — cada unidade vira um ativo. */
const QTY_UNIT = 10n ** BigInt(QTY_SCALE)
const MAX_ASSET_QUANTITY_SCALED = 999n * QTY_UNIT

export class GoodsEntryService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20
    const direction: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc'

    const query = goodsEntryRepository
      .query(tenant.company.id)
      .preload('supplier')
      .preload('documentType')
      .preload('paymentType')
      // Σ dos filhos como coluna computada. Subquery e não join+group by: o
      // paginate do Lucid conta linhas, e um join com N itens multiplicaria o
      // total da paginação.
      .select('goods_entries.*')
      .select(db.raw(`${ITEMS_TOTAL_SQL} as items_total`))

    const sortExpression = params.sort && SORT_EXPRESSIONS[params.sort]
    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    if (sortExpression) {
      // `direction` já veio normalizada para 'asc' | 'desc' acima — nada do
      // cliente entra crua na expressão. `id` desempata, para a paginação ser estável.
      query
        .orderByRaw(`${sortExpression} ${direction === 'desc' ? 'desc' : 'asc'}`)
        .orderBy('id', 'desc')
    } else if (sortColumn) {
      query.orderBy(sortColumn, direction)
    } else {
      query.orderBy('operation_date', 'desc').orderBy('id', 'desc')
    }

    if (params.id) query.where('id', params.id)

    if (params.documentNumber) {
      const term = `%${params.documentNumber.toLowerCase()}%`
      query.whereRaw('lower(document_number) like ?', [term])
    }
    if (params.supplierId) query.where('supplier_id', params.supplierId)
    if (params.operationFrom) query.where('operation_date', '>=', params.operationFrom)
    if (params.operationTo) query.where('operation_date', '<=', params.operationTo)
    if (params.issueFrom) query.where('issue_date', '>=', params.issueFrom)
    if (params.issueTo) query.where('issue_date', '<=', params.issueTo)
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
    await row.load('supplier')
    await row.load('documentType')
    await row.load('paymentType')
    const items = await this.loadItems(tenant, row.id)
    return this.serialize(row, items)
  }

  async create(tenant: TenantContext, dto: CreateGoodsEntryDTO) {
    return db.transaction(async (trx) => {
      const products = await this.assertRelations(tenant, dto)

      const issueDate = DateTime.fromJSDate(dto.issueDate)
      const firstDueDate = DateTime.fromJSDate(dto.firstDueDate)
      this.assertConsistent(dto, products, issueDate, firstDueDate)

      const row = new GoodsEntry()
      row.merge({
        companyId: tenant.company.id,
        ...this.headerValues(dto),
        issueDate,
        firstDueDate,
        // Data do lançamento no sistema — do backend, no fuso da aplicação.
        operationDate: DateTime.fromISO(todayIso()),
        status: 'open',
        finalizedAt: null,
      })
      row.useTransaction(trx)
      await row.save()

      await this.replaceItems(tenant, row.id, dto.items, trx)

      return row.id
    }).then((id) => this.show(tenant, id))
  }

  async update(tenant: TenantContext, id: number, dto: UpdateGoodsEntryDTO) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      if (row.status !== 'open') {
        throw new BusinessException(
          'Não é possível editar uma entrada finalizada ou cancelada.'
        )
      }

      // Vínculos já gravados na entrada podem continuar inativos — só uma
      // *troca* para um id inativo diferente é rejeitada.
      const previousProductIds = await this.loadProductIds(tenant, row.id, trx)
      const products = await this.assertRelations(tenant, dto, {
        documentTypeId: row.documentTypeId,
        supplierId: row.supplierId,
        paymentTypeId: row.paymentTypeId,
        productIds: previousProductIds,
      })

      const issueDate = DateTime.fromJSDate(dto.issueDate)
      const firstDueDate = DateTime.fromJSDate(dto.firstDueDate)
      this.assertConsistent(dto, products, issueDate, firstDueDate)

      row.merge({ ...this.headerValues(dto), issueDate, firstDueDate })
      row.useTransaction(trx)
      await row.save()

      // Substituição em bloco: apaga todos e reinsere. Evita ter que diferenciar
      // item novo/alterado/removido no cliente.
      await this.replaceItems(tenant, row.id, dto.items, trx)
    })

    return this.show(tenant, id)
  }

  async destroy(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      if (row.status !== 'open') {
        throw new BusinessException(
          'Não é possível excluir uma entrada finalizada ou cancelada.'
        )
      }

      await GoodsEntryItem.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('goods_entry_id', id)
        .delete()

      try {
        row.useTransaction(trx)
        await row.delete()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException(
            'Não é possível excluir esta entrada porque ela já gerou títulos a pagar ou ativos.'
          )
        }
        throw error
      }
    })
  }

  // ------------------------------------------------------------ finalizar

  /**
   * What finalizing would do — the **same** calculation `finalize` runs, so the
   * split and the due-date arithmetic have a single owner (the backend).
   * Read-only: nothing is locked nor written. Effects come from the products'
   * **current** state.
   */
  async finalizePreview(tenant: TenantContext, id: number) {
    const entry = await this.findOrFail(tenant, id)
    const items = await this.loadItems(tenant, entry.id)
    this.assertFinalizable(entry, items)
    const itemsTotal = this.itemsTotalCents(items)
    const net = this.netAmountCents(entry, items)
    const count = entry.installmentCount

    const amounts = splitInstallments(Number(net), count)
    const dueDates = installmentDueDates(entry.firstDueDate, count)

    return {
      itemsTotal: Number(itemsTotal) / 100,
      discount: Number(this.cents(entry.discount)) / 100,
      additions: Number(this.additionsCents(entry)) / 100,
      netAmount: Number(net) / 100,
      installments: amounts.map((amount, index) => ({
        installment: index + 1,
        amount: amount / 100,
        dueDate: dueDates[index].toISODate(),
      })),
      effects: items.map((item) => {
        const effect = resolveStockEffect(item.product)
        const quantityScaled = toScaled(item.quantity, QTY_SCALE)
        return {
          productId: item.productId,
          description: item.product.description,
          effect,
          quantity: fromScaled(quantityScaled, QTY_SCALE),
          // Só a parte inteira: uma quantidade fracionada (produto que virou
          // ativo depois de salvo) é recusada pela finalização.
          assetsToCreate: effect === 'asset' ? Number(quantityScaled / QTY_UNIT) : 0,
        }
      }),
    }
  }

  /**
   * Finalizes the entry: product effects (stock, cost, assets), one payable
   * per installment with the given due dates, and `status = finalized`.
   *
   * One transaction with the entry locked; every validation runs before the
   * first write, and any failure rolls back everything — titles, balance,
   * cost, assets and status.
   */
  async finalize(tenant: TenantContext, id: number, dueDatesInput: Date[]) {
    await db.transaction(async (trx) => {
      // 1. trava a entrada
      const entry = await this.lock(tenant, id, trx)

      // 2. itens, conta e validações de valor
      const items = await this.loadItems(tenant, entry.id, trx)
      this.assertFinalizable(entry, items)
      const net = this.netAmountCents(entry, items)
      const count = entry.installmentCount

      // 3. vencimentos
      const dueDates = this.assertDueDates(entry, dueDatesInput)

      const paymentType = await PaymentType.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('id', entry.paymentTypeId)
        .first()
      if (!paymentType) throw new BusinessException('Tipo de pagamento inválido.')

      // 4–5. trava os produtos (id crescente), revalida ativos e aplica
      // estoque / custo / ativos; grava `stock_effect`.
      await goodsEntryStock.apply(tenant, entry, items, trx)

      // 6–7. títulos
      const amounts = splitInstallments(Number(net), count)
      // Rastro legível para o usuário; a FK é o rastro que o banco usa.
      const notes = `Título gerado a partir da entrada de mercadoria: ${entry.id} com o tipo de pagamento: ${paymentType.description}`

      for (let index = 0; index < count; index += 1) {
        const payable = await payableService.createFromSource(
          tenant,
          {
            supplierId: entry.supplierId,
            goodsEntryId: entry.id,
            documentNumber: entry.documentNumber,
            installment: index + 1,
            issueDate: entry.issueDate,
            dueDate: dueDates[index],
            amount: amounts[index] / 100,
            notes,
          },
          trx
        )

        // Baixa automática na data do vencimento da parcela (como na Entrada
        // de Serviço), não na data da finalização.
        if (paymentType.autoSettlement) {
          await payableSettlementService.settleFullInTransaction(
            tenant,
            payable,
            entry.paymentTypeId,
            dueDates[index],
            'Baixa automática (tipo de pagamento com baixa automática).',
            trx
          )
        }
      }

      // 8.
      entry.status = 'finalized'
      entry.finalizedAt = DateTime.now()
      entry.useTransaction(trx)
      await entry.save()
    })

    return this.show(tenant, id)
  }

  /**
   * Cancels the entry. A finalized one is undone first — every blocker is
   * checked before anything moves, then stock/assets are reversed (by the
   * recorded `stock_effect`) and the titles are cancelled with their
   * settlements deleted. An open entry just becomes `cancelled`. Terminal.
   */
  async cancel(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const entry = await this.lock(tenant, id, trx)
      if (entry.status === 'cancelled') {
        throw new BusinessException('Esta entrada já está cancelada.')
      }

      if (entry.status === 'finalized') {
        const items = await this.loadItems(tenant, entry.id, trx)

        await goodsEntryStock.assertReversible(tenant, entry, items, trx)
        await goodsEntryStock.reverse(tenant, entry, items, trx)

        // Ordem crescente de id: trava determinística contra um pagamento em
        // lote concorrente sobre títulos sobrepostos (mesma mecânica de
        // `ServiceEntryService.cancel`).
        const payables = await Payable.query({ client: trx })
          .where('company_id', tenant.company.id)
          .where('goods_entry_id', id)
          .whereNot('status', 'cancelled')
          .orderBy('id', 'asc')
          .forUpdate()

        for (const payable of payables) {
          await PayableSettlement.query({ client: trx })
            .where('company_id', tenant.company.id)
            .where('payable_id', payable.id)
            .delete()

          payable.paidAmount = 0
          payable.status = 'cancelled'
          payable.useTransaction(trx)
          await payable.save()
        }
      }

      entry.status = 'cancelled'
      entry.useTransaction(trx)
      await entry.save()
    })

    return this.show(tenant, id)
  }

  /**
   * One due date per installment, none before the issue date, none before the
   * previous installment's. Compared as ISO dates (date-only).
   */
  /** Pre-write checks shared by `finalizePreview` and `finalize`. */
  private assertFinalizable(entry: GoodsEntry, items: GoodsEntryItem[]) {
    if (entry.status !== 'open') {
      throw new BusinessException('Só é possível finalizar uma entrada aberta.')
    }
    if (items.length === 0) {
      throw new BusinessException('A entrada precisa ter ao menos um produto.')
    }
    const net = this.netAmountCents(entry, items)
    if (net <= 0n) {
      throw new BusinessException('O valor da nota é zero ou negativo. Revise os descontos.')
    }
    if (net < BigInt(entry.installmentCount)) {
      throw new BusinessException(
        `O valor da nota não permite dividir em ${entry.installmentCount} parcelas.`
      )
    }
  }

  private assertDueDates(entry: GoodsEntry, input: Date[]): DateTime[] {
    const count = entry.installmentCount
    if (input.length !== count) {
      throw new BusinessException(`Informe o vencimento de todas as ${count} parcelas.`)
    }

    const issue = entry.issueDate.toISODate()!
    const dueDates = input.map((date) => DateTime.fromJSDate(date))

    dueDates.forEach((dueDate, index) => {
      const iso = dueDate.toISODate()!
      if (iso < issue) {
        throw new BusinessException(
          `O vencimento da parcela ${index + 1} não pode ser anterior à emissão.`
        )
      }
      if (index > 0 && iso < dueDates[index - 1].toISODate()!) {
        throw new BusinessException(
          `O vencimento da parcela ${index + 1} não pode ser anterior ao da parcela ${index}.`
        )
      }
    })

    return dueDates
  }

  // ---------------------------------------------------------------- a conta

  /** Σ (round(quantity × unitPrice, 2) − desconto do item) de cada item, em centavos. */
  itemsTotalCents(items: GoodsEntryItem[]): bigint {
    return items.reduce(
      (sum, item) => sum + lineGrossCents(item.quantity, item.unitPrice) - this.cents(item.discount),
      0n
    )
  }

  /** ST + IPI + frete + seguro + outras despesas, em centavos. */
  additionsCents(entry: GoodsEntry): bigint {
    return (
      this.cents(entry.icmsSt) +
      this.cents(entry.ipi) +
      this.cents(entry.freight) +
      this.cents(entry.insurance) +
      this.cents(entry.otherExpenses)
    )
  }

  /**
   * Valor da nota, em centavos: `vNF = vProd − vDesc + vST + vIPI + vFrete +
   * vSeg + vOutro`. É o que vira contas a pagar.
   */
  netAmountCents(entry: GoodsEntry, items: GoodsEntryItem[]): bigint {
    return this.itemsTotalCents(items) - this.cents(entry.discount) + this.additionsCents(entry)
  }

  // ------------------------------------------------------------- internos

  /** With `trx`, reads inside the caller's transaction (finalize/cancel). */
  async loadItems(tenant: TenantContext, entryId: number, trx?: TransactionClientContract) {
    return GoodsEntryItem.query(trx ? { client: trx } : {})
      .where('company_id', tenant.company.id)
      .where('goods_entry_id', entryId)
      .preload('product', (query) => query.preload('unit'))
      .orderBy('id', 'asc')
  }

  /** Just the `productId`s currently persisted — used by `assertRelations` to
   * know which items already existed before an update (so their product may
   * stay inactive). Reads inside the caller's transaction so it sees the row
   * as locked, before `replaceItems` deletes it. */
  private async loadProductIds(
    tenant: TenantContext,
    entryId: number,
    trx: TransactionClientContract
  ): Promise<number[]> {
    const rows = await GoodsEntryItem.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('goods_entry_id', entryId)
    return rows.map((row) => row.productId)
  }

  async findOrFail(tenant: TenantContext, id: number) {
    const row = await goodsEntryRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Entrada de mercadoria não encontrada.')
    return row
  }

  /** Carrega com lock da linha — serializa escritas concorrentes. */
  async lock(tenant: TenantContext, id: number, trx: TransactionClientContract) {
    const row = await GoodsEntry.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('id', id)
      .forUpdate()
      .first()
    if (!row) throw new NotFoundException('Entrada de mercadoria não encontrada.')
    return row
  }

  private headerValues(dto: CreateGoodsEntryDTO) {
    return {
      documentTypeId: dto.documentTypeId,
      supplierId: dto.supplierId,
      paymentTypeId: dto.paymentTypeId,
      documentNumber: dto.documentNumber,
      series: dto.series || null,
      subSeries: dto.subSeries || null,
      discount: dto.discount ?? 0,
      icmsSt: dto.icmsSt ?? 0,
      ipi: dto.ipi ?? 0,
      freight: dto.freight ?? 0,
      insurance: dto.insurance ?? 0,
      otherExpenses: dto.otherExpenses ?? 0,
      installmentCount: dto.installmentCount,
    }
  }

  private async replaceItems(
    tenant: TenantContext,
    entryId: number,
    items: GoodsEntryItemDTO[],
    trx: TransactionClientContract
  ) {
    await GoodsEntryItem.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('goods_entry_id', entryId)
      .delete()

    await GoodsEntryItem.createMany(
      items.map((item) => ({
        companyId: tenant.company.id,
        goodsEntryId: entryId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
      })),
      { client: trx }
    )
  }

  /**
   * Validates existence, tenant and **active** status of every FK referenced
   * by the payload — `documentTypeId`, `supplierId`, `paymentTypeId` and each
   * `items[].productId` — and returns the products by id (the item rules need
   * their type and description).
   *
   * `current` carries the ids already gravados na entrada **antes** desta
   * escrita (`undefined` on create, where nothing is grandfathered — every
   * relation must be active). On update, a relation that is inactive but was
   * already the value stored on the row is let through; *switching* to a
   * different, inactive id is still rejected. Same neutral message whether the
   * problem is existence, tenant or inactivity — none of those leak.
   */
  private async assertRelations(
    tenant: TenantContext,
    dto: CreateGoodsEntryDTO,
    current?: {
      documentTypeId: number
      supplierId: number
      paymentTypeId: number
      productIds: number[]
    }
  ): Promise<Map<number, Product>> {
    const supplier = await supplierRepository.findById(tenant.company.id, dto.supplierId)
    if (!supplier) throw new BusinessException('Fornecedor inválido.')
    if (!supplier.isActive && supplier.id !== current?.supplierId) {
      throw new BusinessException('Fornecedor inválido.')
    }

    const documentType = await documentTypeRepository.findById(tenant.company.id, dto.documentTypeId)
    if (!documentType) throw new BusinessException('Tipo de documento inválido.')
    if (!documentType.isActive && documentType.id !== current?.documentTypeId) {
      throw new BusinessException('Tipo de documento inválido.')
    }

    const paymentType = await paymentTypeRepository.findById(tenant.company.id, dto.paymentTypeId)
    if (!paymentType) throw new BusinessException('Tipo de pagamento inválido.')
    if (!paymentType.isActive && paymentType.id !== current?.paymentTypeId) {
      throw new BusinessException('Tipo de pagamento inválido.')
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))]
    const products = await productRepository.query(tenant.company.id).whereIn('id', productIds)
    if (products.length !== productIds.length) {
      throw new BusinessException('Produto inválido.')
    }
    const allowedInactiveProductIds = new Set(current?.productIds ?? [])
    const hasInvalidProduct = products.some(
      (product) => !product.isActive && !allowedInactiveProductIds.has(product.id)
    )
    if (hasInvalidProduct) {
      throw new BusinessException('Produto inválido.')
    }

    return new Map(products.map((product) => [product.id, product]))
  }

  private assertConsistent(
    dto: CreateGoodsEntryDTO,
    products: Map<number, Product>,
    issueDate: DateTime,
    firstDueDate: DateTime
  ) {
    const seen = new Set<number>()
    let itemsTotal = 0n

    for (const item of dto.items) {
      const product = products.get(item.productId)!

      if (seen.has(item.productId)) {
        throw new BusinessException(
          `O produto ${product.description} aparece mais de uma vez na entrada.`
        )
      }
      seen.add(item.productId)

      const quantity = toScaled(item.quantity, QTY_SCALE)
      if (quantity <= 0n) {
        throw new BusinessException(
          `A quantidade do produto ${product.description} deve ser maior que zero.`
        )
      }

      // Cada unidade de produto ativo vira um registro de ativo: inteira e com
      // teto, para um erro de digitação não criar milhares de ativos.
      if (product.type === 'fixed_asset') {
        if (quantity % 10n ** BigInt(QTY_SCALE) !== 0n) {
          throw new BusinessException(
            `O produto ${product.description} é um ativo: a quantidade precisa ser inteira.`
          )
        }
        if (quantity > MAX_ASSET_QUANTITY_SCALED) {
          throw new BusinessException('A quantidade máxima para produto ativo é 999.')
        }
      }

      const gross = lineGrossCents(item.quantity, item.unitPrice)
      const discount = this.cents(item.discount ?? 0)
      if (discount > gross) {
        throw new BusinessException(
          `O desconto do produto ${product.description} não pode ser maior que o valor da linha.`
        )
      }
      itemsTotal += gross - discount
    }

    if (this.cents(dto.discount ?? 0) > itemsTotal) {
      throw new BusinessException('O desconto da nota não pode ser maior que o total dos produtos.')
    }

    if (firstDueDate.toISODate()! < issueDate.toISODate()!) {
      throw new BusinessException('O 1º vencimento não pode ser anterior à emissão.')
    }
  }

  /**
   * Money in cents, as `bigint` (it is combined with the BigInt line totals).
   * `decimal(12,2)` columns come back from the driver as strings, and
   * floating-point reais would make the installment split lose fractions of a
   * cent. Integer cents divide exactly.
   */
  private cents(value: number | string | null | undefined): bigint {
    return BigInt(Math.round(Number(value ?? 0) * 100))
  }

  serialize(row: GoodsEntry, items?: GoodsEntryItem[]) {
    // `items_total` vem da subquery no list (reais, 2 casas); no show, soma os
    // itens carregados pelo mesmo caminho BigInt que o finalize usará.
    const itemsTotalCents =
      items !== undefined
        ? this.itemsTotalCents(items)
        : toScaled((row.$extras as { items_total?: string }).items_total ?? '0', 2)

    const additionsCents = this.additionsCents(row)
    const netCents = itemsTotalCents - this.cents(row.discount) + additionsCents

    return {
      id: row.id,
      documentTypeId: row.documentTypeId,
      documentTypeName: row.documentType?.description ?? null,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name ?? null,
      paymentTypeId: row.paymentTypeId,
      paymentTypeName: row.paymentType?.description ?? null,
      documentNumber: row.documentNumber,
      series: row.series,
      subSeries: row.subSeries,
      issueDate: row.issueDate.toISODate(),
      operationDate: row.operationDate.toISODate(),
      discount: Number(row.discount),
      icmsSt: Number(row.icmsSt),
      ipi: Number(row.ipi),
      freight: Number(row.freight),
      insurance: Number(row.insurance),
      otherExpenses: Number(row.otherExpenses),
      installmentCount: row.installmentCount,
      firstDueDate: row.firstDueDate.toISODate(),
      status: row.status,
      finalizedAt: row.finalizedAt?.toISO() ?? null,
      itemsTotal: Number(itemsTotalCents) / 100,
      additions: Number(additionsCents) / 100,
      netAmount: Number(netCents) / 100,
      items: items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        productDescription: item.product?.description ?? null,
        productType: item.product?.type ?? null,
        unitOfMeasure: item.product?.unit?.description ?? null,
        // Strings: 4 and 10 places do not fit a `number`. Normalized to the
        // column scale in case the driver trims trailing zeros.
        quantity: fromScaled(toScaled(item.quantity, 4), 4),
        unitPrice: fromScaled(toScaled(item.unitPrice, 10), 10),
        discount: Number(item.discount),
        lineTotal:
          Number(lineGrossCents(item.quantity, item.unitPrice) - this.cents(item.discount)) / 100,
        stockEffect: item.stockEffect,
      })),
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new GoodsEntryService()
