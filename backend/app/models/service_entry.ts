import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import DocumentType from '#models/document_type'
import PaymentType from '#models/payment_type'
import Supplier from '#models/supplier'
import ServiceEntryItem from '#models/service_entry_item'

/**
 * Status of a service entry. **A result, never a user choice** — moved only by
 * the finalize and cancel actions. `cancelled` is terminal: there is no reopen.
 */
export type ServiceEntryStatus = 'open' | 'finalized' | 'cancelled'

export const SERVICE_ENTRY_STATUSES = [
  'open',
  'finalized',
  'cancelled',
] as const satisfies readonly ServiceEntryStatus[]

/**
 * Who withholds the taxes. `issuer` means the supplier handles them and nothing
 * is deducted from what we owe; `recipient` means we withhold, so the six tax
 * amounts are subtracted from the payable base.
 */
export type TaxWithholding = 'issuer' | 'recipient'

export const TAX_WITHHOLDINGS = [
  'issuer',
  'recipient',
] as const satisfies readonly TaxWithholding[]

/**
 * Service entry (entrada de serviço) — the incoming service invoice, per
 * company. Hard delete, and only while `open`.
 *
 * All money columns are `decimal(12,2)` in reais; the driver hands them back as
 * strings, so they are consumed through `Number(...)` in the service.
 *
 * See `docs/spec/servicos/001-criar-tela-entrada-de-servico.md`.
 */
export default class ServiceEntry extends BaseModel {
  static table = 'service_entries'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'document_type_id' })
  declare documentTypeId: number

  @column({ columnName: 'supplier_id' })
  declare supplierId: number

  @column({ columnName: 'payment_type_id' })
  declare paymentTypeId: number

  @column({ columnName: 'document_number' })
  declare documentNumber: string

  @column()
  declare series: string | null

  @column({ columnName: 'sub_series' })
  declare subSeries: string | null

  @column.date({ columnName: 'issue_date' })
  declare issueDate: DateTime

  /** When it was entered in the system — not the document's date. */
  @column.date({ columnName: 'operation_date' })
  declare operationDate: DateTime

  /** Invoice-wide discount, distinct from each item's own discount. */
  @column()
  declare discount: number

  @column({ columnName: 'tax_withholding' })
  declare taxWithholding: TaxWithholding

  @column()
  declare iss: number

  @column()
  declare pis: number

  @column()
  declare cofins: number

  @column()
  declare inss: number

  @column()
  declare irrf: number

  @column()
  declare csll: number

  /** How many installments. The ordinal lives in `payables.installment`. */
  @column({ columnName: 'installment_count' })
  declare installmentCount: number

  @column.date({ columnName: 'first_due_date' })
  declare firstDueDate: DateTime

  /** Never set from a payload — see `ServiceEntryService.finalize/cancel`. */
  @column()
  declare status: ServiceEntryStatus

  @column.dateTime({ columnName: 'finalized_at' })
  declare finalizedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => DocumentType)
  declare documentType: BelongsTo<typeof DocumentType>

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>

  @belongsTo(() => PaymentType)
  declare paymentType: BelongsTo<typeof PaymentType>

  @hasMany(() => ServiceEntryItem)
  declare items: HasMany<typeof ServiceEntryItem>
}
