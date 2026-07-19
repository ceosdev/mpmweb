import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Receivable settlements (baixas de título a receber) — **mirror of
 * `payable_settlements`**. Hard delete: removing a settlement reverses it and
 * gives the balance back to the title.
 *
 * A title has N settlements; their sum is the receivable's `paid_amount` and can
 * never exceed the title total. Every write recomputes the parent inside a
 * transaction — see `ReceivableSettlementService`.
 *
 * All three FKs use RESTRICT:
 *  - `receivable_id`: makes deleting a settled title fail with 409.
 *  - `payment_type_id`: a payment type in use cannot be deleted.
 *
 * See `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export default class extends BaseSchema {
  protected tableName = 'receivable_settlements'

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

      table
        .integer('receivable_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('receivables')
        .onDelete('RESTRICT')

      table
        .integer('payment_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('payment_types')
        .onDelete('RESTRICT')

      table.date('settlement_date').notNullable()
      table.decimal('amount', 12, 2).notNullable()
      table.string('document_number', 30).nullable()
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(
        ['company_id', 'receivable_id'],
        'receivable_settlements_company_receivable_idx'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
