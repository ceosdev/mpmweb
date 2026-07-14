import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Payables (contas a pagar) per company. Hard delete (no `deleted_at`).
 *
 * **No uniqueness** on (supplier, document number, installment) — launching the
 * same title twice is allowed by design (explicit decision), consistent with the
 * cadastros family.
 *
 * `document_number` is a **string**, not a number: it preserves leading zeros
 * ("000123") and accepts fiscal-document formats ("12345/A").
 *
 * `status` and `paid_amount` are **results, never user input**: `paid_amount` is
 * moved by the settlement module (next spec) and `status` is derived from it by
 * `PayableService.recomputeStatus()`. Both FKs use RESTRICT.
 *
 * See `docs/spec/financeiro/001-criar-tela-contas-a-pagar.md`.
 */
export default class extends BaseSchema {
  protected tableName = 'payables'

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
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
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

      table.index(['company_id', 'due_date'], 'payables_company_due_date_idx')
      table.index(['company_id', 'status'], 'payables_company_status_idx')
      table.index(['company_id', 'supplier_id'], 'payables_company_supplier_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
