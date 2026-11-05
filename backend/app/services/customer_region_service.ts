import { pickSort } from '#utils/sort'
import CustomerRegion from '#models/customer_region'
import type { TenantContext } from '#services/tenant_context'
import customerRegionRepository from '#repositories/customer_region_repository'
import customerRepository from '#repositories/customer_repository'
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

export interface CreateCustomerRegionDTO {
  description: string
  isActive?: boolean
}

export interface UpdateCustomerRegionDTO {
  description?: string
  isActive?: boolean
}

export class CustomerRegionService {
  /**
   * Ensures the parent customer exists in the active tenant. Returns 404 with
   * a neutral message — does NOT leak whether the id is invalid vs. belongs
   * to another company. Public: the units service reuses it.
   */
  async ensureParent(tenant: TenantContext, customerId: number) {
    const parent = await customerRepository.findById(tenant.company.id, customerId)
    if (!parent) throw new NotFoundException('Cliente não encontrado.')
    return parent
  }

  async list(tenant: TenantContext, customerId: number, params: ListParams) {
    await this.ensureParent(tenant, customerId)

    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = pickSort(SORT_COLUMNS, params.sort)
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = customerRegionRepository
      .query(tenant.company.id, customerId)
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

  async show(tenant: TenantContext, customerId: number, id: number) {
    const row = await this.findOrFail(tenant, customerId, id)
    return this.serialize(row)
  }

  async create(tenant: TenantContext, customerId: number, dto: CreateCustomerRegionDTO) {
    await this.ensureParent(tenant, customerId)

    const row = await CustomerRegion.create({
      companyId: tenant.company.id,
      customerId,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(
    tenant: TenantContext,
    customerId: number,
    id: number,
    dto: UpdateCustomerRegionDTO
  ) {
    const row = await this.findOrFail(tenant, customerId, id)

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, customerId: number, id: number) {
    const row = await this.findOrFail(tenant, customerId, id)

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Não é possível excluir esta regional porque está em uso.')
      }
      throw error
    }
  }

  /**
   * Validates the customer first, then the region **of that customer** — a
   * region of another customer (even in the same company) answers 404.
   */
  private async findOrFail(tenant: TenantContext, customerId: number, id: number) {
    await this.ensureParent(tenant, customerId)
    const row = await customerRegionRepository.findById(tenant.company.id, customerId, id)
    if (!row) throw new NotFoundException('Regional não encontrada.')
    return row
  }

  private serialize(row: CustomerRegion) {
    return {
      id: row.id,
      customerId: row.customerId,
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

export default new CustomerRegionService()
