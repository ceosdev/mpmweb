import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import User from '#models/user'
import InventoryItem from '#models/inventory_item'
import InventoryProductGroup from '#models/inventory_product_group'

/**
 * Status of an inventory. **A result, never a user choice** — moved only by
 * the close action.
 */
export type InventoryStatus = 'open' | 'closed'

export const INVENTORY_STATUSES = ['open', 'closed'] as const satisfies readonly InventoryStatus[]

/**
 * Product inventory (inventário de produtos), per company. Hard delete, only
 * while `open`; one open inventory per company at most.
 *
 * See `docs/spec/movimentacao/005-criar-tela-inventario-de-produtos.md`.
 */
export default class Inventory extends BaseModel {
  static table = 'inventories'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column.date({ columnName: 'opening_date' })
  declare openingDate: DateTime

  @column({ columnName: 'opened_by_user_id' })
  declare openedByUserId: number

  /** Never set from a payload. */
  @column()
  declare status: InventoryStatus

  @column.dateTime({ columnName: 'closed_at' })
  declare closedAt: DateTime | null

  @column({ columnName: 'closed_by_user_id' })
  declare closedByUserId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => User, { foreignKey: 'openedByUserId' })
  declare openedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'closedByUserId' })
  declare closedBy: BelongsTo<typeof User>

  @hasMany(() => InventoryItem)
  declare items: HasMany<typeof InventoryItem>

  @hasMany(() => InventoryProductGroup)
  declare groups: HasMany<typeof InventoryProductGroup>
}
