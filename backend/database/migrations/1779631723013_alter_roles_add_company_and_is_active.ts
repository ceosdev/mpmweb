import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Makes the `roles` table multitenant:
 *
 *  - Adds `company_id` (NULL only for the global ROOT role).
 *  - Adds `is_active` so a role can be disabled without being deleted.
 *  - Replaces the global unique on `slug` with `(company_id, slug)`.
 *  - Removes the previously seeded global ADMIN and OPERADOR rows; from now
 *    on each company creates the profiles it wants.
 *
 * The data step aborts if any membership still points at the legacy
 * admin/operator roles — there is no product rule for where to move those
 * memberships, so it must be a human decision before re-running.
 */
export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('company_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('companies')
        .onDelete('CASCADE')

      table.boolean('is_active').notNullable().defaultTo(true)

      table.dropUnique(['slug'])
      table.unique(['company_id', 'slug'], { indexName: 'roles_company_slug_unique' })
    })

    this.defer(async (db) => {
      const blockers = await db
        .from('memberships')
        .join('roles', 'memberships.role_id', 'roles.id')
        .whereIn('roles.slug', ['admin', 'operator'])
        .count('* as total')
        .first()

      const total = Number(blockers?.total ?? 0)
      if (total > 0) {
        throw new Error(
          `Migration aborted: ${total} membership(s) still reference legacy admin/operator ` +
            `roles. Reassign or remove those memberships and re-run the migration.`
        )
      }

      await db.from('roles').whereIn('slug', ['admin', 'operator']).delete()
    })
  }

  async down() {
    throw new Error(
      'This migration is not reversible: the legacy admin/operator roles were destructively ' +
        'removed during the data step.'
    )
  }
}
