import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Employees per company. Hard delete (no `deleted_at`). `tax_id` (CPF) is
 * optional but unique within a company: a partial unique index ignores the
 * NULLs, so several employees without CPF coexist. Knex can't express the
 * `WHERE` of a partial index through `unique()`, hence the raw statement.
 */
export default class extends BaseSchema {
  protected tableName = 'employees'

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

      table.string('name', 120).notNullable()
      table.string('role_title', 80).nullable()
      table.date('birth_date').nullable()

      table.specificType('tax_id', 'char(11)').nullable()
      table.string('id_number', 20).nullable()
      table.string('work_card', 30).nullable()
      table.string('pis', 20).nullable()
      table.string('driver_license', 20).nullable()

      table.string('address', 160).nullable()
      table.string('address_number', 20).nullable()
      table.string('address_complement', 80).nullable()
      table.string('neighborhood', 80).nullable()
      table.string('city', 80).nullable()
      table.specificType('zip_code', 'char(8)').nullable()

      table.string('phone', 20).nullable()
      table.string('mobile', 20).nullable()
      table.string('email', 160).nullable()

      table.date('hired_at').nullable()
      table.date('terminated_at').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'name'], 'employees_company_name_idx')
    })

    this.schema.raw(
      'CREATE UNIQUE INDEX employees_company_tax_id_uq ON employees (company_id, tax_id) WHERE tax_id IS NOT NULL'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
