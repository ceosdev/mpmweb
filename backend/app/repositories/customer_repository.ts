import Customer from '#models/customer'

/**
 * Data access for customers. Always scoped by company — callers must pass the
 * active tenant's company id.
 */
export class CustomerRepository {
  query(companyId: number) {
    return Customer.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new CustomerRepository()
