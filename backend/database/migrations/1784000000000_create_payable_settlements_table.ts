import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Payable settlements (baixas de título) — the payments applied to a payable.
 * Hard delete (no `deleted_at`): removing a settlement is what "reverses" it and
 * gives the balance back to the title.
 *
 * A title has N settlements; their sum is the payable's `paid_amount` and can
 * never exceed the title total. Every write here recomputes the parent's
 * `paid_amount`/`status` inside a transaction — see
 * `PayableSettlementService`.
 *
 * All three FKs use RESTRICT:
 *  - `payable_id`: this is what makes deleting a settled title fail with 409.
 *  - `payment_type_id`: a payment type in use cannot be deleted.
 *
 * See `docs/spec/financeiro/002-baixa-de-titulo.md`.
 */
export default class extends BaseSchema {
  protected tableName = 'payable_settlements'

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
        .integer('payable_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('payables')
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

      table.index(['company_id', 'payable_id'], 'payable_settlements_company_payable_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
