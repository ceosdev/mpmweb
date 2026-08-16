import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_entries'

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
        .integer('document_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('document_types')
        .onDelete('RESTRICT')
      table
        .integer('supplier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('RESTRICT')
      table
        .integer('payment_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('payment_types')
        .onDelete('RESTRICT')

      // String, não number: preserva zeros à esquerda e aceita "12345/A".
      table.string('document_number', 20).notNullable()
      table.string('series', 10).nullable()
      table.string('sub_series', 10).nullable()

      // Emissão = data do documento. Operação = data do lançamento no sistema.
      table.date('issue_date').notNullable()
      table.date('operation_date').notNullable()

      // Desconto geral da nota, distinto do desconto por serviço.
      table.decimal('discount', 12, 2).notNullable().defaultTo(0)

      // 'issuer' = retenção pelo emissor (não abate nada do que pagamos).
      // 'recipient' = retenção pelo destinatário (os 6 valores abaixo abatem).
      table.string('tax_withholding', 20).notNullable().defaultTo('issuer')
      table.decimal('iss', 12, 2).notNullable().defaultTo(0)
      table.decimal('pis', 12, 2).notNullable().defaultTo(0)
      table.decimal('cofins', 12, 2).notNullable().defaultTo(0)
      table.decimal('inss', 12, 2).notNullable().defaultTo(0)
      table.decimal('irrf', 12, 2).notNullable().defaultTo(0)
      table.decimal('csll', 12, 2).notNullable().defaultTo(0)

      // Quantidade de parcelas. Em `payables`, `installment` é o ORDINAL da
      // parcela — nomes distintos de propósito.
      table.integer('installment_count').notNullable().defaultTo(1)
      table.date('first_due_date').notNullable()

      // Resultado, nunca escrito pelo usuário.
      table.string('status', 20).notNullable().defaultTo('open')
      table.timestamp('finalized_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['company_id', 'operation_date'], 'service_entries_company_operation_idx')
      table.index(['company_id', 'status'], 'service_entries_company_status_idx')
      table.index(['company_id', 'supplier_id'], 'service_entries_company_supplier_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
