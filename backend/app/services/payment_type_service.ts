import PaymentType from '#models/payment_type'
import type { TenantContext } from '#services/tenant_context'
import paymentTypeRepository from '#repositories/payment_type_repository'
import { ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by. */
const SORT_COLUMNS: Record<string, string> = {
  description: 'description',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreatePaymentTypeDTO {
  description: string
  isActive?: boolean
}

export interface UpdatePaymentTypeDTO {
  description?: string
  isActive?: boolean
}

/**
 * Use cases for the Payment Types module. All operations are scoped to the
 * active tenant; ROOT only differs in that it can be in any company.
 */
export class PaymentTypeService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = paymentTypeRepository
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
    const row = await paymentTypeRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Tipo de pagamento não encontrado.')
    }
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreatePaymentTypeDTO) {
    const row = await PaymentType.create({
      companyId: tenant.company.id,
      description: dto.description,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdatePaymentTypeDTO) {
    const row = await paymentTypeRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Tipo de pagamento não encontrado.')
    }

    if (dto.description !== undefined) row.description = dto.description
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()

    return this.serialize(row)
  }

  /**
   * Hard-delete a payment type. If the row is referenced by another table
   * (future associations), the FK constraint will raise — translated to a
   * 409 with a user-friendly message.
   */
  async destroy(tenant: TenantContext, id: number) {
    const row = await paymentTypeRepository.findById(tenant.company.id, id)
    if (!row) {
      throw new NotFoundException('Tipo de pagamento não encontrado.')
    }

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este tipo de pagamento porque está em uso.'
        )
      }
      throw error
    }
  }

  private serialize(row: PaymentType) {
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

export default new PaymentTypeService()
