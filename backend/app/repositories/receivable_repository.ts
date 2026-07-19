import Receivable from '#models/receivable'

/**
 * Data access for receivables. Always scoped by company — callers must pass the
 * active tenant's company id.
 */
export class ReceivableRepository {
  query(companyId: number) {
    return Receivable.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ReceivableRepository()
