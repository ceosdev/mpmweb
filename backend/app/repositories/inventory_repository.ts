import Inventory from '#models/inventory'

/**
 * Data access for inventories. Always scoped by company — callers must pass
 * the active tenant's company id.
 */
export class InventoryRepository {
  query(companyId: number) {
    return Inventory.query().where('company_id', companyId)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }

  async hasOpen(companyId: number): Promise<boolean> {
    const row = await this.query(companyId).where('status', 'open').first()
    return row !== null
  }
}

export default new InventoryRepository()
