import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Receivables (contas a receber) per company. **Mirror of `payables`**, with the
 * one domain difference: the FK is `customer_id` (the cliente) instead of
 * `supplier_id`. Hard delete (no `deleted_at`).
 *
 * `document_number` is a string (leading zeros, "12345/A"). `status` and
 * `paid_amount` are results, never user input — moved by the settlement module
 * and derived by `ReceivableService.recomputeStatus()`. Both FKs use RESTRICT.
 *
 * See `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export default class extends BaseSchema {
  protected tableName = 'receivables'

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
        .integer('customer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('customers')
        .onDelete('RESTRICT')

      table.string('document_number', 20).notNullable()
      table.smallint('installment').notNullable().defaultTo(1)

      table.date('issue_date').notNullable()
      table.date('due_date').notNullable()

      table.decimal('amount', 12, 2).notNullable()
      table.decimal('discount', 12, 2).notNullable().defaultTo(0)
      table.decimal('fine', 12, 2).notNullable().defaultTo(0)
      table.decimal('interest', 12, 2).notNullable().defaultTo(0)

      // Moved only by the settlement module; this CRUD never writes these two.
      table.decimal('paid_amount', 12, 2).notNullable().defaultTo(0)
      table.string('status', 20).notNullable().defaultTo('open')

      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'due_date'], 'receivables_company_due_date_idx')
      table.index(['company_id', 'status'], 'receivables_company_status_idx')
      table.index(['company_id', 'customer_id'], 'receivables_company_customer_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
