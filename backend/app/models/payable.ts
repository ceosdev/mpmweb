import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Supplier from '#models/supplier'

/**
 * Status of a payable. **A result, never a user choice** — derived from
 * `paidAmount` by `PayableService.recomputeStatus()`, except `cancelled`, which
 * comes from the (upcoming) cancel action and is terminal.
 */
export type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'cancelled'

export const PAYABLE_STATUSES = [
  'open',
  'partially_paid',
  'paid',
  'cancelled',
] as const satisfies readonly PayableStatus[]

/**
 * Payable (título a pagar) — per-company. Hard delete.
 *
 * `documentNumber` is a string on purpose (leading zeros, "12345/A").
 * `amount`, `discount`, `fine`, `interest` and `paidAmount` are money in reais,
 * stored as `decimal(12,2)` — the driver hands them back as strings, so they are
 * consumed through `Number(...)` in the service.
 *
 * See `docs/spec/financeiro/001-criar-tela-contas-a-pagar.md`.
 */
export default class Payable extends BaseModel {
  static table = 'payables'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'supplier_id' })
  declare supplierId: number

  /**
   * Origin of this title: the service entry that generated it, or `null` when it
   * was entered by hand. Future origins (lançamento direto financeiro) get their
   * own nullable column — one per origin, no polymorphism.
   */
  @column({ columnName: 'service_entry_id' })
  declare serviceEntryId: number | null

  @column({ columnName: 'document_number' })
  declare documentNumber: string

  @column()
  declare installment: number

  @column.date({ columnName: 'issue_date' })
  declare issueDate: DateTime

  @column.date({ columnName: 'due_date' })
  declare dueDate: DateTime

  @column()
  declare amount: number

  @column()
  declare discount: number

  @column()
  declare fine: number

  @column()
  declare interest: number

  /** Sum of the settlements. Moved only by the settlement module. */
  @column({ columnName: 'paid_amount' })
  declare paidAmount: number

  /** Derived — see `PayableService.recomputeStatus()`. Never set from a payload. */
  @column()
  declare status: PayableStatus

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>
}
