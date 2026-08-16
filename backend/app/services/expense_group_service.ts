import ExpenseGroup from '#models/expense_group'
import type { TenantContext } from '#services/tenant_context'
import expenseGroupRepository from '#repositories/expense_group_repository'
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

/** Columns the listing is allowed to sort by. */
const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateExpenseGroupDTO {
  description: string
  isActive?: boolean
}

export interface UpdateExpenseGroupDTO {
  description?: string
  isActive?: boolean
}

/**
 * Use cases for the Expense Groups module. All operations are scoped to the
 * active tenant; ROOT only differs in that it can be in any company.
 */
export class ExpenseGroupService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = expenseGroupRepository
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
    const row = await expenseGroupRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Grupo de despesa não encontrado.')
    }
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateExpenseGroupDTO) {
    const row = await ExpenseGroup.create({
      companyId: tenant.company.id,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateExpenseGroupDTO) {
    const row = await expenseGroupRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Grupo de despesa não encontrado.')
    }

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()

    return this.serialize(row)
  }

  /**
   * Hard-delete an expense group. If the row is referenced by another table
   * (future associations), the FK constraint will raise — translated to a
   * 409 with a user-friendly message.
   */
  async destroy(tenant: TenantContext, id: number) {
    const row = await expenseGroupRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Grupo de despesa não encontrado.')
    }

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este grupo de despesa porque está em uso.'
        )
      }
      throw error
    }
  }

  private serialize(row: ExpenseGroup) {
    return {
      id: row.id,
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

export default new ExpenseGroupService()
