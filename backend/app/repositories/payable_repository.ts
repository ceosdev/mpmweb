import Payable from '#models/payable'

/**
 * Data access for payables. Always scoped by company — callers must pass the
 * active tenant's company id.
 */
export class PayableRepository {
  query(companyId: number) {
    return Payable.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new PayableRepository()
