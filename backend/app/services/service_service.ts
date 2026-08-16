import Service, { type ServiceType } from '#models/service'
import type { TenantContext } from '#services/tenant_context'
import serviceRepository from '#repositories/service_repository'
import serviceGroupRepository from '#repositories/service_group_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). Nunca editável, só pesquisável. */
  id?: number
  description?: string
  type?: ServiceType
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  description: 'description',
  type: 'type',
  suggested_value: 'suggested_value',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateServiceDTO {
  description: string
  serviceGroupId: number
  suggestedValue?: number
  type: ServiceType
  notes?: string
  isActive?: boolean
}

export interface UpdateServiceDTO {
  description?: string
  serviceGroupId?: number
  suggestedValue?: number
  type?: ServiceType
  notes?: string
  isActive?: boolean
}

export class ServiceService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = serviceRepository
      .query(tenant.company.id)
      .preload('group')
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

    if (params.id) query.where('id', params.id)


    if (params.description) {
      const term = `%${params.description.toLowerCase()}%`
      query.whereRaw('lower(description) like ?', [term])
    }

    if (params.type) {
      query.where('type', params.type)
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
    const row = await serviceRepository.query(tenant.company.id).where('id', id).preload('group').first()
    if (!row) throw new NotFoundException('Serviço não encontrado.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateServiceDTO) {
    await this.assertGroupBelongsToTenant(tenant, dto.serviceGroupId)

    const row = await Service.create({
      companyId: tenant.company.id,
      serviceGroupId: dto.serviceGroupId,
      description: dto.description,
      suggestedValue: dto.suggestedValue ?? null,
      type: dto.type,
      notes: dto.notes ?? null,
      isActive: dto.isActive ?? true,
    })
    await row.load('group')
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateServiceDTO) {
    const row = await serviceRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Serviço não encontrado.')

    if (dto.serviceGroupId !== undefined) {
      await this.assertGroupBelongsToTenant(tenant, dto.serviceGroupId)
      row.serviceGroupId = dto.serviceGroupId
    }
    if (dto.description !== undefined) row.description = dto.description
    if (dto.suggestedValue !== undefined) row.suggestedValue = dto.suggestedValue ?? null
    if (dto.type !== undefined) row.type = dto.type
    if (dto.notes !== undefined) row.notes = dto.notes || null
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    await row.load('group')
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await serviceRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Serviço não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Não é possível excluir este serviço porque está em uso.')
      }
      throw error
    }
  }

  /** Guards that the chosen group exists and belongs to the active tenant. */
  private async assertGroupBelongsToTenant(tenant: TenantContext, groupId: number) {
    const group = await serviceGroupRepository.findById(tenant.company.id, groupId)
    if (!group) throw new BusinessException('Grupo de serviço inválido.')
  }

  private serialize(row: Service) {
    return {
      id: row.id,
      serviceGroupId: row.serviceGroupId,
      groupDescription: row.group?.description ?? null,
      description: row.description,
      suggestedValue: row.suggestedValue,
      type: row.type,
      notes: row.notes,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new ServiceService()
