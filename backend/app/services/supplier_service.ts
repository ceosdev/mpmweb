import Supplier, { type SupplierType } from '#models/supplier'
import type { TenantContext } from '#services/tenant_context'
import supplierRepository from '#repositories/supplier_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { isValidTaxId } from '#utils/tax_id'

export interface ListParams {
  name?: string
  taxId?: string
  type?: SupplierType
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  tax_id: 'tax_id',
  type: 'type',
  city: 'city',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateSupplierDTO {
  taxId: string
  name: string
  type: SupplierType
  address?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  phone?: string
  mobile?: string
  contactName?: string
  isActive?: boolean
}

export interface UpdateSupplierDTO {
  taxId?: string
  name?: string
  type?: SupplierType
  address?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  phone?: string
  mobile?: string
  contactName?: string
  isActive?: boolean
}

export class SupplierService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = supplierRepository
      .query(tenant.company.id)
      .orderBy(sortColumn ?? 'name', sortColumn ? sortDirection : 'asc')

    if (params.name) {
      const term = `%${params.name.toLowerCase()}%`
      query.whereRaw('lower(name) like ?', [term])
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
    const row = await supplierRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Fornecedor não encontrado.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateSupplierDTO) {
    this.assertValidTaxId(dto.taxId)

    const row = await Supplier.create({
      companyId: tenant.company.id,
      taxId: dto.taxId,
      name: dto.name,
      type: dto.type,
      address: dto.address ?? null,
      neighborhood: dto.neighborhood ?? null,
      city: dto.city ?? null,
      zipCode: dto.zipCode ?? null,
      phone: dto.phone ?? null,
      mobile: dto.mobile ?? null,
      contactName: dto.contactName ?? null,
      isActive: dto.isActive ?? true,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateSupplierDTO) {
    const row = await supplierRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Fornecedor não encontrado.')

    if (dto.taxId !== undefined) {
      this.assertValidTaxId(dto.taxId)
      row.taxId = dto.taxId
    }
    if (dto.name !== undefined) row.name = dto.name
    if (dto.type !== undefined) row.type = dto.type
    if (dto.address !== undefined) row.address = dto.address || null
    if (dto.neighborhood !== undefined) row.neighborhood = dto.neighborhood || null
    if (dto.city !== undefined) row.city = dto.city || null
    if (dto.zipCode !== undefined) row.zipCode = dto.zipCode || null
    if (dto.phone !== undefined) row.phone = dto.phone || null
    if (dto.mobile !== undefined) row.mobile = dto.mobile || null
    if (dto.contactName !== undefined) row.contactName = dto.contactName || null
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await supplierRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Fornecedor não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este fornecedor porque está em uso.'
        )
      }
      throw error
    }
  }

  private assertValidTaxId(taxId: string) {
    if (!isValidTaxId(taxId)) {
      throw new BusinessException('CPF/CNPJ inválido.')
    }
  }

  private serialize(row: Supplier) {
    return {
      id: row.id,
      taxId: row.taxId,
      name: row.name,
      type: row.type,
      address: row.address,
      neighborhood: row.neighborhood,
      city: row.city,
      zipCode: row.zipCode,
      phone: row.phone,
      mobile: row.mobile,
      contactName: row.contactName,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new SupplierService()
