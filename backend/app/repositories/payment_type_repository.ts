import PaymentType from '#models/payment_type'

/**
 * Data access for payment types. Always scoped by company — callers must
 * pass the active tenant's company id.
 */
export class PaymentTypeRepository {
  /** Base query scoped to a single company. */
  query(companyId: number) {
    return PaymentType.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new PaymentTypeRepository()
