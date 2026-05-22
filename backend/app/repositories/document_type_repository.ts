import DocumentType from '#models/document_type'

/**
 * Data access for document types. Always scoped by company — callers must
 * pass the active tenant's company id.
 */
export class DocumentTypeRepository {
  query(companyId: number) {
    return DocumentType.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new DocumentTypeRepository()
