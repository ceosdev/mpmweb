import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import Product from '#models/product'
import Brand from '#models/brand'
import BrandModel from '#models/brand_model'

/** Lifecycle situation of an asset. */
export type AssetSituation = 'available' | 'allocated' | 'sold'

/**
 * ProductAsset — child of a Product, per-company. Hard delete.
 * Only products of type `fixed_asset` may own assets. `companyId` is
 * denormalized; the FK to `products` is the authoritative parent link.
 * Brand / model are optional FKs (model is a cascade of brand).
 */
export default class ProductAsset extends BaseModel {
  static table = 'product_assets'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'product_id' })
  declare productId: number

  @column()
  declare description: string

  @column({ columnName: 'asset_code' })
  declare assetCode: string | null

  @column({ columnName: 'brand_id' })
  declare brandId: number | null

  @column({ columnName: 'brand_model_id' })
  declare brandModelId: number | null

  @column({ columnName: 'manufacture_year' })
  declare manufactureYear: string | null

  @column()
  declare btu: string | null

  @column()
  declare situation: AssetSituation

  @column({ columnName: 'equipment_exists' })
  declare equipmentExists: boolean

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => Brand, { foreignKey: 'brandId' })
  declare brand: BelongsTo<typeof Brand>

  @belongsTo(() => BrandModel, { foreignKey: 'brandModelId' })
  declare model: BelongsTo<typeof BrandModel>
}
