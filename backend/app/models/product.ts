import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import ProductGroup from '#models/product_group'
import ProductSubgroup from '#models/product_subgroup'
import UnitOfMeasure from '#models/unit_of_measure'

export type ProductType = 'consumable' | 'fixed_asset'

/**
 * Product — per-company master catalog entry. Hard delete: removal is
 * permanent. Group, subgroup and unit are all optional FKs (RESTRICT prevents
 * deleting a parent still in use). Stock fields are governed by `controlsStock`
 * (see ProductService.normalizeStock). `quantityInStock` is set at create and
 * thereafter only moved by the future stock-entry module.
 */
export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column()
  declare description: string

  @column()
  declare type: ProductType

  @column({ columnName: 'product_group_id' })
  declare productGroupId: number | null

  @column({ columnName: 'product_subgroup_id' })
  declare productSubgroupId: number | null

  @column({ columnName: 'unit_of_measure_id' })
  declare unitOfMeasureId: number | null

  @column({ columnName: 'controls_stock' })
  declare controlsStock: boolean

  @column({
    columnName: 'minimum_stock',
    consume: (value: string | null) => (value === null ? null : Number(value)),
  })
  declare minimumStock: number | null

  @column({
    columnName: 'quantity_in_stock',
    consume: (value: string | null) => (value === null ? null : Number(value)),
  })
  declare quantityInStock: number | null

  @column({
    columnName: 'cost_price',
    consume: (value: string | null) => (value === null ? null : Number(value)),
  })
  declare costPrice: number | null

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => ProductGroup, { foreignKey: 'productGroupId' })
  declare group: BelongsTo<typeof ProductGroup>

  @belongsTo(() => ProductSubgroup, { foreignKey: 'productSubgroupId' })
  declare subgroup: BelongsTo<typeof ProductSubgroup>

  @belongsTo(() => UnitOfMeasure, { foreignKey: 'unitOfMeasureId' })
  declare unit: BelongsTo<typeof UnitOfMeasure>
}
