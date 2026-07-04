import Brand from '#models/brand'

/**
 * Data access for marcas. Always scoped by company.
 */
export class BrandRepository {
  query(companyId: number) {
    return Brand.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new BrandRepository()
