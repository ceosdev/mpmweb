import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds `auto_settlement` to payment_types — whether the payment type performs
 * the automatic write-off (baixa) of a receivable. Boolean, NOT NULL, default
 * false. Adding a NOT NULL column with a default backfills existing rows to
 * false; the explicit update below makes that intent unmistakable.
 */
export default class extends BaseSchema {
  protected tableName = 'payment_types'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('auto_settlement').notNullable().defaultTo(false)
    })

    this.defer(async (db) => {
      await db.from(this.tableName).update({ auto_settlement: false })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('auto_settlement')
    })
  }
}
