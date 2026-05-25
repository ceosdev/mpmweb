import { DateTime } from 'luxon'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Company from '#models/company'
import User from '#models/user'
import Role from '#models/role'
import Membership from '#models/membership'
import type { TenantContext } from '#services/tenant_context'
import companyRepository from '#repositories/company_repository'
import { slugify } from '#utils/slug'
import { BusinessException, ForbiddenException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const COMPANY_SORT_COLUMNS: Record<string, string> = {
  legal_name: 'legal_name',
  trade_name: 'trade_name',
  tax_id: 'tax_id',
  is_active: 'is_active',
  created_at: 'created_at',
}

const LOGO_DISK = 'fs'
const LOGO_KEY_PREFIX = 'logos'
/** URL prefix served by drive (`routeBasePath` in config/drive.ts). */
const LOGO_URL_PREFIX = '/uploads'

export interface CreateCompanyDTO {
  legalName: string
  tradeName?: string
  taxId?: string
  stateRegistration?: string
  municipalRegistration?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  state?: string
  phone?: string
  email?: string
  slug?: string
  isActive?: boolean
}

export interface UpdateCompanyDTO {
  legalName?: string
  tradeName?: string
  taxId?: string
  stateRegistration?: string
  municipalRegistration?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  state?: string
  phone?: string
  email?: string
  isActive?: boolean
}

/**
 * Use cases for the Companies module. Root users manage every company; other
 * roles can only see and edit the company they are currently in.
 */
export class CompanyService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && COMPANY_SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = companyRepository
      .query()
      .orderBy(sortColumn ?? 'legal_name', sortColumn ? sortDirection : 'asc')

    // Non-root users only ever see their own company.
    if (!tenant.isRoot) {
      query.where('id', tenant.company.id)
    }

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`
      query.where((sub) => {
        sub
          .whereRaw('lower(legal_name) like ?', [term])
          .orWhereRaw("lower(coalesce(trade_name, '')) like ?", [term])
      })
    }

    const result = await query.paginate(page, perPage)
    return {
      data: result.all().map((company) => this.serialize(company)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
      },
    }
  }

  async show(tenant: TenantContext, id: number) {
    this.assertVisible(tenant, id)
    const company = await companyRepository.findById(id)
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.')
    }
    return this.serialize(company)
  }

  async create(dto: CreateCompanyDTO) {
    // ROOT precisa existir como usuário e perfil — a nova empresa nasce com o
    // ROOT já vinculado, então sem essas duas pré-condições não dá pra criar.
    const rootRole = await Role.query()
      .where('slug', 'root')
      .where('is_system', true)
      .first()
    if (!rootRole) {
      throw new BusinessException(
        'Não é possível criar uma empresa: o perfil ROOT não está cadastrado.'
      )
    }
    const rootUser = await User.query().where('is_root', true).whereNull('deleted_at').first()
    if (!rootUser) {
      throw new BusinessException(
        'Não é possível criar uma empresa: o usuário ROOT não está cadastrado.'
      )
    }

    const slug = await this.uniqueSlug(dto.slug || dto.tradeName || dto.legalName)

    return db.transaction(async (trx) => {
      const company = await Company.create(
        {
          legalName: dto.legalName,
          tradeName: dto.tradeName ?? null,
          taxId: dto.taxId ?? null,
          stateRegistration: dto.stateRegistration ?? null,
          municipalRegistration: dto.municipalRegistration ?? null,
          address: dto.address ?? null,
          addressNumber: dto.addressNumber ?? null,
          neighborhood: dto.neighborhood ?? null,
          city: dto.city ?? null,
          zipCode: dto.zipCode ?? null,
          state: dto.state ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          slug,
          isActive: dto.isActive ?? true,
        },
        { client: trx }
      )

      await Membership.updateOrCreate(
        { userId: rootUser.id, companyId: company.id },
        { roleId: rootRole.id, isActive: true },
        { client: trx }
      )

      return this.serialize(company)
    })
  }

  async update(tenant: TenantContext, id: number, dto: UpdateCompanyDTO) {
    this.assertVisible(tenant, id)
    const company = await companyRepository.findById(id)
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.')
    }

    if (dto.legalName !== undefined) company.legalName = dto.legalName
    if (dto.tradeName !== undefined) company.tradeName = dto.tradeName || null
    if (dto.taxId !== undefined) company.taxId = dto.taxId || null
    if (dto.stateRegistration !== undefined)
      company.stateRegistration = dto.stateRegistration || null
    if (dto.municipalRegistration !== undefined)
      company.municipalRegistration = dto.municipalRegistration || null
    if (dto.address !== undefined) company.address = dto.address || null
    if (dto.addressNumber !== undefined) company.addressNumber = dto.addressNumber || null
    if (dto.neighborhood !== undefined) company.neighborhood = dto.neighborhood || null
    if (dto.city !== undefined) company.city = dto.city || null
    if (dto.zipCode !== undefined) company.zipCode = dto.zipCode || null
    if (dto.state !== undefined) company.state = dto.state || null
    if (dto.phone !== undefined) company.phone = dto.phone || null
    if (dto.email !== undefined) company.email = dto.email || null
    if (dto.isActive !== undefined) company.isActive = dto.isActive
    await company.save()

    return this.serialize(company)
  }

  /**
   * Stores a new logo for the company, replacing any previous one.
   * The previous file is deleted best-effort; failures are logged but
   * do not roll back the save.
   */
  async setLogo(tenant: TenantContext, companyId: number, file: MultipartFile) {
    this.assertVisible(tenant, companyId)
    const company = await companyRepository.findById(companyId)
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.')
    }

    const ext = (file.extname || 'bin').toLowerCase()
    const key = `${LOGO_KEY_PREFIX}/${company.slug}-${Date.now()}.${ext}`
    const disk = drive.use(LOGO_DISK)

    await file.moveToDisk(key, LOGO_DISK)

    const previousKey = this.keyFromPath(company.logoPath)
    company.logoPath = `${LOGO_URL_PREFIX}/${key}`
    await company.save()

    if (previousKey) {
      disk.delete(previousKey).catch((error) => {
        logger.warn({ err: error, key: previousKey }, 'Failed to delete previous company logo')
      })
    }

    return this.serialize(company)
  }

  /** Clears the logo column and deletes the underlying file. */
  async removeLogo(tenant: TenantContext, companyId: number) {
    this.assertVisible(tenant, companyId)
    const company = await companyRepository.findById(companyId)
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.')
    }

    const previousKey = this.keyFromPath(company.logoPath)
    company.logoPath = null
    await company.save()

    if (previousKey) {
      drive
        .use(LOGO_DISK)
        .delete(previousKey)
        .catch((error) => {
          logger.warn({ err: error, key: previousKey }, 'Failed to delete company logo')
        })
    }

    return this.serialize(company)
  }

  /**
   * Companies available as the source of a user import — every active
   * company except the tenant's own. Returned as a slim list (id + names).
   */
  async listImportSources(tenant: TenantContext) {
    const companies = await companyRepository
      .listActive()
      .whereNot('id', tenant.company.id)
    return companies.map((company) => ({
      id: company.id,
      legalName: company.legalName,
      tradeName: company.tradeName,
    }))
  }

  /** Soft-deletes a company. The active company cannot be deleted. */
  async destroy(tenant: TenantContext, id: number) {
    if (id === tenant.company.id) {
      throw new BusinessException('Não é possível excluir a empresa que está ativa.')
    }

    const company = await companyRepository.findById(id)
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.')
    }

    company.isActive = false
    company.deletedAt = DateTime.now()
    await company.save()
  }

  private assertVisible(tenant: TenantContext, id: number) {
    if (!tenant.isRoot && id !== tenant.company.id) {
      throw new ForbiddenException('Você só pode acessar a sua própria empresa.')
    }
  }

  /** Builds a slug and appends a counter until it is unique. */
  private async uniqueSlug(base: string): Promise<string> {
    const root = slugify(base) || 'empresa'
    let candidate = root
    let counter = 2
    while (await companyRepository.findBySlug(candidate)) {
      candidate = `${root}-${counter}`
      counter += 1
    }
    return candidate
  }

  /** Extracts the drive key (`logos/abc.png`) from the stored path (`/uploads/logos/abc.png`). */
  private keyFromPath(logoPath: string | null): string | null {
    if (!logoPath) return null
    if (logoPath.startsWith(`${LOGO_URL_PREFIX}/`)) {
      return logoPath.slice(LOGO_URL_PREFIX.length + 1)
    }
    return logoPath
  }

  serialize(company: Company) {
    return {
      id: company.id,
      legalName: company.legalName,
      tradeName: company.tradeName,
      taxId: company.taxId,
      stateRegistration: company.stateRegistration,
      municipalRegistration: company.municipalRegistration,
      address: company.address,
      addressNumber: company.addressNumber,
      neighborhood: company.neighborhood,
      city: company.city,
      zipCode: company.zipCode,
      state: company.state,
      phone: company.phone,
      email: company.email,
      logoUrl: company.logoPath ?? null,
      slug: company.slug,
      isActive: company.isActive,
      createdAt: company.createdAt?.toISO() ?? null,
    }
  }
}

export default new CompanyService()
