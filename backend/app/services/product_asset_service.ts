import ProductAsset, { type AssetSituation } from '#models/product_asset'
import type { TenantContext } from '#services/tenant_context'
import productAssetRepository from '#repositories/product_asset_repository'
import productRepository from '#repositories/product_repository'
import brandRepository from '#repositories/brand_repository'
import BrandModel from '#models/brand_model'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'

export interface ListParams {
  assetCode?: string
  description?: string
  situation?: AssetSituation
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/** Columns the listing is allowed to sort by, mapped to their SQL column. */
const SORT_COLUMNS: Record<string, string> = {
  description: 'description',
  asset_code: 'asset_code',
  situation: 'situation',
  created_at: 'created_at',
}

export interface CreateProductAssetDTO {
  description: string
  assetCode?: string | null
  brandId?: number | null
  brandModelId?: number | null
  manufactureYear?: string | null
  btu?: string | null
  situation?: AssetSituation
  equipmentExists?: boolean
  notes?: string | null
}

export interface UpdateProductAssetDTO {
  description?: string
  assetCode?: string | null
  brandId?: number | null
  brandModelId?: number | null
  manufactureYear?: string | null
  btu?: string | null
  situation?: AssetSituation
  equipmentExists?: boolean
  notes?: string | null
}

export class ProductAssetService {
  /**
   * Ensures the parent product exists in the active tenant AND is a fixed asset.
   * - not found / cross-tenant → 404 neutral (does not leak existence).
   * - found but `consumable` → 422 (a real product that just cannot own assets).
   */
  private async ensureParent(tenant: TenantContext, productId: number) {
    const parent = await productRepository.findById(tenant.company.id, productId)
    if (!parent) throw new NotFoundException('Produto não encontrado.')
    if (parent.type !== 'fixed_asset') {
      throw new BusinessException('Este produto não permite ativos.')
    }
    return parent
  }

  async list(tenant: TenantContext, productId: number, params: ListParams) {
    await this.ensureParent(tenant, productId)

    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    const sortDirection: 'asc' | 'desc' = params.order === 'desc' ? 'desc' : 'asc'

    const query = productAssetRepository
      .query(tenant.company.id, productId)
      .orderBy(sortColumn ?? 'description', sortColumn ? sortDirection : 'asc')

    if (params.assetCode) {
      const term = `%${params.assetCode.toLowerCase()}%`
      query.whereRaw('lower(asset_code) like ?', [term])
    }

    if (params.description) {
      const term = `%${params.description.toLowerCase()}%`
      query.whereRaw('lower(description) like ?', [term])
    }

    if (params.situation) {
      query.where('situation', params.situation)
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

  async show(tenant: TenantContext, productId: number, id: number) {
    await this.ensureParent(tenant, productId)
    const row = await productAssetRepository.findById(tenant.company.id, productId, id)
    if (!row) throw new NotFoundException('Ativo não encontrado.')
    return this.serialize(row)
  }

  async create(tenant: TenantContext, productId: number, dto: CreateProductAssetDTO) {
    await this.ensureParent(tenant, productId)

    const brandId = dto.brandId ?? null
    const brandModelId = dto.brandModelId ?? null
    await this.assertBrandRelations(tenant, brandId, brandModelId)

    const row = await ProductAsset.create({
      companyId: tenant.company.id,
      productId,
      description: dto.description,
      assetCode: dto.assetCode ?? null,
      brandId,
      brandModelId,
      manufactureYear: dto.manufactureYear ?? null,
      btu: dto.btu ?? null,
      situation: dto.situation ?? 'available',
      equipmentExists: dto.equipmentExists ?? false,
      notes: dto.notes ?? null,
    })
    return this.serialize(row)
  }

  async update(tenant: TenantContext, productId: number, id: number, dto: UpdateProductAssetDTO) {
    await this.ensureParent(tenant, productId)
    const row = await productAssetRepository.findById(tenant.company.id, productId, id)
    if (!row) throw new NotFoundException('Ativo não encontrado.')

    if (dto.description !== undefined) row.description = dto.description
    if (dto.assetCode !== undefined) row.assetCode = dto.assetCode ?? null
    if (dto.brandId !== undefined) row.brandId = dto.brandId ?? null
    if (dto.brandModelId !== undefined) row.brandModelId = dto.brandModelId ?? null
    if (dto.manufactureYear !== undefined) row.manufactureYear = dto.manufactureYear ?? null
    if (dto.btu !== undefined) row.btu = dto.btu ?? null
    if (dto.situation !== undefined) row.situation = dto.situation
    if (dto.equipmentExists !== undefined) row.equipmentExists = dto.equipmentExists
    if (dto.notes !== undefined) row.notes = dto.notes ?? null

    await this.assertBrandRelations(tenant, row.brandId, row.brandModelId)

    await row.save()
    return this.serialize(row)
  }

  async destroy(tenant: TenantContext, productId: number, id: number) {
    await this.ensureParent(tenant, productId)
    const row = await productAssetRepository.findById(tenant.company.id, productId, id)
    if (!row) throw new NotFoundException('Ativo não encontrado.')

    try {
      await row.delete()
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Não é possível excluir este ativo porque está em uso.')
      }
      throw error
    }
  }

  /**
   * Validates the brand / model FKs (when provided): each must exist in the
   * active tenant, and the model must belong to the chosen brand.
   */
  private async assertBrandRelations(
    tenant: TenantContext,
    brandId: number | null,
    brandModelId: number | null
  ) {
    if (brandId !== null) {
      const brand = await brandRepository.findById(tenant.company.id, brandId)
      if (!brand) throw new BusinessException('Marca inválida.')
    }

    if (brandModelId !== null) {
      if (brandId === null) throw new BusinessException('Selecione a marca do modelo.')
      const model = await BrandModel.query()
        .where('company_id', tenant.company.id)
        .where('id', brandModelId)
        .first()
      if (!model) throw new BusinessException('Modelo inválido.')
      if (model.brandId !== brandId) {
        throw new BusinessException('Modelo não pertence à marca selecionada.')
      }
    }
  }

  private serialize(row: ProductAsset) {
    return {
      id: row.id,
      productId: row.productId,
      description: row.description,
      assetCode: row.assetCode,
      brandId: row.brandId,
      brandModelId: row.brandModelId,
      manufactureYear: row.manufactureYear,
      btu: row.btu,
      situation: row.situation,
      equipmentExists: row.equipmentExists,
      notes: row.notes,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new ProductAssetService()
