import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds identification, address, contact and logo fields to companies.
 * All new columns are nullable so the migration is safe to run on existing
 * rows (the demo company created by the seeder stays valid).
 */
export default class extends BaseSchema {
  protected tableName = 'companies'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('state_registration', 30).nullable()
      table.string('municipal_registration', 30).nullable()
      table.string('address', 180).nullable()
      table.string('address_number', 20).nullable()
      table.string('neighborhood', 120).nullable()
      table.string('city', 120).nullable()
      table.specificType('zip_code', 'char(8)').nullable()
      table.specificType('state', 'char(2)').nullable()
      table.string('phone', 11).nullable()
      table.string('email', 180).nullable()
      table.string('logo_path', 255).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('state_registration')
      table.dropColumn('municipal_registration')
      table.dropColumn('address')
      table.dropColumn('address_number')
      table.dropColumn('neighborhood')
      table.dropColumn('city')
      table.dropColumn('zip_code')
      table.dropColumn('state')
      table.dropColumn('phone')
      table.dropColumn('email')
      table.dropColumn('logo_path')
    })
  }
}
