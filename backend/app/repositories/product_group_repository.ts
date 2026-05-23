import ProductGroup from '#models/product_group'

/**
 * Data access for product groups. Always scoped by company — callers must
 * pass the active tenant's company id.
 */
export class ProductGroupRepository {
  query(companyId: number) {
    return ProductGroup.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ProductGroupRepository()
