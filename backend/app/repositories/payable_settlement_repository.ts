import PayableSettlement from '#models/payable_settlement'

/**
 * Data access for payable settlements. Always scoped by company AND parent
 * payable — callers must pass both.
 */
export class PayableSettlementRepository {
  query(companyId: number, payableId: number) {
    return PayableSettlement.query()
      .where('company_id', companyId)
      .where('payable_id', payableId)
  }

  findById(companyId: number, payableId: number, id: number) {
    return this.query(companyId, payableId).where('id', id).first()
  }
}

export default new PayableSettlementRepository()
