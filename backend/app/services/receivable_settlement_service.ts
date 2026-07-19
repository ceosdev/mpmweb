import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ReceivableSettlement from '#models/receivable_settlement'
import Receivable from '#models/receivable'
import type { TenantContext } from '#services/tenant_context'
import receivableSettlementRepository from '#repositories/receivable_settlement_repository'
import receivableRepository from '#repositories/receivable_repository'
import paymentTypeRepository from '#repositories/payment_type_repository'
import receivableService, { OWING_STATUSES } from '#services/receivable_service'
import { BusinessException, NotFoundException } from '#exceptions/app_exception'
import { todayIso } from '#utils/dates'

export interface CreateReceivableSettlementDTO {
  /** VineJS parses `YYYY-MM-DD` into a `Date`; the model wants a luxon DateTime. */
  settlementDate: Date
  paymentTypeId: number
  amount: number
  documentNumber?: string
  notes?: string
}

export type UpdateReceivableSettlementDTO = Partial<CreateReceivableSettlementDTO>

/**
 * Baixas (settlements) of a receivable. **Every write is multi-table** — it
 * touches `receivable_settlements` and recomputes the parent `receivables` row —
 * so it all runs inside a transaction, with the title row locked (`forUpdate`) to
 * serialise concurrent settlements and keep the balance check honest.
 *
 * The parent's `paid_amount`/`status` are always derived through
 * `ReceivableService.applySettlement()` — the single owner of the title status.
 *
 * See `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export class ReceivableSettlementService {
  async list(tenant: TenantContext, receivableId: number) {
    await this.ensureReceivable(tenant, receivableId)

    const rows = await receivableSettlementRepository
      .query(tenant.company.id, receivableId)
      .preload('paymentType')
      .orderBy('settlement_date', 'desc')
      .orderBy('id', 'desc')

    return rows.map((row) => this.serialize(row))
  }

  async create(tenant: TenantContext, receivableId: number, dto: CreateReceivableSettlementDTO) {
    return db.transaction(async (trx) => {
      const receivable = await this.lockReceivable(tenant, receivableId, trx)
      this.assertNotCancelled(receivable)
      await this.assertPaymentType(tenant, dto.paymentTypeId)

      const othersPaid = await this.sumSettlements(tenant, receivableId, trx)

      // Validates (Σ ≤ total) and mutates the title in memory. Throws **before**
      // any insert, so an overpay never leaves a rolled-back row behind.
      receivableService.applySettlement(receivable, othersPaid, dto.amount)

      const settlement = await ReceivableSettlement.create(
        {
          companyId: tenant.company.id,
          receivableId,
          paymentTypeId: dto.paymentTypeId,
          settlementDate: this.toDate(dto.settlementDate),
          amount: dto.amount,
          documentNumber: dto.documentNumber || null,
          notes: dto.notes || null,
        },
        { client: trx }
      )

      receivable.useTransaction(trx)
      await receivable.save()

      await settlement.load('paymentType')
      return this.serialize(settlement)
    })
  }

  /**
   * Recebimento em lote: cria **uma baixa por título**, com a **mesma** forma de
   * pagamento e **data = hoje**, cada uma pelo **saldo restante** do título.
   * Aberto quita o total; Parcial quita só o que falta — ambos fecham em Recebido.
   *
   * **Tudo ou nada**: roda numa única transação; cada título é travado
   * (`forUpdate`, em ordem crescente de id para não dar deadlock). Se qualquer um
   * deixou de ser elegível, a transação inteira faz rollback e nada é persistido.
   */
  async batchCreate(tenant: TenantContext, receivableIds: number[], paymentTypeId: number) {
    // Dedupe + ordena: lock determinístico e sem baixar o mesmo título duas vezes.
    const ids = [...new Set(receivableIds)].sort((a, b) => a - b)
    const today = DateTime.fromISO(todayIso())

    return db.transaction(async (trx) => {
      await this.assertPaymentType(tenant, paymentTypeId)

      let settledCount = 0
      let totalPaid = 0

      for (const id of ids) {
        const receivable = await this.lockReceivable(tenant, id, trx)

        if (!OWING_STATUSES.includes(receivable.status)) {
          throw new BusinessException(
            `O título ${receivable.documentNumber}/${receivable.installment} não pode ser recebido em lote.`
          )
        }

        // Saldo real: baixas já existentes (0 se Aberto) → quanto ainda falta.
        const alreadyPaid = await this.sumSettlements(tenant, id, trx)
        const balance = receivableService.remainingBalance(receivable, alreadyPaid)
        if (balance <= 0) {
          throw new BusinessException(
            `O título ${receivable.documentNumber}/${receivable.installment} não pode ser recebido em lote.`
          )
        }

        // Valida (Σ ≤ total) e recalcula o status na memória. Fecha em Recebido.
        receivableService.applySettlement(receivable, alreadyPaid, balance)

        await ReceivableSettlement.create(
          {
            companyId: tenant.company.id,
            receivableId: id,
            paymentTypeId,
            settlementDate: today,
            amount: balance,
            documentNumber: null,
            notes: null,
          },
          { client: trx }
        )

        receivable.useTransaction(trx)
        await receivable.save()

        settledCount += 1
        totalPaid += balance
      }

      return { settledCount, totalPaid }
    })
  }

  async update(
    tenant: TenantContext,
    receivableId: number,
    id: number,
    dto: UpdateReceivableSettlementDTO
  ) {
    return db.transaction(async (trx) => {
      const receivable = await this.lockReceivable(tenant, receivableId, trx)
      this.assertNotCancelled(receivable)

      const settlement = await ReceivableSettlement.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('receivable_id', receivableId)
        .where('id', id)
        .forUpdate()
        .first()
      if (!settlement) throw new NotFoundException('Baixa não encontrada.')

      if (dto.paymentTypeId !== undefined) {
        // Keeps the currently-linked type usable even if it went inactive.
        await this.assertPaymentType(tenant, dto.paymentTypeId, settlement.paymentTypeId)
        settlement.paymentTypeId = dto.paymentTypeId
      }
      if (dto.settlementDate !== undefined) settlement.settlementDate = this.toDate(dto.settlementDate)
      if (dto.amount !== undefined) settlement.amount = dto.amount
      if (dto.documentNumber !== undefined) settlement.documentNumber = dto.documentNumber || null
      if (dto.notes !== undefined) settlement.notes = dto.notes || null

      const others = await this.sumSettlements(tenant, receivableId, trx, id)
      receivableService.applySettlement(receivable, others, Number(settlement.amount))

      settlement.useTransaction(trx)
      await settlement.save()
      receivable.useTransaction(trx)
      await receivable.save()

      await settlement.load('paymentType')
      return this.serialize(settlement)
    })
  }

  async destroy(tenant: TenantContext, receivableId: number, id: number) {
    return db.transaction(async (trx) => {
      const receivable = await this.lockReceivable(tenant, receivableId, trx)

      const settlement = await ReceivableSettlement.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('receivable_id', receivableId)
        .where('id', id)
        .first()
      if (!settlement) throw new NotFoundException('Baixa não encontrada.')

      settlement.useTransaction(trx)
      await settlement.delete()

      // Recompute from what remains — removing a baixa only lowers the paid sum,
      // so it never overpays (thisAmount = 0).
      const remaining = await this.sumSettlements(tenant, receivableId, trx)
      receivableService.applySettlement(receivable, remaining, 0)
      receivable.useTransaction(trx)
      await receivable.save()
    })
  }

  /** 404 if the title does not exist in the active tenant. */
  private async ensureReceivable(tenant: TenantContext, receivableId: number) {
    const receivable = await receivableRepository.findById(tenant.company.id, receivableId)
    if (!receivable) throw new NotFoundException('Título não encontrado.')
    return receivable
  }

  /** Loads and **locks** the title inside the transaction (serialises baixas). */
  private async lockReceivable(
    tenant: TenantContext,
    receivableId: number,
    trx: TransactionClientContract
  ) {
    const receivable = await Receivable.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('id', receivableId)
      .forUpdate()
      .first()
    if (!receivable) throw new NotFoundException('Título não encontrado.')
    return receivable
  }

  private assertNotCancelled(receivable: Receivable) {
    if (receivable.status === 'cancelled') {
      throw new BusinessException('Não é possível baixar um título cancelado.')
    }
  }

  /**
   * Payment type must exist in the tenant. For a **new** baixa it must be active;
   * `allowInactiveId` keeps an already-linked type usable on edit even if it went
   * inactive. Same neutral message for every failure — does not leak another
   * tenant's data.
   */
  private async assertPaymentType(
    tenant: TenantContext,
    paymentTypeId: number,
    allowInactiveId?: number
  ) {
    const paymentType = await paymentTypeRepository.findById(tenant.company.id, paymentTypeId)
    if (!paymentType) throw new BusinessException('Tipo de pagamento inválido.')
    if (!paymentType.isActive && paymentType.id !== allowInactiveId) {
      throw new BusinessException('Tipo de pagamento inválido.')
    }
  }

  /**
   * Sum (in reais) of the title's settlements, computed in **cents** to stay
   * exact. `excludeId` drops the settlement being edited, yielding the sum of the
   * *others*.
   */
  private async sumSettlements(
    tenant: TenantContext,
    receivableId: number,
    trx: TransactionClientContract,
    excludeId?: number
  ) {
    const query = ReceivableSettlement.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('receivable_id', receivableId)
    if (excludeId !== undefined) query.whereNot('id', excludeId)

    const rows = await query.select('amount')
    const cents = rows.reduce((acc, row) => acc + Math.round(Number(row.amount) * 100), 0)
    return cents / 100
  }

  /** VineJS `Date` → luxon DateTime, for the `@column.date` column. */
  private toDate(value: Date) {
    return DateTime.fromJSDate(value)
  }

  private serialize(row: ReceivableSettlement) {
    return {
      id: row.id,
      receivableId: row.receivableId,
      paymentTypeId: row.paymentTypeId,
      paymentTypeName: row.paymentType?.description ?? null,
      settlementDate: row.settlementDate.toISODate(),
      amount: Number(row.amount),
      documentNumber: row.documentNumber,
      notes: row.notes,
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

export default new ReceivableSettlementService()
