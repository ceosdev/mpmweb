import ProductSubgroup from '#models/product_subgroup'
import type { TenantContext } from '#services/tenant_context'
import productSubgroupRepository from '#repositories/product_subgroup_repository'
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

export interface CreateProductSubgroupDTO {
  description: string
  isActive?: boolean
}

export interface UpdateProductSubgroupDTO {
  description?: string
  isActive?: boolean
}

export class ProductSubgroupService {
  /**
   * Ensures the parent group exists in the active tenant. Returns 404 with a
   * neutral message — does NOT leak whether the id is invalid vs. belongs to
   * another company.
   */
  private async ensureParent(tenant: TenantContext, productGroupId: number) {
    const parent = await productGroupRepository.findById(tenant.company.id, productGroupId)
    if (!parent) throw new NotFoundException('Grupo de produto não encontrado.')
    return parent
  }

  async list(tenant: TenantContext, productGroupId: number, params: ListParams) {
    await this.ensureParent(tenant, productGroupId)

    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = productSubgroupRepository
      .query(tenant.company.id, productGroupId)
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

  async show(tenant: TenantContext, productGroupId: number, id: number) {
    const row = await productSubgroupRepository.findById(
      tenant.company.id,
      productGroupId,
      id
    )
    if (!row) throw new NotFoundException('Subgrupo de produto não encontrado.')
    return this.serialize(row)
  }

  async create(
    tenant: TenantContext,
    productGroupId: number,
    dto: CreateProductSubgroupDTO
  ) {
    await this.ensureParent(tenant, productGroupId)

    const row = await ProductSubgroup.create({
      companyId: tenant.company.id,
      productGroupId,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(
    tenant: TenantContext,
    productGroupId: number,
    id: number,
    dto: UpdateProductSubgroupDTO
  ) {
    const row = await productSubgroupRepository.findById(
      tenant.company.id,
      productGroupId,
      id
    )
    if (!row) throw new NotFoundException('Subgrupo de produto não encontrado.')

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, productGroupId: number, id: number) {
    const row = await productSubgroupRepository.findById(
      tenant.company.id,
      productGroupId,
      id
    )
    if (!row) throw new NotFoundException('Subgrupo de produto não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este subgrupo de produto porque está em uso.'
        )
      }
      throw error
    }
  }

  private serialize(row: ProductSubgroup) {
    return {
      id: row.id,
      productGroupId: row.productGroupId,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new ProductSubgroupService()
