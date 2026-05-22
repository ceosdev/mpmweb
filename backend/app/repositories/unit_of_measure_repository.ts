import UnitOfMeasure from '#models/unit_of_measure'

/**
 * Data access for units of measure. Always scoped by company — callers must
 * pass the active tenant's company id.
 */
export class UnitOfMeasureRepository {
  query(companyId: number) {
    return UnitOfMeasure.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new UnitOfMeasureRepository()
