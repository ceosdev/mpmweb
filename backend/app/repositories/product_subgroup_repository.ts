import ProductSubgroup from '#models/product_subgroup'

/**
 * Data access for product subgroups. Always scoped by company AND parent group.
 */
export class ProductSubgroupRepository {
  query(companyId: number, productGroupId: number) {
    return ProductSubgroup.query()
      .where('company_id', companyId)
      .where('product_group_id', productGroupId)
  }

  findById(companyId: number, productGroupId: number, id: number) {
    return this.query(companyId, productGroupId).where('id', id).first()
  }
}

export default new ProductSubgroupRepository()
