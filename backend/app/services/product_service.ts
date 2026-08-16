import Product, { type ProductType } from '#models/product'
import type { TenantContext } from '#services/tenant_context'
import productRepository from '#repositories/product_repository'
import productGroupRepository from '#repositories/product_group_repository'
import unitOfMeasureRepository from '#repositories/unit_of_measure_repository'
import ProductSubgroup from '#models/product_subgroup'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). Nunca editável, só pesquisável. */
  id?: number
  description?: string
  productGroupId?: number
  type?: ProductType
  controlsStock?: boolean
  status?: 'all' | 'active' | 'inactive'
  lowStock?: boolean
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
  quantity_in_stock: 'quantity_in_stock',
  cost_price: 'cost_price',
  is_active: 'is_active',
  created_at: 'created_at',
}

export interface CreateProductDTO {
  description: string
  type: ProductType
  productGroupId?: number | null
  productSubgroupId?: number | null
  unitOfMeasureId?: number | null
  controlsStock?: boolean
  minimumStock?: number | null
  quantityInStock?: number | null
  costPrice?: number | null
  isActive?: boolean
}

export interface UpdateProductDTO {
  description?: string
  type?: ProductType
  productGroupId?: number | null
  productSubgroupId?: number | null
  unitOfMeasureId?: number | null
  controlsStock?: boolean
  minimumStock?: number | null
  // quantityInStock intentionally absent — immutable after create (strategy A).
  costPrice?: number | null
  isActive?: boolean
}

export class ProductService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = productRepository
      .query(tenant.company.id)
      .preload('group')
      .preload('unit')
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

    if (params.id) query.where('id', params.id)


    if (params.description) {
      const term = `%${params.description.toLowerCase()}%`
      query.whereRaw('lower(description) like ?', [term])
    }

    if (params.productGroupId) {
      query.where('product_group_id', params.productGroupId)
    }

    if (params.type) {
      query.where('type', params.type)
    }

    if (params.controlsStock !== undefined) {
      query.where('controls_stock', params.controlsStock)
    }

    if (params.status === 'active') {
      query.where('is_active', true)
    } else if (params.status === 'inactive') {
      query.where('is_active', false)
    }

    if (params.lowStock) {
      // Only stock-controlled products with a configured minimum and a balance
      // at or below it. Null balance counts as 0.
      query.whereRaw(
        'controls_stock = true and minimum_stock is not null and coalesce(quantity_in_stock, 0) <= minimum_stock'
      )
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
    const row = await productRepository
      .query(tenant.company.id)
      .where('id', id)
      .preload('group')
      .preload('unit')
      .first()
    if (!row) throw new NotFoundException('Produto não encontrado.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, dto: CreateProductDTO) {
    const groupId = dto.productGroupId ?? null
    const subgroupId = dto.productSubgroupId ?? null
    const unitId = dto.unitOfMeasureId ?? null

    await this.assertRelationsValid(tenant, groupId, subgroupId, unitId)

    // Fixed assets never control stock — enforced regardless of the payload.
    const controlsStock = dto.type === 'fixed_asset' ? false : (dto.controlsStock ?? false)
    const { minimumStock, quantityInStock } = this.normalizeStock(controlsStock, {
      minimumStock: dto.minimumStock ?? null,
      // On create, a stock-controlled product with no quantity starts at 0.
      quantityInStock: dto.quantityInStock ?? null,
      isCreate: true,
    })

    const row = await Product.create({
      companyId: tenant.company.id,
      description: dto.description,
      type: dto.type,
      productGroupId: groupId,
      productSubgroupId: subgroupId,
      unitOfMeasureId: unitId,
      controlsStock,
      minimumStock,
      quantityInStock,
      costPrice: dto.costPrice ?? null,
      isActive: dto.isActive ?? true,
    })
    await row.load('group')
    await row.load('unit')
    return this.serialize(row)
  }

  async update(tenant: TenantContext, id: number, dto: UpdateProductDTO) {
    const row = await productRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Produto não encontrado.')

    if (dto.description !== undefined) row.description = dto.description
    if (dto.type !== undefined) row.type = dto.type
    if (dto.productGroupId !== undefined) row.productGroupId = dto.productGroupId ?? null
    if (dto.productSubgroupId !== undefined) row.productSubgroupId = dto.productSubgroupId ?? null
    if (dto.unitOfMeasureId !== undefined) row.unitOfMeasureId = dto.unitOfMeasureId ?? null
    if (dto.costPrice !== undefined) row.costPrice = dto.costPrice ?? null
    if (dto.isActive !== undefined) row.isActive = dto.isActive
    if (dto.controlsStock !== undefined) row.controlsStock = dto.controlsStock
    if (dto.minimumStock !== undefined) row.minimumStock = dto.minimumStock ?? null

    // Re-validate the (possibly changed) relations against the tenant.
    await this.assertRelationsValid(
      tenant,
      row.productGroupId,
      row.productSubgroupId,
      row.unitOfMeasureId
    )

    // Fixed assets never control stock — enforced regardless of the payload.
    if (row.type === 'fixed_asset') row.controlsStock = false

    // Stock governance. quantityInStock is never touched here (strategy A);
    // when stock control is turned off, both stock fields are cleared.
    const { minimumStock, quantityInStock } = this.normalizeStock(row.controlsStock, {
      minimumStock: row.minimumStock,
      quantityInStock: row.quantityInStock,
      isCreate: false,
    })
    row.minimumStock = minimumStock
    row.quantityInStock = quantityInStock

    await row.save()
    await row.load('group')
    await row.load('unit')
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, id: number) {
    const row = await productRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Produto não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Não é possível excluir este produto porque está em uso.')
      }
      throw error
    }
  }

  /**
   * Validates that each provided FK exists, belongs to the active tenant, and
   * that the subgroup (when given) is consistent with the group.
   */
  private async assertRelationsValid(
    tenant: TenantContext,
    groupId: number | null,
    subgroupId: number | null,
    unitId: number | null
  ) {
    if (groupId !== null) {
      const group = await productGroupRepository.findById(tenant.company.id, groupId)
      if (!group) throw new BusinessException('Grupo de produto inválido.')
    }

    if (unitId !== null) {
      const unit = await unitOfMeasureRepository.findById(tenant.company.id, unitId)
      if (!unit) throw new BusinessException('Unidade de medida inválida.')
    }

    if (subgroupId !== null) {
      if (groupId === null) throw new BusinessException('Selecione o grupo do subgrupo.')
      const subgroup = await ProductSubgroup.query()
        .where('company_id', tenant.company.id)
        .where('id', subgroupId)
        .first()
      if (!subgroup) throw new BusinessException('Subgrupo de produto inválido.')
      if (subgroup.productGroupId !== groupId) {
        throw new BusinessException('Subgrupo não pertence ao grupo selecionado.')
      }
    }
  }

  /**
   * Stock governance driven by `controlsStock`:
   * - off → both stock fields forced to null.
   * - on (create only) → a missing quantity starts at 0.
   * - on (update) → quantity is left as-is (immutable; strategy A).
   */
  private normalizeStock(
    controlsStock: boolean,
    input: { minimumStock: number | null; quantityInStock: number | null; isCreate: boolean }
  ): { minimumStock: number | null; quantityInStock: number | null } {
    if (!controlsStock) {
      return { minimumStock: null, quantityInStock: null }
    }
    return {
      minimumStock: input.minimumStock,
      quantityInStock: input.isCreate ? (input.quantityInStock ?? 0) : input.quantityInStock,
    }
  }

  private serialize(row: Product) {
    return {
      id: row.id,
      description: row.description,
      type: row.type,
      productGroupId: row.productGroupId,
      groupDescription: row.group?.description ?? null,
      productSubgroupId: row.productSubgroupId,
      unitOfMeasureId: row.unitOfMeasureId,
      unitDescription: row.unit?.description ?? null,
      controlsStock: row.controlsStock,
      minimumStock: row.minimumStock,
      quantityInStock: row.quantityInStock,
      costPrice: row.costPrice,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new ProductService()
