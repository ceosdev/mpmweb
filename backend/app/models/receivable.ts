import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Customer from '#models/customer'

/**
 * Status of a receivable. **A result, never a user choice** — derived from
 * `paidAmount` by `ReceivableService.recomputeStatus()`, except `cancelled`,
 * which comes from the cancel action and is terminal.
 */
export type ReceivableStatus = 'open' | 'partially_paid' | 'paid' | 'cancelled'

export const RECEIVABLE_STATUSES = [
  'open',
  'partially_paid',
  'paid',
  'cancelled',
] as const satisfies readonly ReceivableStatus[]

/**
 * Receivable (título a receber) — per-company. Hard delete. **Mirror of
 * `Payable`**, with `customerId` (the cliente) in place of `supplierId`.
 *
 * `documentNumber` is a string on purpose (leading zeros, "12345/A"). The money
 * columns are `decimal(12,2)` in reais; the driver hands them back as strings, so
 * they are consumed through `Number(...)` in the service.
 *
 * See `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export default class Receivable extends BaseModel {
  static table = 'receivables'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'customer_id' })
  declare customerId: number

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

  /** Derived — see `ReceivableService.recomputeStatus()`. Never set from a payload. */
  @column()
  declare status: ReceivableStatus

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>
}
