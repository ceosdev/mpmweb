import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_assets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Nullable: origem opcional. RESTRICT impede excluir entrada com filhos.
      table
        .integer('goods_entry_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('goods_entries')
        .onDelete('RESTRICT')
      table.index(['goods_entry_id'], 'product_assets_goods_entry_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['goods_entry_id'], 'product_assets_goods_entry_idx')
      table.dropForeign(['goods_entry_id'])
      table.dropColumn('goods_entry_id')
    })
  }
}
