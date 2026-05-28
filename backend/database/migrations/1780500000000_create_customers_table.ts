import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Customers per company. Hard delete (no `deleted_at`). No uniqueness on
 * `tax_id` or `email` — duplicates are allowed by design, consistent with the
 * simple-CRUD family. `is_internal` flags the workshop itself as a customer
 * (used by future OS / internal-movement modules).
 */
export default class extends BaseSchema {
  protected tableName = 'customers'

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

      table.string('type', 20).notNullable() // 'individual' | 'company'
      table.string('legal_name', 160).notNullable()
      table.string('trade_name', 160).nullable()
      table.string('tax_id', 14).notNullable()

      table.string('address', 160).nullable()
      table.string('address_number', 20).nullable()
      table.string('address_complement', 80).nullable()
      table.string('neighborhood', 80).nullable()
      table.string('city', 80).nullable()
      table.specificType('zip_code', 'char(8)').nullable()

      table.string('phone', 20).nullable()
      table.string('mobile', 20).nullable()
      table.string('email', 160).nullable()

      table.date('customer_since').nullable()
      table.string('contact_name', 120).nullable()

      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('is_internal').notNullable().defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'legal_name'], 'customers_company_legal_name_idx')
      table.index(['company_id', 'trade_name'], 'customers_company_trade_name_idx')
      table.index(['company_id', 'tax_id'], 'customers_company_tax_id_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
