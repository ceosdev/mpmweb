import ProductAsset from '#models/product_asset'

/**
 * Data access for product assets. Always scoped by company AND parent product.
 */
export class ProductAssetRepository {
  query(companyId: number, productId: number) {
    return ProductAsset.query().where('company_id', companyId).where('product_id', productId)
  }

  findById(companyId: number, productId: number, id: number) {
    return this.query(companyId, productId).where('id', id).first()
  }
}

export default new ProductAssetRepository()
