import { DateTime } from 'luxon'
import Customer, { type CustomerType } from '#models/customer'
import type { TenantContext } from '#services/tenant_context'
import customerRepository from '#repositories/customer_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { isValidCnpj, isValidCpf } from '#utils/tax_id'

export interface ListParams {
  name?: string
  taxId?: string
  type?: CustomerType
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const SORT_COLUMNS: Record<string, string> = {
  legal_name: 'legal_name',
  trade_name: 'trade_name',
  tax_id: 'tax_id',
  type: 'type',
  city: 'city',
  is_active: 'is_active',
  customer_since: 'customer_since',
  created_at: 'created_at',
}

export interface CreateCustomerDTO {
  type: CustomerType
  legalName: string
  tradeName?: string
  taxId: string
  address?: string
  addressNumber?: string
  addressComplement?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  phone?: string
  mobile?: string
  email?: string
  customerSince?: Date
  contactName?: string
  isActive?: boolean
  isInternal?: boolean
}

export interface UpdateCustomerDTO {
  type?: CustomerType
  legalName?: string
  tradeName?: string
  taxId?: string
  address?: string
  addressNumber?: string
  addressComplement?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  phone?: string
  mobile?: string
  email?: string
  customerSince?: Date
  contactName?: string
  isActive?: boolean
  isInternal?: boolean
}

export class CustomerService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = customerRepository
      .query(tenant.company.id)
      .orderBy(sortColumn ?? 'legal_name', sortColumn ? sortDirection : 'asc')

    if (params.name) {
      const term = `%${params.name.toLowerCase()}%`
      query.where((sub) => {
        sub
          .whereRaw('lower(legal_name) like ?', [term])
          .orWhereRaw('lower(trade_name) like ?', [term])
      })
    }

    if (params.taxId) {
      const digits = params.taxId.replace(/\D/g, '')
      if (digits.length > 0) {
        query.where('tax_id', 'like', `%${digits}%`)
      }
    }

    if (params.type) {
      query.where('type', params.type)
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

  async show(tenant: TenantContext, id: number) {
    const row = await customerRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Cliente não encontrado.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateCustomerDTO) {
    this.assertTypeMatchesTaxId(dto.type, dto.taxId)

    const row = await Customer.create({
      companyId: tenant.company.id,
      type: dto.type,
      legalName: dto.legalName,
      tradeName: dto.tradeName ?? null,
      taxId: dto.taxId,
      address: dto.address ?? null,
      addressNumber: dto.addressNumber ?? null,
      addressComplement: dto.addressComplement ?? null,
      neighborhood: dto.neighborhood ?? null,
      city: dto.city ?? null,
      zipCode: dto.zipCode ?? null,
      phone: dto.phone ?? null,
      mobile: dto.mobile ?? null,
      email: dto.email ?? null,
      customerSince: dto.customerSince ? DateTime.fromJSDate(dto.customerSince) : DateTime.now(),
      contactName: dto.contactName ?? null,
      isActive: dto.isActive ?? true,
      isInternal: dto.isInternal ?? false,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateCustomerDTO) {
    const row = await customerRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Cliente não encontrado.')

    // Re-validate type↔taxId coherence using the resulting (new or existing) values.
    const nextType = dto.type ?? row.type
    const nextTaxId = dto.taxId ?? row.taxId
    if (dto.type !== undefined || dto.taxId !== undefined) {
      this.assertTypeMatchesTaxId(nextType, nextTaxId)
    }

    if (dto.type !== undefined) row.type = dto.type
    if (dto.legalName !== undefined) row.legalName = dto.legalName
    if (dto.tradeName !== undefined) row.tradeName = dto.tradeName || null
    if (dto.taxId !== undefined) row.taxId = dto.taxId
    if (dto.address !== undefined) row.address = dto.address || null
    if (dto.addressNumber !== undefined) row.addressNumber = dto.addressNumber || null
    if (dto.addressComplement !== undefined) row.addressComplement = dto.addressComplement || null
    if (dto.neighborhood !== undefined) row.neighborhood = dto.neighborhood || null
    if (dto.city !== undefined) row.city = dto.city || null
    if (dto.zipCode !== undefined) row.zipCode = dto.zipCode || null
    if (dto.phone !== undefined) row.phone = dto.phone || null
    if (dto.mobile !== undefined) row.mobile = dto.mobile || null
    if (dto.email !== undefined) row.email = dto.email || null
    if (dto.customerSince !== undefined) {
      row.customerSince = DateTime.fromJSDate(dto.customerSince)
    }
    if (dto.contactName !== undefined) row.contactName = dto.contactName || null
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    if (dto.isInternal !== undefined) row.isInternal = dto.isInternal
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await customerRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Cliente não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este cliente porque está em uso.'
        )
      }
      throw error
    }
  }

  private assertTypeMatchesTaxId(type: CustomerType, taxId: string) {
    if (type === 'individual') {
      if (taxId.length !== 11) {
        throw new BusinessException('CPF deve conter 11 dígitos.')
      }
      if (!isValidCpf(taxId)) {
        throw new BusinessException('CPF inválido.')
      }
      return
    }
    if (taxId.length !== 14) {
      throw new BusinessException('CNPJ deve conter 14 dígitos.')
    }
    if (!isValidCnpj(taxId)) {
      throw new BusinessException('CNPJ inválido.')
    }
  }

  private serialize(row: Customer) {
    return {
      id: row.id,
      type: row.type,
      legalName: row.legalName,
      tradeName: row.tradeName,
      taxId: row.taxId,
      address: row.address,
      addressNumber: row.addressNumber,
      addressComplement: row.addressComplement,
      neighborhood: row.neighborhood,
      city: row.city,
      zipCode: row.zipCode,
      phone: row.phone,
      mobile: row.mobile,
      email: row.email,
      customerSince: row.customerSince?.toISODate() ?? null,
      contactName: row.contactName,
      isActive: row.isActive,
      isInternal: row.isInternal,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new CustomerService()
