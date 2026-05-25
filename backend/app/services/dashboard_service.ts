import db from '@adonisjs/lucid/services/db'
import type { TenantContext } from '#services/tenant_context'

/**
 * Read-only metrics for the dashboard. All counts respect the active company;
 * the total of companies is only meaningful to root (others always see 1).
 */
export class DashboardService {
  async getStats(tenant: TenantContext) {
    const activeUsers = await this.count(
      db
        .from('memberships')
        .where('company_id', tenant.company.id)
        .where('is_active', true)
        .whereNull('deleted_at')
    )

    const totalCompanies = tenant.isRoot
      ? await this.count(db.from('companies').where('is_active', true).whereNull('deleted_at'))
      : 1

    const totalRoles = await this.count(
      db.from('roles').where('company_id', tenant.company.id).where('is_system', false)
    )
    const totalPermissions = await this.count(db.from('permissions'))

    return {
      activeUsers,
      companies: totalCompanies,
      roles: totalRoles,
      permissions: totalPermissions,
    }
  }

  private async count(query: ReturnType<typeof db.from>): Promise<number> {
    const row = await query.count('* as total').first()
    return Number(row?.total ?? 0)
  }
}

export default new DashboardService()
