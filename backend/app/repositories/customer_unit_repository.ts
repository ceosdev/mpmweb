import CustomerUnit from '#models/customer_unit'

/**
 * Data access for customer units. Always scoped by company AND parent region.
 */
export class CustomerUnitRepository {
  query(companyId: number, regionId: number) {
    return CustomerUnit.query().where('company_id', companyId).where('customer_region_id', regionId)
  }

  findById(companyId: number, regionId: number, id: number) {
    return this.query(companyId, regionId).where('id', id).first()
  }
}

export default new CustomerUnitRepository()
