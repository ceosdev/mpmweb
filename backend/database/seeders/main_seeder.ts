import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'
import Company from '#models/company'
import User from '#models/user'
import Membership from '#models/membership'
import { PERMISSIONS, ROLES, WILDCARD } from '#abilities/catalog'

/**
 * Bootstrap seeder. Idempotent — safe to run multiple times. It populates:
 *  - the permission catalog
 *  - the three system roles and their default permissions
 *  - the initial root user
 *  - a demonstration company with the root user linked to it
 */
export default class extends BaseSeeder {
  async run() {
    /**
     * 1. Permission catalog.
     */
    const permissionBySlug = new Map<string, Permission>()
    for (const def of PERMISSIONS) {
      const permission = await Permission.updateOrCreate({ slug: def.slug }, def)
      permissionBySlug.set(def.slug, permission)
    }

    /**
     * 2. System roles + their default permissions.
     */
    const roleBySlug = new Map<string, Role>()
    for (const def of Object.values(ROLES)) {
      const role = await Role.updateOrCreate(
        { slug: def.slug },
        { name: def.name, description: def.description, isSystem: true }
      )

      const slugs =
        def.permissions === WILDCARD ? PERMISSIONS.map((p) => p.slug) : def.permissions
      const permissionIds = slugs.map((slug) => permissionBySlug.get(slug)!.id)
      await role.related('permissions').sync(permissionIds)

      roleBySlug.set(def.slug, role)
    }

    /**
     * 3. Initial root user.
     */
    const root = await User.updateOrCreate(
      { email: 'carlossantana.desenv@gmail.com' },
      {
        name: 'Carlos Santana',
        password: '12345678',
        isRoot: true,
        isActive: true,
      }
    )

    /**
     * 4. Demonstration company.
     */
    const company = await Company.updateOrCreate(
      { slug: 'empresa-demo' },
      {
        legalName: 'Empresa Demonstração LTDA',
        tradeName: 'Empresa Demo',
        taxId: '00.000.000/0001-00',
        isActive: true,
      }
    )

    /**
     * 5. Link the root user to the demo company with the root role.
     */
    await Membership.updateOrCreate(
      { userId: root.id, companyId: company.id },
      { roleId: roleBySlug.get('root')!.id, isActive: true }
    )
  }
}
