import Role from '#models/role'
import Permission from '#models/permission'
import type { TenantContext } from '#services/tenant_context'
import roleRepository from '#repositories/role_repository'
import {
  BusinessException,
  ConflictException,
  NotFoundException,
} from '#exceptions/app_exception'

export interface ListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

const SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateRoleDTO {
  name: string
  slug: string
  description?: string
  isActive?: boolean
  permissions?: number[]
}

export interface UpdateRoleDTO {
  name?: string
  slug?: string
  description?: string | null
  isActive?: boolean
  permissions?: number[]
}

/**
 * Use cases for the Roles module. All operations scope to the active tenant.
 * The platform-level ROOT role (`company_id IS NULL`, `is_system = true`) is
 * intentionally invisible and immutable here — there is no UI for it and the
 * service refuses to operate on it even if an id is provided.
 */
export class RoleService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = roleRepository
      .query(tenant.company.id)
      .withCount('permissions')
      .orderBy(sortColumn ?? 'name', sortColumn ? sortDirection : 'asc')

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`
      query.whereRaw('lower(name) like ?', [term])
    }

    const result = await query.paginate(page, perPage)
    return {
      data: result.all().map((row) => this.serializeSummary(row)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
      },
    }
  }

  /** Active manageable roles for the active company — used by the user form. */
  async options(tenant: TenantContext) {
    const rows = await roleRepository.options(tenant.company.id).preload('permissions')
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isSystem: row.isSystem,
      isActive: row.isActive,
      permissions: row.permissions.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        module: p.module,
        action: p.action,
        description: p.description,
      })),
    }))
  }

  async show(tenant: TenantContext, id: number) {
    const row = await roleRepository.findByIdWithPermissions(tenant.company.id, id)
    if (!row) throw new NotFoundException('Perfil não encontrado.')
    return this.serializeDetail(row)
  }

  async create(tenant: TenantContext, dto: CreateRoleDTO) {
    await this.ensureSlugAvailable(tenant.company.id, dto.slug, null)
    const permissionIds = await this.normalizePermissions(dto.permissions)

    const role = await Role.create({
      companyId: tenant.company.id,
      isSystem: false,
      name: dto.name,
      slug: dto.slug,
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    })
    await role.related('permissions').sync(permissionIds)

    const reloaded = await roleRepository.findByIdWithPermissions(tenant.company.id, role.id)
    return this.serializeDetail(reloaded!)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateRoleDTO) {
    const role = await roleRepository.findById(tenant.company.id, id)
    if (!role) throw new NotFoundException('Perfil não encontrado.')

    if (dto.slug !== undefined && dto.slug !== role.slug) {
      await this.ensureSlugAvailable(tenant.company.id, dto.slug, role.id)
      role.slug = dto.slug
    }
    if (dto.name !== undefined) role.name = dto.name
    if (dto.description !== undefined) {
      role.description = dto.description?.toString().trim() || null
    }
    if (dto.isActive !== undefined) role.isActive = dto.isActive
    await role.save()

    if (dto.permissions !== undefined) {
      const permissionIds = await this.normalizePermissions(dto.permissions)
      await role.related('permissions').sync(permissionIds)
    }

    const reloaded = await roleRepository.findByIdWithPermissions(tenant.company.id, role.id)
    return this.serializeDetail(reloaded!)
  }

  /**
   * Hard-delete a role. If memberships still reference it, the FK constraint
   * raises and the controller translates the error to a 409.
   */
  async destroy(tenant: TenantContext, id: number) {
    const role = await roleRepository.findById(tenant.company.id, id)
    if (!role) throw new NotFoundException('Perfil não encontrado.')

    try {
      await role.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este perfil porque há usuários atrelados a ele.'
        )
      }
      throw error
    }
  }

  private async ensureSlugAvailable(companyId: number, slug: string, ignoreId: number | null) {
    const query = Role.query().where('company_id', companyId).where('slug', slug)
    if (ignoreId !== null) query.whereNot('id', ignoreId)
    const existing = await query.first()
    if (existing) {
      throw new BusinessException('Já existe um perfil com este slug nesta empresa.')
    }
  }

  private async normalizePermissions(input: number[] | undefined): Promise<number[]> {
    if (!input || input.length === 0) return []
    const ids = Array.from(new Set(input))
    const rows = await Permission.query().whereIn('id', ids).select('id')
    if (rows.length !== ids.length) {
      throw new BusinessException('Uma ou mais permissões selecionadas não existem.')
    }
    return ids
  }

  private serializeSummary(row: Role & { $extras: Record<string, unknown> }) {
    const permissionsCount = Number(row.$extras.permissions_count ?? 0)
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isSystem: row.isSystem,
      isActive: row.isActive,
      permissionsCount,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }

  private serializeDetail(row: Role) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isSystem: row.isSystem,
      isActive: row.isActive,
      permissions: (row.permissions ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        module: p.module,
        action: p.action,
        description: p.description,
      })),
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23503'
  )
}

export default new RoleService()
