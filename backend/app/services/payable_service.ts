import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Payable, { type PayableStatus } from '#models/payable'
import PayableSettlement from '#models/payable_settlement'
import type { TenantContext } from '#services/tenant_context'
import payableRepository from '#repositories/payable_repository'
import supplierRepository from '#repositories/supplier_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { todayIso } from '#utils/dates'

/** `overdue` is a **virtual** status: it is not stored, it is a date comparison. */
export type PayableStatusFilter = PayableStatus | 'overdue'

export interface ListParams {
  documentNumber?: string
  supplierId?: number
  dueFrom?: string
  dueTo?: string
  issueFrom?: string
  issueTo?: string
  /** Múltipla escolha. Vazio/ausente = **todos** (nenhum filtro de status). */
  statuses?: PayableStatusFilter[]
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * Columns the listing may sort by. `total` is **not a column** — it is the
 * expression the "Valor" column displays, so sorting by it must use the same
 * expression, otherwise the column would contradict its own ordering.
 */
const SORT_COLUMNS: Record<string, string> = {
  document_number: 'document_number',
  installment: 'installment',
  issue_date: 'issue_date',
  due_date: 'due_date',
  status: 'status',
}

const TOTAL_EXPRESSION = '(amount - discount + fine + interest)'

/** A payable is only overdue while something is still owed on it. */
const OWING_STATUSES: PayableStatus[] = ['open', 'partially_paid']

export interface CreatePayableDTO {
  documentNumber: string
  installment?: number
  supplierId: number
  /** VineJS parses `YYYY-MM-DD` into a `Date`; the model wants a luxon DateTime. */
  issueDate: Date
  dueDate: Date
  amount: number
  discount?: number
  fine?: number
  interest?: number
  notes?: string
}

export type UpdatePayableDTO = Partial<CreatePayableDTO>

export class PayableService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20
    const direction: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = payableRepository.query(tenant.company.id).preload('supplier')

    if (params.sort === 'total') {
      query.orderByRaw(`${TOTAL_EXPRESSION} ${direction === 'desc' ? 'desc' : 'asc'}`)
    } else {
      const sortColumn = params.sort && SORT_COLUMNS[params.sort]
      query.orderBy(sortColumn ?? 'due_date', sortColumn ? direction : 'asc')
    }

    if (params.documentNumber) {
      const term = `%${params.documentNumber.toLowerCase()}%`
      query.whereRaw('lower(document_number) like ?', [term])
    }

    if (params.supplierId) {
      query.where('supplier_id', params.supplierId)
    }

    if (params.dueFrom) query.where('due_date', '>=', params.dueFrom)
    if (params.dueTo) query.where('due_date', '<=', params.dueTo)
    if (params.issueFrom) query.where('issue_date', '>=', params.issueFrom)
    if (params.issueTo) query.where('issue_date', '<=', params.issueTo)

    this.applyStatusFilter(query, params.statuses)

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
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreatePayableDTO) {
    await this.assertSupplierBelongsToTenant(tenant, dto.supplierId)

    const amount = dto.amount
    const discount = dto.discount ?? 0
    const issueDate = this.toDate(dto.issueDate)
    const dueDate = this.toDate(dto.dueDate)

    this.assertConsistent({
      amount,
      discount,
      issueDate: issueDate.toISODate()!,
      dueDate: dueDate.toISODate()!,
    })

    const row = new Payable()
    row.merge({
      companyId: tenant.company.id,
      supplierId: dto.supplierId,
      documentNumber: dto.documentNumber,
      installment: dto.installment ?? 1,
      issueDate,
      dueDate,
      amount,
      discount,
      fine: dto.fine ?? 0,
      interest: dto.interest ?? 0,
      paidAmount: 0,
      notes: dto.notes || null,
    })

    // Never trusted from the payload — always derived. With no settlements, `open`.
    this.recomputeStatus(row)
    await row.save()

    await row.load('supplier')
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdatePayableDTO) {
    const row = await this.findOrFail(tenant, id)

    if (row.status === 'cancelled') {
      throw new BusinessException('Não é possível editar um título cancelado.')
    }

    if (dto.supplierId !== undefined) {
      await this.assertSupplierBelongsToTenant(tenant, dto.supplierId)
      row.supplierId = dto.supplierId
    }

    if (dto.documentNumber !== undefined) row.documentNumber = dto.documentNumber
    if (dto.installment !== undefined) row.installment = dto.installment
    if (dto.issueDate !== undefined) row.issueDate = this.toDate(dto.issueDate)
    if (dto.dueDate !== undefined) row.dueDate = this.toDate(dto.dueDate)
    if (dto.amount !== undefined) row.amount = dto.amount
    if (dto.discount !== undefined) row.discount = dto.discount
    if (dto.fine !== undefined) row.fine = dto.fine
    if (dto.interest !== undefined) row.interest = dto.interest
    if (dto.notes !== undefined) row.notes = dto.notes || null

    this.assertConsistent({
      amount: Number(row.amount),
      discount: Number(row.discount),
      issueDate: row.issueDate.toISODate()!,
      dueDate: row.dueDate.toISODate()!,
    })

    // Editing the values may change the total and, with it, the status: a paid
    // title whose amount went up owes the difference again and goes back to
    // partially paid. That recalculation is the intended behaviour.
    this.recomputeStatus(row)
    await row.save()

    await row.load('supplier')
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await this.findOrFail(tenant, id)

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este título porque já possui baixas.'
        )
      }
      throw error
    }
  }

  /**
   * Cancels a title: **deletes all its settlements** and marks it `cancelled`
   * (terminal). Multi-table (settlements + payable), so it runs in a transaction
   * with the title locked (`forUpdate`).
   *
   * `cancelled` is the one status that does **not** derive from `paidAmount`:
   * it is set directly here and never recomputed. `paidAmount` is zeroed because
   * the settlements are gone.
   */
  async cancel(tenant: TenantContext, id: number) {
    return db.transaction(async (trx) => {
      const row = await Payable.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('id', id)
        .forUpdate()
        .first()
      if (!row) throw new NotFoundException('Título não encontrado.')

      if (row.status === 'cancelled') {
        throw new BusinessException('Este título já está cancelado.')
      }

      // Remove todas as baixas do título (o cancelamento apaga o histórico de
      // pagamentos, conforme confirmado pelo usuário no diálogo).
      await PayableSettlement.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('payable_id', id)
        .delete()

      row.paidAmount = 0
      row.status = 'cancelled'
      row.useTransaction(trx)
      await row.save()

      await row.load('supplier')
      return this.serialize(row)
    })
  }

  /**
   * **The only place that assigns `status`** (besides the cancel action, which is
   * terminal). Derives it from what has been settled:
   *
   *   cancelado ⟸ ação de cancelar (terminal, não recalculado aqui)
   *   aberto    ⟸ paid = 0
   *   pago      ⟸ paid >= total
   *   parcial   ⟸ 0 < paid < total
   *
   * The settlement module calls this after moving `paidAmount`.
   */
  recomputeStatus(row: Payable) {
    if (row.status === 'cancelled') return

    const paid = this.cents(row.paidAmount)
    const total = this.totalCents(row)

    if (paid <= 0) row.status = 'open'
    else if (paid >= total) row.status = 'paid'
    else row.status = 'partially_paid'
  }

  /**
   * Applies the settlements of a payable: sets `paidAmount` to
   * `othersPaid + thisAmount`, validates the sum does not exceed the total, then
   * recomputes the status. **Does not save** — the caller (the settlement module)
   * owns the transaction.
   *
   * `othersPaid` is the sum of the **other** settlements of the title (the whole
   * remaining sum on delete; all but the edited one on edit; the current
   * `paidAmount` on create). `thisAmount` is the settlement being created/edited
   * (`0` on delete). Throws **422** with the available balance for THIS
   * settlement when it would overpay.
   */
  applySettlement(row: Payable, othersPaidReais: number, thisAmountReais: number) {
    const totalCents = this.totalCents(row)
    const othersCents = this.cents(othersPaidReais)
    const thisCents = this.cents(thisAmountReais)

    if (othersCents + thisCents > totalCents) {
      const availableCents = Math.max(0, totalCents - othersCents)
      throw new BusinessException(
        `O valor da baixa excede o saldo do título. Saldo disponível: ${formatBRL(availableCents)}.`
      )
    }

    row.paidAmount = (othersCents + thisCents) / 100
    this.recomputeStatus(row)
  }

  /**
   * Filtro de status de **múltipla escolha**. Nenhum selecionado = todos (não
   * filtra nada).
   *
   * Os selecionados se combinam em **OR**: marcar "Aberto" e "Vencido" traz os
   * abertos **e** os vencidos. `overdue` não é coluna — é a comparação de data,
   * que entra como mais um ramo do OR.
   */
  private applyStatusFilter(
    query: ReturnType<typeof payableRepository.query>,
    statuses: PayableStatusFilter[] | undefined
  ) {
    if (!statuses || statuses.length === 0) return

    const stored = statuses.filter((status): status is PayableStatus => status !== 'overdue')
    const includeOverdue = statuses.includes('overdue')

    query.where((group) => {
      if (stored.length > 0) group.whereIn('status', stored)

      if (includeOverdue) {
        group.orWhere((overdue) => {
          // Estritamente antes de hoje (vencer *hoje* não é vencido) e ainda devendo.
          overdue.where('due_date', '<', todayIso()).whereIn('status', OWING_STATUSES)
        })
      }
    })
  }

  private async findOrFail(tenant: TenantContext, id: number) {
    const row = await payableRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Título não encontrado.')
    return row
  }

  private async assertSupplierBelongsToTenant(tenant: TenantContext, supplierId: number) {
    const supplier = await supplierRepository.findById(tenant.company.id, supplierId)
    // Same message whether the supplier does not exist or belongs to another
    // company — we do not leak the existence of another tenant's data.
    if (!supplier) throw new BusinessException('Fornecedor inválido.')
  }

  private assertConsistent(values: {
    amount: number
    discount: number
    issueDate: string
    dueDate: string
  }) {
    if (this.cents(values.discount) > this.cents(values.amount)) {
      throw new BusinessException('O desconto não pode ser maior que o valor do título.')
    }
    if (values.dueDate < values.issueDate) {
      throw new BusinessException('O vencimento não pode ser anterior à emissão.')
    }
  }

  /**
   * Money in cents. `decimal` columns come back from the driver as strings, and
   * floating-point reais would make `paid >= total` unreliable at the boundary
   * (0.1 + 0.2 !== 0.3). Integer cents compare exactly.
   */
  private cents(value: number | string): number {
    return Math.round(Number(value) * 100)
  }

  private totalCents(row: Payable): number {
    return (
      this.cents(row.amount) -
      this.cents(row.discount) +
      this.cents(row.fine) +
      this.cents(row.interest)
    )
  }

  /** VineJS `Date` → luxon DateTime, for the `@column.date` columns. */
  private toDate(value: Date) {
    return DateTime.fromJSDate(value)
  }

  private serialize(row: Payable) {
    const totalCents = this.totalCents(row)
    const paidCents = this.cents(row.paidAmount)

    const isCancelled = row.status === 'cancelled'
    // Never negative: an edit may drop the total below what was already paid.
    // Overpayment is not modelled — the leftover simply does not exist.
    const balanceCents = isCancelled ? 0 : Math.max(0, totalCents - paidCents)

    const dueDate = row.dueDate.toISODate()!

    return {
      id: row.id,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name ?? null,
      documentNumber: row.documentNumber,
      installment: row.installment,
      issueDate: row.issueDate.toISODate(),
      dueDate,
      amount: Number(row.amount),
      discount: Number(row.discount),
      fine: Number(row.fine),
      interest: Number(row.interest),
      paidAmount: Number(row.paidAmount),
      status: row.status,
      notes: row.notes,
      total: totalCents / 100,
      balance: balanceCents / 100,
      // Resolved here, in the app timezone — the client must not recompute
      // "today" (the server runs on UTC).
      isOverdue: dueDate < todayIso() && OWING_STATUSES.includes(row.status),
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

/** `1234` cents → "R$ 12,34" (pt-BR), for user-facing balance messages. */
function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export default new PayableService()
