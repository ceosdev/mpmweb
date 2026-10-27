import GoodsExit from '#models/goods_exit'

/**
 * Data access for goods exits. Always scoped by company — callers must pass
 * the active tenant's company id.
 */
export class GoodsExitRepository {
  query(companyId: number) {
    return GoodsExit.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new GoodsExitRepository()
