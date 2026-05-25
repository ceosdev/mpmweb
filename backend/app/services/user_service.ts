import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import Company from '#models/company'
import Role from '#models/role'
import Membership from '#models/membership'
import type { TenantContext } from '#services/tenant_context'
import membershipRepository from '#repositories/membership_repository'
import { BusinessException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL expression. */
const USER_SORT_COLUMNS: Record<string, string> = {
  name: 'users.name',
  email: 'users.email',
  is_active: 'memberships.is_active',
  last_login_at: 'users.last_login_at',
  created_at: 'memberships.created_at',
}

export interface CreateUserDTO {
  name: string
  email: string
  password: string
  roleId: number
  isActive?: boolean
  extraPermissions?: number[]
}

export interface UpdateUserDTO {
  name?: string
  password?: string
  roleId?: number
  isActive?: boolean
  extraPermissions?: number[]
}

export interface ImportUserDTO {
  userId: number
  roleId: number
  isActive?: boolean
  extraPermissions?: number[]
}

/**
 * Use cases for the Users module. All operations are scoped to the active
 * company carried by the `TenantContext` — a user is always managed through
 * its membership, never globally.
 */
export class UserService {
  /** Paginated list of users that belong to the active company. */
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && USER_SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    // Always qualify columns with the table name — joining `users` for sort
    // would otherwise make `deleted_at` and other shared columns ambiguous.
    const query = Membership.query()
      .where('memberships.company_id', tenant.company.id)
      .whereNull('memberships.deleted_at')
      .whereHas('user', (userQuery) => {
        userQuery.whereNull('users.deleted_at')
        if (params.search) {
          const term = `%${params.search.toLowerCase()}%`
          userQuery.where((sub) => {
            sub
              .whereRaw('lower(users.name) like ?', [term])
              .orWhereRaw('lower(users.email) like ?', [term])
          })
        }
      })
      .preload('user')
      .preload('role')

    if (sortColumn) {
      query.join('users', 'users.id', 'memberships.user_id')
      query.select('memberships.*')
      query.orderBy(sortColumn, sortDirection)
    } else {
      query.orderBy('memberships.id', 'asc')
    }

    const result = await query.paginate(page, perPage)

    return {
      data: result.all().map((membership) => this.serialize(membership)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
      },
    }
  }

  /** A single user of the active company, including extra permissions. */
  async show(tenant: TenantContext, userId: number) {
    const membership = await Membership.query()
      .where('company_id', tenant.company.id)
      .where('user_id', userId)
      .whereNull('deleted_at')
      .preload('user')
      .preload('role')
      .preload('extraPermissions')
      .first()

    if (!membership || membership.user.deletedAt) {
      throw new NotFoundException('Usuário não encontrado nesta empresa.')
    }

    return this.serialize(membership, true)
  }

  /**
   * Creates a user inside the active company. The e-mail is a global
   * identifier on the platform — duplicates are rejected, even across
   * companies.
   */
  async create(tenant: TenantContext, dto: CreateUserDTO) {
    return db.transaction(async (trx) => {
      const existing = await User.query({ client: trx })
        .whereRaw('lower(email) = ?', [dto.email.toLowerCase()])
        .whereNull('deleted_at')
        .first()

      if (existing) {
        throw new BusinessException(
          'Não é permitido criar um novo usuário com o e-mail de um usuário já existente.'
        )
      }

      const user = await User.create(
        {
          name: dto.name,
          email: dto.email,
          password: dto.password,
          isActive: dto.isActive ?? true,
        },
        { client: trx }
      )

      const membership = await Membership.create(
        {
          userId: user.id,
          companyId: tenant.company.id,
          roleId: dto.roleId,
          isActive: dto.isActive ?? true,
        },
        { client: trx }
      )

      membership.useTransaction(trx)
      if (dto.extraPermissions?.length) {
        await membership.related('extraPermissions').sync(dto.extraPermissions)
      }

      await membership.load('user')
      await membership.load('role')
      return this.serialize(membership)
    })
  }

  async update(
    tenant: TenantContext,
    userId: number,
    dto: UpdateUserDTO,
    currentUserId: number
  ) {
    return db.transaction(async (trx) => {
      const membership = await Membership.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('user_id', userId)
        .whereNull('deleted_at')
        .preload('user')
        .first()

      if (!membership) {
        throw new NotFoundException('Usuário não encontrado nesta empresa.')
      }

      const user = membership.user
      // ROOT só pode ser alterado por ele mesmo, e mesmo assim sem mexer em
      // perfil/status/extras — esses campos não fazem sentido para o ROOT.
      if (user.isRoot) {
        if (currentUserId !== user.id) {
          throw new BusinessException('Não é permitido alterar dados do usuário ROOT.')
        }
        if (dto.name !== undefined) user.name = dto.name
        if (dto.password !== undefined) user.password = dto.password
        user.useTransaction(trx)
        await user.save()
        await membership.load('role')
        return this.serialize(membership)
      }

      if (dto.name !== undefined) user.name = dto.name
      if (dto.password !== undefined) user.password = dto.password
      if (dto.isActive !== undefined) user.isActive = dto.isActive
      user.useTransaction(trx)
      await user.save()

      if (dto.roleId !== undefined) membership.roleId = dto.roleId
      if (dto.isActive !== undefined) membership.isActive = dto.isActive
      membership.useTransaction(trx)
      await membership.save()

      if (dto.extraPermissions !== undefined) {
        await membership.related('extraPermissions').sync(dto.extraPermissions)
      }

      await membership.load('role')
      return this.serialize(membership)
    })
  }

  /**
   * Lists users from another company that can be imported into the active
   * one. Excludes ROOT, soft-deleted accounts, and users that already have an
   * active membership in the tenant company.
   */
  async listImportable(tenant: TenantContext, sourceCompanyId: number, search?: string) {
    if (sourceCompanyId === tenant.company.id) {
      throw new BusinessException('Não é possível importar usuários da empresa logada.')
    }

    const sourceCompany = await Company.query()
      .where('id', sourceCompanyId)
      .where('is_active', true)
      .whereNull('deleted_at')
      .first()
    if (!sourceCompany) {
      throw new NotFoundException('Empresa de origem não encontrada.')
    }

    const alreadyHere = db
      .from('memberships')
      .where('company_id', tenant.company.id)
      .whereNull('deleted_at')
      .select('user_id')

    const query = Membership.query()
      .where('memberships.company_id', sourceCompanyId)
      .whereNull('memberships.deleted_at')
      .whereNotIn('memberships.user_id', alreadyHere)
      .whereHas('user', (userQuery) => {
        userQuery.whereNull('users.deleted_at').where('users.is_root', false)
        if (search) {
          const term = `%${search.toLowerCase()}%`
          userQuery.where((sub) => {
            sub
              .whereRaw('lower(users.name) like ?', [term])
              .orWhereRaw('lower(users.email) like ?', [term])
          })
        }
      })
      .preload('user')
      .join('users', 'users.id', 'memberships.user_id')
      .select('memberships.*')
      .orderBy('users.name', 'asc')

    const rows = await query

    return rows.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
    }))
  }

  /**
   * Imports an existing platform user into the active company by creating a
   * new membership. Does NOT touch the user record (name, e-mail, password).
   */
  async importExisting(tenant: TenantContext, dto: ImportUserDTO) {
    return db.transaction(async (trx) => {
      const user = await User.query({ client: trx })
        .where('id', dto.userId)
        .whereNull('deleted_at')
        .first()
      if (!user) {
        throw new NotFoundException('Usuário não encontrado.')
      }
      if (user.isRoot) {
        throw new BusinessException('Não é permitido importar o usuário ROOT.')
      }

      const hasMembershipElsewhere = await Membership.query({ client: trx })
        .where('user_id', user.id)
        .whereNot('company_id', tenant.company.id)
        .whereNull('deleted_at')
        .first()
      if (!hasMembershipElsewhere) {
        throw new BusinessException(
          'Este usuário não pertence a nenhuma outra empresa e não pode ser importado.'
        )
      }

      const existingHere = await Membership.query({ client: trx })
        .where('user_id', user.id)
        .where('company_id', tenant.company.id)
        .whereNull('deleted_at')
        .first()
      if (existingHere) {
        throw new BusinessException('Este usuário já está vinculado a esta empresa.')
      }

      const role = await Role.query({ client: trx })
        .where('id', dto.roleId)
        .where('company_id', tenant.company.id)
        .where('is_system', false)
        .first()
      if (!role) {
        throw new BusinessException('Perfil inválido para esta empresa.')
      }

      const membership = await Membership.create(
        {
          userId: user.id,
          companyId: tenant.company.id,
          roleId: role.id,
          isActive: dto.isActive ?? true,
        },
        { client: trx }
      )

      membership.useTransaction(trx)
      if (dto.extraPermissions?.length) {
        await membership.related('extraPermissions').sync(dto.extraPermissions)
      }

      await membership.load('user')
      await membership.load('role')
      await membership.load('extraPermissions')
      return this.serialize(membership, true)
    })
  }

  /** Removes a user from the active company (soft-deletes the membership). */
  async destroy(tenant: TenantContext, userId: number, currentUserId: number) {
    if (userId === currentUserId) {
      throw new BusinessException('Você não pode remover o seu próprio acesso.')
    }

    const membership = await membershipRepository.findMembership(userId, tenant.company.id)
    if (!membership) {
      throw new NotFoundException('Usuário não encontrado nesta empresa.')
    }

    await membership.load('user')
    if (membership.user.isRoot) {
      throw new BusinessException('Não é permitido remover o usuário ROOT.')
    }

    membership.isActive = false
    membership.deletedAt = DateTime.now()
    await membership.save()
  }

  private serialize(membership: Membership, withExtras = false) {
    return {
      id: membership.user.id,
      membershipId: membership.id,
      name: membership.user.name,
      email: membership.user.email,
      isRoot: membership.user.isRoot,
      isActive: membership.isActive && membership.user.isActive,
      lastLoginAt: membership.user.lastLoginAt?.toISO() ?? null,
      role: membership.role
        ? { id: membership.role.id, name: membership.role.name, slug: membership.role.slug }
        : null,
      extraPermissions: withExtras
        ? membership.extraPermissions.map((p) => ({ id: p.id, slug: p.slug, name: p.name }))
        : undefined,
      createdAt: membership.createdAt?.toISO() ?? null,
    }
  }
}

export default new UserService()
