import GoodsEntry from '#models/goods_entry'

/**
 * Data access for goods entries. Always scoped by company — callers must pass
 * the active tenant's company id.
 */
export class GoodsEntryRepository {
  query(companyId: number) {
    return GoodsEntry.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new GoodsEntryRepository()
