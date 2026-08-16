import ExpenseGroup from '#models/expense_group'

/**
 * Data access for grupos de despesa. Always scoped by company.
 */
export class ExpenseGroupRepository {
  query(companyId: number) {
    return ExpenseGroup.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }
}

export default new ExpenseGroupRepository()
