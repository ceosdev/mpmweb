import BrandModel from '#models/brand_model'

/**
 * Data access for brand models. Always scoped by company AND parent brand.
 */
export class BrandModelRepository {
  query(companyId: number, brandId: number) {
    return BrandModel.query().where('company_id', companyId).where('brand_id', brandId)
  }

  findById(companyId: number, brandId: number, id: number) {
    return this.query(companyId, brandId).where('id', id).first()
  }
}

export default new BrandModelRepository()
