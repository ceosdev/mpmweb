import Service from '#models/service'

/**
 * Data access for services. Always scoped by company — callers must pass the
 * active tenant's company id.
 */
export class ServiceRepository {
  query(companyId: number) {
    return Service.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ServiceRepository()
