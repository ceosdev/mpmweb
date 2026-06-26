import Product from '#models/product'

/**
 * Data access for products. Always scoped by company — callers must pass the
 * active tenant's company id.
 */
export class ProductRepository {
  query(companyId: number) {
    return Product.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ProductRepository()
