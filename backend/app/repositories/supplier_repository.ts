import Supplier from '#models/supplier'

/**
 * Data access for suppliers. Always scoped by company — callers must pass the
 * active tenant's company id.
 */
export class SupplierRepository {
  query(companyId: number) {
    return Supplier.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new SupplierRepository()
