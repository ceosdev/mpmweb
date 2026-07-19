import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Receivable from '#models/receivable'
import PaymentType from '#models/payment_type'

/**
 * Receivable settlement (baixa de título a receber) — a receipt applied to a
 * receivable. Per-company. Hard delete. **Mirror of `PayableSettlement`**.
 *
 * `amount` is money in reais, stored as `decimal(12,2)`; the driver hands it back
 * as a string, so it is consumed through `Number(...)` in the service.
 *
 * See `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export default class ReceivableSettlement extends BaseModel {
  static table = 'receivable_settlements'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'receivable_id' })
  declare receivableId: number

  @column({ columnName: 'payment_type_id' })
  declare paymentTypeId: number

  @column.date({ columnName: 'settlement_date' })
  declare settlementDate: DateTime

  @column()
  declare amount: number

  @column({ columnName: 'document_number' })
  declare documentNumber: string | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Receivable)
  declare receivable: BelongsTo<typeof Receivable>

  @belongsTo(() => PaymentType)
  declare paymentType: BelongsTo<typeof PaymentType>
}
