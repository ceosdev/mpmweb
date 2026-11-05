import { pickSort } from '#utils/sort'
import CustomerUnit from '#models/customer_unit'
import type { TenantContext } from '#services/tenant_context'
import customerUnitRepository from '#repositories/customer_unit_repository'
import customerRegionRepository from '#repositories/customer_region_repository'
import customerRegionService from '#services/customer_region_service'
import { ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). Nunca editável, só pesquisável. */
  id?: number
  search?: string
  /** `active` | `inactive` | `all`; ausente = sem filtro (como Clientes). */
  status?: 'all' | 'active' | 'inactive'
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

export interface CreateCustomerUnitDTO {
  description: string
  isActive?: boolean
}

export interface UpdateCustomerUnitDTO {
  description?: string
  isActive?: boolean
}

export class CustomerUnitService {
  /**
   * Validates the whole parent chain from the path: the customer in the
   * active tenant, then the region **of that customer**. Both answer 404
   * with a neutral message.
   */
  private async ensureParents(tenant: TenantContext, customerId: number, regionId: number) {
    await customerRegionService.ensureParent(tenant, customerId)
    const region = await customerRegionRepository.findById(tenant.company.id, customerId, regionId)
    if (!region) throw new NotFoundException('Regional não encontrada.')
    return region
  }

  async list(tenant: TenantContext, customerId: number, regionId: number, params: ListParams) {
    await this.ensureParents(tenant, customerId, regionId)

    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = pickSort(SORT_COLUMNS, params.sort)
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = customerUnitRepository
      .query(tenant.company.id, regionId)
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

    if (params.id) query.where('id', params.id)

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`
      query.whereRaw('lower(description) like ?', [term])
    }

    if (params.status === 'active') {
      query.where('is_active', true)
    } else if (params.status === 'inactive') {
      query.where('is_active', false)
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

  async show(tenant: TenantContext, customerId: number, regionId: number, id: number) {
    const row = await this.findOrFail(tenant, customerId, regionId, id)
    return this.serialize(row)
  }

  async create(
    tenant: TenantContext,
    customerId: number,
    regionId: number,
    dto: CreateCustomerUnitDTO
  ) {
    await this.ensureParents(tenant, customerId, regionId)

    const row = await CustomerUnit.create({
      companyId: tenant.company.id,
      customerRegionId: regionId,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(
    tenant: TenantContext,
    customerId: number,
    regionId: number,
    id: number,
    dto: UpdateCustomerUnitDTO
  ) {
    const row = await this.findOrFail(tenant, customerId, regionId, id)

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, customerId: number, regionId: number, id: number) {
    const row = await this.findOrFail(tenant, customerId, regionId, id)

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Não é possível excluir esta unidade porque está em uso.')
      }
      throw error
    }
  }

  private async findOrFail(
    tenant: TenantContext,
    customerId: number,
    regionId: number,
    id: number
  ) {
    await this.ensureParents(tenant, customerId, regionId)
    const row = await customerUnitRepository.findById(tenant.company.id, regionId, id)
    if (!row) throw new NotFoundException('Unidade não encontrada.')
    return row
  }

  private serialize(row: CustomerUnit) {
    return {
      id: row.id,
      customerRegionId: row.customerRegionId,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
  )
}

export default new CustomerUnitService()
