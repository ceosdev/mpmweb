import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payables'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Nullable de propósito: um título pode nascer solto (botão Novo) ou, no
      // futuro, do lançamento direto financeiro — que entrará como sua própria
      // coluna nullable. Uma coluna por origem, sem polimorfismo.
      // RESTRICT é o que impede excluir uma entrada que já gerou título.
      table
        .integer('service_entry_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('service_entries')
        .onDelete('RESTRICT')
      table.index(['service_entry_id'], 'payables_service_entry_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['service_entry_id'], 'payables_service_entry_idx')
      table.dropForeign(['service_entry_id'])
      table.dropColumn('service_entry_id')
    })
  }
}
