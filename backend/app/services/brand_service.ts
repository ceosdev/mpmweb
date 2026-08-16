import Brand from '#models/brand'
import type { TenantContext } from '#services/tenant_context'
import brandRepository from '#repositories/brand_repository'
import { ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). Nunca editável, só pesquisável. */
  id?: number
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateBrandDTO {
  description: string
  isActive?: boolean
}

export interface UpdateBrandDTO {
  description?: string
  isActive?: boolean
}

export class BrandService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = brandRepository
      .query(tenant.company.id)
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

    if (params.id) query.where('id', params.id)


    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`
      query.whereRaw('lower(description) like ?', [term])
    }

    const result = await query.paginate(page, perPage)
    return {
      data: result.all().map((row) => this.serialize(row)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
      },
    }
  }

  async show(tenant: TenantContext, id: number) {
    const row = await brandRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Marca não encontrada.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateBrandDTO) {
    const row = await Brand.create({
      companyId: tenant.company.id,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateBrandDTO) {
    const row = await brandRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Marca não encontrada.')

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await brandRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Marca não encontrada.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir esta marca porque está em uso.'
        )
      }
      throw error
    }
  }

  private serialize(row: Brand) {
    return {
      id: row.id,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new BrandService()
