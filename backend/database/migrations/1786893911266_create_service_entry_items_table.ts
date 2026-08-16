import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_entry_items'

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
      // RESTRICT, não CASCADE: o projeto inteiro é RESTRICT, e o service apaga
      // os filhos explicitamente dentro da transação (como o cancelamento de
      // título faz com as baixas).
      table
        .integer('service_entry_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('service_entries')
        .onDelete('RESTRICT')
      table
        .integer('service_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('services')
        .onDelete('RESTRICT')

      // Inteiro: serviço se conta por unidade (decisão do usuário).
      table.integer('quantity').notNullable()
      table.decimal('unit_price', 12, 2).notNullable()
      table.decimal('discount', 12, 2).notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'service_entry_id'], 'service_entry_items_company_entry_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
