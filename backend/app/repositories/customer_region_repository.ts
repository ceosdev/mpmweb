import CustomerRegion from '#models/customer_region'

/**
 * Data access for customer regions. Always scoped by company AND parent customer.
 */
export class CustomerRegionRepository {
  query(companyId: number, customerId: number) {
    return CustomerRegion.query().where('company_id', companyId).where('customer_id', customerId)
  }

  findById(companyId: number, customerId: number, id: number) {
    return this.query(companyId, customerId).where('id', id).first()
  }
}

export default new CustomerRegionRepository()
