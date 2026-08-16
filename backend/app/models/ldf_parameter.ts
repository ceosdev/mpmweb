import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from '#models/company'
import ExpenseGroup from '#models/expense_group'

/**
 * LdfParameter — per-company catalog entry for LDF (lançamento direto
 * financeiro): a payable created without a formal document. Hard delete:
 * removal is permanent. Belongs to an ExpenseGroup (RESTRICT prevents deleting
 * a group still parameterized here). The row `id` is what the UI shows as
 * "Código".
 */
export default class LdfParameter extends BaseModel {
  static table = 'ldf_parameters'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'company_id' })
  declare companyId: number

  @column({ columnName: 'expense_group_id' })
  declare expenseGroupId: number

  @column()
  declare description: string

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => ExpenseGroup, { foreignKey: 'expenseGroupId' })
  declare expenseGroup: BelongsTo<typeof ExpenseGroup>
}
