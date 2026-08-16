import ServiceEntry from '#models/service_entry'

/**
 * Data access for service entries. Always scoped by company — callers must pass
 * the active tenant's company id.
 */
export class ServiceEntryRepository {
  query(companyId: number) {
    return ServiceEntry.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ServiceEntryRepository()
