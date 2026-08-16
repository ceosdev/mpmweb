import LdfParameter from '#models/ldf_parameter'
import type { TenantContext } from '#services/tenant_context'
import ldfParameterRepository from '#repositories/ldf_parameter_repository'
import expenseGroupRepository from '#repositories/expense_group_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  /** Exact match on the row id — what the UI calls "código". */
  code?: number
  description?: string
  expenseGroupId?: number
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateLdfParameterDTO {
  description: string
  expenseGroupId: number
  isActive?: boolean
}

export interface UpdateLdfParameterDTO {
  description?: string
  expenseGroupId?: number
  isActive?: boolean
}

/**
 * Use cases for the LDF Parameters module. All operations are scoped to the
 * active tenant; ROOT only differs in that it can be in any company.
 */
export class LdfParameterService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = ldfParameterRepository
      .query(tenant.company.id)
      .preload('expenseGroup')
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

    if (params.code) {
      query.where('id', params.code)
    }

    if (params.description) {
      const term = `%${params.description.toLowerCase()}%`
      query.whereRaw('lower(description) like ?', [term])
    }

    if (params.expenseGroupId) {
      query.where('expense_group_id', params.expenseGroupId)
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
    const row = await ldfParameterRepository
      .query(tenant.company.id)
      .where('id', id)
      .preload('expenseGroup')
      .first()
    if (!row) {
      throw new NotFoundException('Parametrização de LDF não encontrada.')
    }
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateLdfParameterDTO) {
    await this.assertExpenseGroupBelongsToTenant(tenant, dto.expenseGroupId)

    const row = await LdfParameter.create({
      companyId: tenant.company.id,
      expenseGroupId: dto.expenseGroupId,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    await row.load('expenseGroup')
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateLdfParameterDTO) {
    const row = await ldfParameterRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Parametrização de LDF não encontrada.')
    }

    if (dto.expenseGroupId !== undefined) {
      await this.assertExpenseGroupBelongsToTenant(tenant, dto.expenseGroupId)
      row.expenseGroupId = dto.expenseGroupId
    }
    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    await row.load('expenseGroup')

    return this.serialize(row)
  }

  /**
   * Hard-delete a parameter. If the row is referenced by another table (the
   * future LDF entries), the FK constraint raises — translated to a 409 with a
   * user-friendly message.
   */
  async destroy(tenant: TenantContext, id: number) {
    const row = await ldfParameterRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Parametrização de LDF não encontrada.')
    }

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir esta parametrização de LDF porque está em uso.'
        )
      }
      throw error
    }
  }

  /** Guards that the chosen expense group exists and belongs to the tenant. */
  private async assertExpenseGroupBelongsToTenant(tenant: TenantContext, expenseGroupId: number) {
    const group = await expenseGroupRepository.findById(tenant.company.id, expenseGroupId)
    if (!group) throw new BusinessException('Grupo de despesa inválido.')
  }

  private serialize(row: LdfParameter) {
    return {
      id: row.id,
      expenseGroupId: row.expenseGroupId,
      expenseGroupDescription: row.expenseGroup?.description ?? null,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

/** PostgreSQL foreign-key violation. */
function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new LdfParameterService()
