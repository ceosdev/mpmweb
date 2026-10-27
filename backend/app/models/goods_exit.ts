import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Employee from '#models/employee'
import ProductAsset from '#models/product_asset'
import User from '#models/user'
import GoodsExitItem from '#models/goods_exit_item'

/**
 * Status of a goods exit. **A result, never a user choice** — moved only by
 * the finalize (normal), deliver and return (tool) actions.
 */
export type GoodsExitStatus = 'open' | 'finalized' | 'delivered' | 'returned'

export const GOODS_EXIT_STATUSES = [
  'open',
  'finalized',
  'delivered',
  'returned',
] as const satisfies readonly GoodsExitStatus[]

export type GoodsExitType = 'normal' | 'tool'
export type GoodsExitConsumerType = 'asset' | 'employee'

/**
 * Goods exit (saída de mercadoria), per company. Hard delete, only while
 * `open`. A `tool` exit always has an employee consumer.
 *
 * See `docs/spec/movimentacao/003-criar-tela-saida-de-mercadoria.md`.
 */
export default class GoodsExit extends BaseModel {
  static table = 'goods_exits'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  /** Immutable after creation. */
  @column({ columnName: 'exit_type' })
  declare exitType: GoodsExitType

  @column({ columnName: 'consumer_type' })
  declare consumerType: GoodsExitConsumerType

  @column({ columnName: 'product_asset_id' })
  declare productAssetId: number | null

  @column({ columnName: 'employee_id' })
  declare employeeId: number | null

  @column.date({ columnName: 'operation_date' })
  declare operationDate: DateTime

  @column({ columnName: 'requested_by_user_id' })
  declare requestedByUserId: number

  @column()
  declare notes: string | null

  /** Never set from a payload. */
  @column()
  declare status: GoodsExitStatus

  @column.dateTime({ columnName: 'finalized_at' })
  declare finalizedAt: DateTime | null

  @column.dateTime({ columnName: 'delivered_at' })
  declare deliveredAt: DateTime | null

  @column.dateTime({ columnName: 'returned_at' })
  declare returnedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Employee)
  declare employee: BelongsTo<typeof Employee>

  @belongsTo(() => ProductAsset)
  declare productAsset: BelongsTo<typeof ProductAsset>

  @belongsTo(() => User, { foreignKey: 'requestedByUserId' })
  declare requestedBy: BelongsTo<typeof User>

  @hasMany(() => GoodsExitItem)
  declare items: HasMany<typeof GoodsExitItem>
}
