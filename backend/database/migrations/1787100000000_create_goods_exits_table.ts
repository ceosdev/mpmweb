import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Goods exits (saída de mercadoria) per company. Hard delete, only while
 * `open`. The consumer is either a product asset or an employee (exactly one),
 * and a `tool` exit always has an employee consumer — both rules live in check
 * constraints, which knex can't express, hence the raw statements.
 */
export default class extends BaseSchema {
  protected tableName = 'goods_exits'

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

      // 'normal' | 'tool' — immutable after creation.
      table.string('exit_type', 10).notNullable()
      // 'asset' | 'employee'
      table.string('consumer_type', 10).notNullable()
      table
        .integer('product_asset_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_assets')
        .onDelete('RESTRICT')
      table
        .integer('employee_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('RESTRICT')

      table.date('operation_date').notNullable()
      table
        .integer('requested_by_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.text('notes').nullable()

      // Resultado, nunca escrito pelo payload: open | finalized | delivered | returned.
      table.string('status', 10).notNullable().defaultTo('open')
      table.timestamp('finalized_at').nullable()
      table.timestamp('delivered_at').nullable()
      table.timestamp('returned_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'operation_date'], 'goods_exits_company_operation_idx')
      table.index(['company_id', 'status'], 'goods_exits_company_status_idx')
      table.index(['company_id', 'employee_id'], 'goods_exits_company_employee_idx')
      table.index(['company_id', 'product_asset_id'], 'goods_exits_company_asset_idx')
    })

    this.schema.raw(
      `ALTER TABLE goods_exits ADD CONSTRAINT goods_exits_consumer_chk CHECK (
        (consumer_type = 'asset' AND product_asset_id IS NOT NULL AND employee_id IS NULL)
        OR (consumer_type = 'employee' AND employee_id IS NOT NULL AND product_asset_id IS NULL)
      )`
    )
    this.schema.raw(
      `ALTER TABLE goods_exits ADD CONSTRAINT goods_exits_tool_employee_chk CHECK (
        exit_type <> 'tool' OR consumer_type = 'employee'
      )`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
