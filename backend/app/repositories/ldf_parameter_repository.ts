import LdfParameter from '#models/ldf_parameter'

/**
 * Data access for parametrizações de LDF. Always scoped by company.
 */
export class LdfParameterRepository {
  query(companyId: number) {
    return LdfParameter.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new LdfParameterRepository()
