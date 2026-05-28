import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Suppliers per company. Hard delete (no `deleted_at`). No uniqueness on
 * `tax_id` — duplicates are allowed by design, consistent with the simple-CRUD
 * family.
 */
export default class extends BaseSchema {
  protected tableName = 'suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table
        .integer('company_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('RESTRICT')

      table.string('tax_id', 14).notNullable()
      table.string('name', 120).notNullable()
      table.string('type', 20).notNullable() // 'goods' | 'service'
      table.string('address', 160).nullable()
      table.string('neighborhood', 80).nullable()
      table.string('city', 80).nullable()
      table.specificType('zip_code', 'char(8)').nullable()
      table.string('phone', 20).nullable()
      table.string('mobile', 20).nullable()
      table.string('contact_name', 120).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'name'], 'suppliers_company_name_idx')
      table.index(['company_id', 'tax_id'], 'suppliers_company_tax_id_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
