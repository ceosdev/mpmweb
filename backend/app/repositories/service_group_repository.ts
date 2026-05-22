import ServiceGroup from '#models/service_group'

/**
 * Data access for service groups. Always scoped by company — callers must
 * pass the active tenant's company id.
 */
export class ServiceGroupRepository {
  query(companyId: number) {
    return ServiceGroup.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ServiceGroupRepository()
