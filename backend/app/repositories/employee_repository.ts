import Employee from '#models/employee'

/**
 * Data access for employees. Always scoped by company — callers must pass the
 * active tenant's company id.
 */
export class EmployeeRepository {
  query(companyId: number) {
    return Employee.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }

  /** Another employee of the company holding this CPF (`exceptId` skips the row being edited). */
  findByTaxId(companyId: number, taxId: string, exceptId?: number) {
    const query = this.query(companyId).where('tax_id', taxId)
    if (exceptId !== undefined) query.whereNot('id', exceptId)
    return query.first()
  }
}

export default new EmployeeRepository()
