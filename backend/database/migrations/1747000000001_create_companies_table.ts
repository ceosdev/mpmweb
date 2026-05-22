import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Companies (tenants). Every business entity in the platform belongs to one
 * company — this table is the root of data segregation.
 */
export default class extends BaseSchema {
  protected tableName = 'companies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table.string('legal_name', 180).notNullable()
      table.string('trade_name', 180).nullable()
      table.string('tax_id', 18).nullable().unique() // CNPJ
      table.string('slug', 80).notNullable().unique()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('deleted_at').nullable()

      table.index(['is_active'], 'companies_is_active_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
