import ReceivableSettlement from '#models/receivable_settlement'

/**
 * Data access for receivable settlements. Always scoped by company AND parent
 * receivable — callers must pass both.
 */
export class ReceivableSettlementRepository {
  query(companyId: number, receivableId: number) {
    return ReceivableSettlement.query()
      .where('company_id', companyId)
      .where('receivable_id', receivableId)
  }

  findById(companyId: number, receivableId: number, id: number) {
    return this.query(companyId, receivableId).where('id', id).first()
  }
}

export default new ReceivableSettlementRepository()
