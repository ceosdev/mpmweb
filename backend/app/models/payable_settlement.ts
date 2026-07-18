import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Payable from '#models/payable'
import PaymentType from '#models/payment_type'

/**
 * Payable settlement (baixa de título) — a payment applied to a payable.
 * Per-company. Hard delete.
 *
 * `amount` is money in reais, stored as `decimal(12,2)`; the driver hands it
 * back as a string, so it is consumed through `Number(...)` in the service.
 *
 * See `docs/spec/financeiro/002-baixa-de-titulo.md`.
 */
export default class PayableSettlement extends BaseModel {
  static table = 'payable_settlements'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'payable_id' })
  declare payableId: number

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

  @belongsTo(() => Payable)
  declare payable: BelongsTo<typeof Payable>

  @belongsTo(() => PaymentType)
  declare paymentType: BelongsTo<typeof PaymentType>
}
