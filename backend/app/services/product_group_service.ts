import ProductGroup from '#models/product_group'
import type { TenantContext } from '#services/tenant_context'
import productGroupRepository from '#repositories/product_group_repository'
import { ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

const SORT_COLUMNS: Record<string, string> = {
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateProductGroupDTO {
  description: string
  isActive?: boolean
}

export interface UpdateProductGroupDTO {
  description?: string
  isActive?: boolean
}

export class ProductGroupService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = productGroupRepository
      .query(tenant.company.id)
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

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
    const row = await productGroupRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Grupo de produto não encontrado.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateProductGroupDTO) {
    const row = await ProductGroup.create({
      companyId: tenant.company.id,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateProductGroupDTO) {
    const row = await productGroupRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Grupo de produto não encontrado.')

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await productGroupRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Grupo de produto não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este grupo de produto porque está em uso.'
        )
      }
      throw error
    }
  }

  private serialize(row: ProductGroup) {
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

export default new ProductGroupService()
