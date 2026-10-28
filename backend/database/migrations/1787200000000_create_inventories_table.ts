import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Product inventories (inventário de produtos) per company. Hard delete, only
 * while `open`. At most one `open` inventory per company, enforced by a
 * partial unique index (knex can't express it, hence the raw statement).
 */
export default class extends BaseSchema {
  protected tableName = 'inventories'

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

      table.date('opening_date').notNullable()
      table
        .integer('opened_by_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      // Resultado, nunca escrito pelo payload: open | closed.
      table.string('status', 10).notNullable().defaultTo('open')
      table.timestamp('closed_at').nullable()
      table
        .integer('closed_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'opening_date'], 'inventories_company_opening_idx')
      table.index(['company_id', 'status'], 'inventories_company_status_idx')
    })

    this.schema.raw(
      `create unique index inventories_company_open_uq on inventories (company_id) where status = 'open'`
    )
  }

  async down() {
    this.schema.raw('drop index if exists inventories_company_open_uq')
    this.schema.dropTable(this.tableName)
  }
}
