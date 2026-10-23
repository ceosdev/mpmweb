import Product, { type ProductType } from '#models/product'
import db from '@adonisjs/lucid/services/db'
import type { TenantContext } from '#services/tenant_context'
import productRepository from '#repositories/product_repository'
import productGroupRepository from '#repositories/product_group_repository'
import unitOfMeasureRepository from '#repositories/unit_of_measure_repository'
import ProductSubgroup from '#models/product_subgroup'
import { LOOKUP_DEFAULT_LIMIT, lookupCodeId, type LookupParams } from '#utils/lookup'
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

/**
 * Ativos **disponíveis** do produto — é o "estoque" de um produto
 * `fixed_asset`, que não tem saldo próprio (a entrada de mercadoria cria um
 * ativo por unidade em vez de somar `quantity_in_stock`). Alocado ou vendido
 * não está em casa, por isso não conta. Subquery correlacionada, não `join`:
 * o `paginate` do Lucid conta linhas.
 */
const AVAILABLE_ASSETS_SQL = `(select count(*)
    from product_assets
   where product_assets.product_id = products.id
     and product_assets.company_id = products.company_id
     and product_assets.situation = 'available')`

/**
 * A coluna Estoque da listagem: saldo para consumível, ativos disponíveis para
 * ativo imobilizado. Ordena pela **mesma** expressão que exibe.
 */
const STOCK_SORT_SQL = `(case when products.type = 'fixed_asset'
    then ${AVAILABLE_ASSETS_SQL}
    else products.quantity_in_stock end)`

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  description: 'description',
  type: 'type',
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
  costPrice?: string | null
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
  costPrice?: string | null
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
      .select('products.*')
      .select(db.raw(`${AVAILABLE_ASSETS_SQL} as available_assets`))

    if (params.sort === 'quantity_in_stock') {
      // `sortDirection` já é 'asc' | 'desc' — nada do cliente entra cru na expressão.
      query.orderByRaw(`${STOCK_SORT_SQL} ${sortDirection} nulls last`)
    } else {
      query.orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')
    }

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
      .select('products.*')
      .select(db.raw(`${AVAILABLE_ASSETS_SQL} as available_assets`))
      .first()
    if (!row) throw new NotFoundException('Produto não encontrado.')
    return this.serialize(row)
  }

  /**
   * EntityPicker lookup (see `SupplierService.lookup`). `costPrice` is only
   * filled for users who may see cost; others get `null`.
   */
  async lookup(tenant: TenantContext, params: LookupParams) {
    const canSeeCost =
      tenant.can('products.view') ||
      tenant.can('goods_entries.create') ||
      tenant.can('goods_entries.edit')

    if (params.ids && params.ids.length > 0) {
      const rows = await productRepository
        .query(tenant.company.id)
        .whereIn('id', params.ids)
        .preload('unit')
        .orderBy('description', 'asc')

      return { data: rows.map((row) => this.serializeLookup(row, canSeeCost)), hasMore: false }
    }

    const term = params.q?.trim()
    if (!term) {
      throw new BusinessException('Informe um termo de busca ou uma lista de códigos.')
    }

    const limit = params.limit ?? LOOKUP_DEFAULT_LIMIT
    const like = `%${term.toLowerCase()}%`
    const codeId = lookupCodeId(term)

    const rows = await productRepository
      .query(tenant.company.id)
      .where('is_active', true)
      .where((sub) => {
        sub.whereRaw('lower(description) like ?', [like])
        if (codeId !== null) sub.orWhere('id', codeId)
      })
      .preload('unit')
      .orderBy('description', 'asc')
      .limit(limit + 1)

    return {
      data: rows.slice(0, limit).map((row) => this.serializeLookup(row, canSeeCost)),
      hasMore: rows.length > limit,
    }
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
      minimumStock: toDecimalString(minimumStock),
      quantityInStock: toDecimalString(quantityInStock),
      costPrice: dto.costPrice ?? null,
      isActive: dto.isActive ?? true,
    })
    // Via `show`: traz também a contagem de ativos disponíveis.
    return this.show(tenant, row.id)
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
    if (dto.minimumStock !== undefined) row.minimumStock = toDecimalString(dto.minimumStock ?? null)

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
      minimumStock: toNumberOrNull(row.minimumStock),
      quantityInStock: toNumberOrNull(row.quantityInStock),
      isCreate: false,
    })
    row.minimumStock = toDecimalString(minimumStock)
    // Quantity is immutable here: only cleared (never rewritten) so the
    // stored string is not reformatted.
    if (quantityInStock === null) row.quantityInStock = null

    await row.save()
    // Via `show`: traz também a contagem de ativos disponíveis.
    return this.show(tenant, row.id)
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

  private serializeLookup(row: Product, canSeeCost: boolean) {
    return {
      id: row.id,
      description: row.description,
      type: row.type,
      controlsStock: row.controlsStock,
      unitOfMeasure: row.unit?.description ?? null,
      costPrice: canSeeCost ? row.costPrice : null,
      isActive: row.isActive,
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
      minimumStock: toNumberOrNull(row.minimumStock),
      quantityInStock: toNumberOrNull(row.quantityInStock),
      // Só para `fixed_asset`: quantos ativos do produto estão disponíveis.
      availableAssets:
        row.type === 'fixed_asset'
          ? Number((row.$extras as { available_assets?: string | number }).available_assets ?? 0)
          : null,
      costPrice: row.costPrice,
      isActive: row.isActive,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

/** Quantities have 4 decimals; toFixed avoids exponent notation. */
function toDecimalString(value: number | null): string | null {
  return value === null ? null : value.toFixed(4)
}

function toNumberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value)
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new ProductService()
