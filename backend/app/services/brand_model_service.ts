import BrandModel from '#models/brand_model'
import type { TenantContext } from '#services/tenant_context'
import brandModelRepository from '#repositories/brand_model_repository'
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

export interface CreateBrandModelDTO {
  description: string
  isActive?: boolean
}

export interface UpdateBrandModelDTO {
  description?: string
  isActive?: boolean
}

export class BrandModelService {
  /**
   * Ensures the parent brand exists in the active tenant. Returns 404 with a
   * neutral message — does NOT leak whether the id is invalid vs. belongs to
   * another company.
   */
  private async ensureParent(tenant: TenantContext, brandId: number) {
    const parent = await brandRepository.findById(tenant.company.id, brandId)
    if (!parent) throw new NotFoundException('Marca não encontrada.')
    return parent
  }

  async list(tenant: TenantContext, brandId: number, params: ListParams) {
    await this.ensureParent(tenant, brandId)

    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = brandModelRepository
      .query(tenant.company.id, brandId)
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

  async show(tenant: TenantContext, brandId: number, id: number) {
    const row = await brandModelRepository.findById(tenant.company.id, brandId, id)
    if (!row) throw new NotFoundException('Modelo não encontrado.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, brandId: number, dto: CreateBrandModelDTO) {
    await this.ensureParent(tenant, brandId)

    const row = await BrandModel.create({
      companyId: tenant.company.id,
      brandId,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, brandId: number, id: number, dto: UpdateBrandModelDTO) {
    const row = await brandModelRepository.findById(tenant.company.id, brandId, id)
    if (!row) throw new NotFoundException('Modelo não encontrado.')

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, brandId: number, id: number) {
    const row = await brandModelRepository.findById(tenant.company.id, brandId, id)
    if (!row) throw new NotFoundException('Modelo não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Não é possível excluir este modelo porque está em uso.')
      }
      throw error
    }
  }

  private serialize(row: BrandModel) {
    return {
      id: row.id,
      brandId: row.brandId,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new BrandModelService()
