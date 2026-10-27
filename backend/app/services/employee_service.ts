import { DateTime } from 'luxon'
import Employee from '#models/employee'
import type { TenantContext } from '#services/tenant_context'
import employeeRepository from '#repositories/employee_repository'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { digitsOnly, isValidCpf } from '#utils/tax_id'
import { todayIso } from '#utils/dates'
import { LOOKUP_DEFAULT_LIMIT, lookupCodeId, type LookupParams } from '#utils/lookup'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  name?: string
  taxId?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  name: 'name',
  tax_id: 'tax_id',
  role_title: 'role_title',
  is_active: 'is_active',
}

const TAX_ID_UNIQUE_INDEX = 'employees_company_tax_id_uq'

/**
 * Optional fields: `undefined` = not sent (untouched on update), `null` = cleared.
 * Dates arrive as `Date` from VineJS.
 */
export interface UpdateEmployeeDTO {
  name?: string
  roleTitle?: string | null
  birthDate?: Date | null
  taxId?: string | null
  idNumber?: string | null
  workCard?: string | null
  pis?: string | null
  driverLicense?: string | null
  address?: string | null
  addressNumber?: string | null
  addressComplement?: string | null
  neighborhood?: string | null
  city?: string | null
  zipCode?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  hiredAt?: Date | null
  terminatedAt?: Date | null
  isActive?: boolean
}

export interface CreateEmployeeDTO extends UpdateEmployeeDTO {
  name: string
}

/** Plain text fields copied as-is (empty → null). */
const TEXT_FIELDS = [
  'roleTitle',
  'idNumber',
  'workCard',
  'pis',
  'driverLicense',
  'address',
  'addressNumber',
  'addressComplement',
  'neighborhood',
  'city',
  'zipCode',
  'phone',
  'mobile',
  'email',
] as const

const DATE_FIELDS = ['birthDate', 'hiredAt', 'terminatedAt'] as const

export class EmployeeService {
  /**
   * Feeds the EntityPicker (see `CustomerService.lookup`).
   * - `ids` — hydration; resolves ids **regardless of `is_active`**.
   * - `q` — search by name or code; active employees only.
   */
  async lookup(tenant: TenantContext, params: LookupParams) {
    if (params.ids && params.ids.length > 0) {
      const rows = await employeeRepository
        .query(tenant.company.id)
        .whereIn('id', params.ids)
        .orderBy('name', 'asc')

      return { data: rows.map((row) => this.serializeLookup(row)), hasMore: false }
    }

    const term = params.q?.trim()
    if (!term) {
      throw new BusinessException('Informe um termo de busca ou uma lista de códigos.')
    }

    const limit = params.limit ?? LOOKUP_DEFAULT_LIMIT
    const like = `%${term.toLowerCase()}%`
    const codeId = lookupCodeId(term)

    const rows = await employeeRepository
      .query(tenant.company.id)
      .where('is_active', true)
      .where((sub) => {
        sub.whereRaw('lower(name) like ?', [like])
        if (codeId !== null) sub.orWhere('id', codeId)
      })
      .orderBy('name', 'asc')
      .limit(limit + 1)

    return {
      data: rows.slice(0, limit).map((row) => this.serializeLookup(row)),
      hasMore: rows.length > limit,
    }
  }

  private serializeLookup(row: Employee) {
    return { id: row.id, name: row.name, roleTitle: row.roleTitle, isActive: row.isActive }
  }

  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = employeeRepository
      .query(tenant.company.id)
      .orderBy(sortColumn ?? 'name', sortColumn ? sortDirection : 'asc')

    if (params.id) query.where('id', params.id)

    if (params.name) {
      query.whereRaw('lower(name) like ?', [`%${params.name.toLowerCase()}%`])
    }

    if (params.taxId) {
      const digits = digitsOnly(params.taxId)
      if (digits.length > 0) query.where('tax_id', 'like', `%${digits}%`)
    }

    // Default = active only, as the spec asks; `all` lifts the filter.
    const status = params.status ?? 'active'
    if (status === 'active') {
      query.where('is_active', true)
    } else if (status === 'inactive') {
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
    const row = await this.findOrFail(tenant, id)
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateEmployeeDTO) {
    const row = new Employee()
    row.companyId = tenant.company.id
    row.isActive = true
    // Start every optional field at null so the response always carries the full shape.
    row.taxId = null
    for (const field of TEXT_FIELDS) row[field] = null
    for (const field of DATE_FIELDS) row[field] = null
    await this.apply(tenant, row, dto)
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateEmployeeDTO) {
    const row = await this.findOrFail(tenant, id)
    await this.apply(tenant, row, dto)
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await this.findOrFail(tenant, id)

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir este funcionário porque está em uso.'
        )
      }
      throw error
    }
  }

  private async findOrFail(tenant: TenantContext, id: number) {
    const row = await employeeRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Funcionário não encontrado.')
    return row
  }

  /**
   * Merges the payload onto the row, checks the rules against the **resulting**
   * values (an update sending only `terminatedAt` still compares with the stored
   * `hiredAt`) and saves.
   */
  private async apply(tenant: TenantContext, row: Employee, dto: UpdateEmployeeDTO) {
    if (dto.name !== undefined) row.name = dto.name
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    for (const field of TEXT_FIELDS) {
      if (dto[field] !== undefined) row[field] = dto[field] || null
    }
    for (const field of DATE_FIELDS) {
      const value = dto[field]
      if (value !== undefined) row[field] = value ? DateTime.fromJSDate(value) : null
    }
    if (dto.taxId !== undefined) row.taxId = this.normalizeTaxId(dto.taxId)

    const birthDate = row.birthDate?.toISODate()
    if (birthDate && birthDate > todayIso()) {
      throw new BusinessException('A data de nascimento não pode ser futura.')
    }

    const hiredAt = row.hiredAt?.toISODate()
    const terminatedAt = row.terminatedAt?.toISODate()
    if (hiredAt && terminatedAt && terminatedAt < hiredAt) {
      throw new BusinessException(
        'A data de demissão não pode ser anterior à data de admissão.'
      )
    }

    if (row.taxId) {
      const other = await employeeRepository.findByTaxId(
        tenant.company.id,
        row.taxId,
        row.$isPersisted ? row.id : undefined
      )
      if (other) throw duplicateTaxId()
    }

    try {
      await row.save()
    } catch (error) {
      // Two concurrent saves can both pass the lookup above; the partial index catches the loser.
      if (isUniqueViolation(error, TAX_ID_UNIQUE_INDEX)) throw duplicateTaxId()
      throw error
    }
  }

  /** Masked or raw CPF → digits, `null` when empty; rejects a bad checksum. */
  private normalizeTaxId(value: string | null): string | null {
    const digits = digitsOnly(value)
    if (digits.length === 0) return null
    if (digits.length !== 11 || !isValidCpf(digits)) {
      throw new BusinessException('CPF inválido.')
    }
    return digits
  }

  private serialize(row: Employee) {
    return {
      id: row.id,
      name: row.name,
      roleTitle: row.roleTitle,
      birthDate: row.birthDate?.toISODate() ?? null,
      taxId: row.taxId,
      idNumber: row.idNumber,
      workCard: row.workCard,
      pis: row.pis,
      driverLicense: row.driverLicense,
      address: row.address,
      addressNumber: row.addressNumber,
      addressComplement: row.addressComplement,
      neighborhood: row.neighborhood,
      city: row.city,
      zipCode: row.zipCode,
      phone: row.phone,
      mobile: row.mobile,
      email: row.email,
      hiredAt: row.hiredAt?.toISODate() ?? null,
      terminatedAt: row.terminatedAt?.toISODate() ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
      updatedAt: row.updatedAt?.toISO() ?? null,
    }
  }
}

function duplicateTaxId() {
  return new BusinessException('Já existe um funcionário com este CPF.')
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code, constraint: name } = error as { code?: string; constraint?: string }
  return code === '23505' && name === constraint
}

export default new EmployeeService()
