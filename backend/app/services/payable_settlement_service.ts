import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PayableSettlement from '#models/payable_settlement'
import Payable from '#models/payable'
import type { TenantContext } from '#services/tenant_context'
import payableSettlementRepository from '#repositories/payable_settlement_repository'
import payableRepository from '#repositories/payable_repository'
import paymentTypeRepository from '#repositories/payment_type_repository'
import payableService, { OWING_STATUSES } from '#services/payable_service'
import { BusinessException, NotFoundException } from '#exceptions/app_exception'
import { todayIso } from '#utils/dates'

export interface CreatePayableSettlementDTO {
  /** VineJS parses `YYYY-MM-DD` into a `Date`; the model wants a luxon DateTime. */
  settlementDate: Date
  paymentTypeId: number
  amount: number
  documentNumber?: string
  notes?: string
}

export type UpdatePayableSettlementDTO = Partial<CreatePayableSettlementDTO>

/**
 * Baixas (settlements) of a payable. **Every write is multi-table** — it touches
 * `payable_settlements` and recomputes the parent `payables` row — so it all runs
 * inside a transaction, with the title row locked (`forUpdate`) to serialise
 * concurrent settlements and keep the balance check honest.
 *
 * The parent's `paid_amount`/`status` are always derived through
 * `PayableService.applySettlement()` — the single owner of the title status.
 *
 * See `docs/spec/financeiro/002-baixa-de-titulo.md`.
 */
export class PayableSettlementService {
  async list(tenant: TenantContext, payableId: number) {
    await this.ensurePayable(tenant, payableId)

    const rows = await payableSettlementRepository
      .query(tenant.company.id, payableId)
      .preload('paymentType')
      .orderBy('settlement_date', 'desc')
      .orderBy('id', 'desc')

    return rows.map((row) => this.serialize(row))
  }

  async create(tenant: TenantContext, payableId: number, dto: CreatePayableSettlementDTO) {
    return db.transaction(async (trx) => {
      const payable = await this.lockPayable(tenant, payableId, trx)
      this.assertNotCancelled(payable)
      await this.assertPaymentType(tenant, dto.paymentTypeId)

      const othersPaid = await this.sumSettlements(tenant, payableId, trx)

      // Validates (Σ ≤ total) and mutates the title in memory. Throws **before**
      // any insert, so an overpay never leaves a rolled-back row behind.
      payableService.applySettlement(payable, othersPaid, dto.amount)

      const settlement = await PayableSettlement.create(
        {
          companyId: tenant.company.id,
          payableId,
          paymentTypeId: dto.paymentTypeId,
          settlementDate: this.toDate(dto.settlementDate),
          amount: dto.amount,
          documentNumber: dto.documentNumber || null,
          notes: dto.notes || null,
        },
        { client: trx }
      )

      payable.useTransaction(trx)
      await payable.save()

      await settlement.load('paymentType')
      return this.serialize(settlement)
    })
  }

  /**
   * Pagamento em lote: cria **uma baixa por título**, com a **mesma** forma de
   * pagamento e **data = hoje**, cada uma pelo **saldo restante** do título.
   * Aberto quita o total; Parcial quita só o que falta — ambos fecham em Pago.
   *
   * **Tudo ou nada**: roda numa única transação; cada título é travado
   * (`forUpdate`, em ordem crescente de id para não dar deadlock). Se qualquer um
   * deixou de ser elegível (não é do tenant, foi pago/cancelado antes), a
   * transação inteira faz rollback e nada é persistido.
   */
  async batchCreate(tenant: TenantContext, payableIds: number[], paymentTypeId: number) {
    // Dedupe + ordena: lock determinístico e sem baixar o mesmo título duas vezes.
    const ids = [...new Set(payableIds)].sort((a, b) => a - b)
    const today = DateTime.fromISO(todayIso())

    return db.transaction(async (trx) => {
      await this.assertPaymentType(tenant, paymentTypeId)

      let settledCount = 0
      let totalPaid = 0

      for (const id of ids) {
        const payable = await this.lockPayable(tenant, id, trx)

        if (!OWING_STATUSES.includes(payable.status)) {
          throw new BusinessException(
            `O título ${payable.documentNumber}/${payable.installment} não pode ser pago em lote.`
          )
        }

        // Saldo real: baixas já existentes (0 se Aberto) → quanto ainda falta.
        const alreadyPaid = await this.sumSettlements(tenant, id, trx)
        const balance = payableService.remainingBalance(payable, alreadyPaid)
        if (balance <= 0) {
          throw new BusinessException(
            `O título ${payable.documentNumber}/${payable.installment} não pode ser pago em lote.`
          )
        }

        // Valida (Σ ≤ total) e recalcula o status na memória. Fecha em Pago.
        payableService.applySettlement(payable, alreadyPaid, balance)

        await PayableSettlement.create(
          {
            companyId: tenant.company.id,
            payableId: id,
            paymentTypeId,
            settlementDate: today,
            amount: balance,
            documentNumber: null,
            notes: null,
          },
          { client: trx }
        )

        payable.useTransaction(trx)
        await payable.save()

        settledCount += 1
        totalPaid += balance
      }

      return { settledCount, totalPaid }
    })
  }

  /**
   * Settles a payable **in full**, inside the caller's transaction. Used by the
   * automatic settlement of a payment type flagged `auto_settlement` — the
   * payable was just created by the same transaction, so it has no other
   * settlements and its balance is its total.
   *
   * The status still moves through the usual owners (`applySettlement` →
   * `recomputeStatus`); nothing here reimplements the settlement rules.
   *
   * `paymentTypeId` here comes from the service entry that triggered this
   * settlement, chosen back when the type could have been active. There is no
   * UI step in this flow to swap it for another one, so — unlike `create`
   * and `batchCreate`, which reject an inactive type on a hand-picked baixa —
   * we accept it inactive (`allowInactiveId: paymentTypeId` always matches).
   * What we never accept is an id from **another tenant**: `payment_types` is
   * per-tenant data, but `payable_settlements.payment_type_id`'s FK only
   * references `payment_types(id)` (not composed with `company_id`), so a
   * cross-tenant id would insert with no error from the database, and
   * `serialize` would then silently resolve `paymentType.description` from
   * another company via the unfiltered `belongsTo` relation. Same guard the
   * siblings use, kept here so the extension point is safe on its own.
   */
  async settleFullInTransaction(
    tenant: TenantContext,
    payable: Payable,
    paymentTypeId: number,
    settlementDate: DateTime,
    notes: string | null,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.assertPaymentType(tenant, paymentTypeId, paymentTypeId)

    const amount = payableService.remainingBalance(payable, Number(payable.paidAmount))
    // No-op by design: in the intended path the payable was just created in
    // this same transaction, so its balance always equals its total, and
    // Task 6 already rejects a base smaller than the installment count before
    // reaching here. Unlike `batchCreate` (a hand-picked, user-facing batch),
    // there is no user waiting on a "nothing to settle" error for this
    // automatic step.
    if (amount <= 0) return

    // Valida (Σ ≤ total) e recalcula o status na memória. Fecha em Pago.
    payableService.applySettlement(payable, Number(payable.paidAmount), amount)

    await PayableSettlement.create(
      {
        companyId: tenant.company.id,
        payableId: payable.id,
        paymentTypeId,
        settlementDate,
        amount,
        documentNumber: null,
        notes,
      },
      { client: trx }
    )

    payable.useTransaction(trx)
    await payable.save()
  }

  async update(
    tenant: TenantContext,
    payableId: number,
    id: number,
    dto: UpdatePayableSettlementDTO
  ) {
    return db.transaction(async (trx) => {
      const payable = await this.lockPayable(tenant, payableId, trx)
      this.assertNotCancelled(payable)

      const settlement = await PayableSettlement.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('payable_id', payableId)
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

      const others = await this.sumSettlements(tenant, payableId, trx, id)
      payableService.applySettlement(payable, others, Number(settlement.amount))

      settlement.useTransaction(trx)
      await settlement.save()
      payable.useTransaction(trx)
      await payable.save()

      await settlement.load('paymentType')
      return this.serialize(settlement)
    })
  }

  async destroy(tenant: TenantContext, payableId: number, id: number) {
    return db.transaction(async (trx) => {
      const payable = await this.lockPayable(tenant, payableId, trx)

      const settlement = await PayableSettlement.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('payable_id', payableId)
        .where('id', id)
        .first()
      if (!settlement) throw new NotFoundException('Baixa não encontrada.')

      settlement.useTransaction(trx)
      await settlement.delete()

      // Recompute from what remains — removing a baixa only lowers the paid sum,
      // so it never overpays (thisAmount = 0).
      const remaining = await this.sumSettlements(tenant, payableId, trx)
      payableService.applySettlement(payable, remaining, 0)
      payable.useTransaction(trx)
      await payable.save()
    })
  }

  /** 404 if the title does not exist in the active tenant. */
  private async ensurePayable(tenant: TenantContext, payableId: number) {
    const payable = await payableRepository.findById(tenant.company.id, payableId)
    if (!payable) throw new NotFoundException('Título não encontrado.')
    return payable
  }

  /** Loads and **locks** the title inside the transaction (serialises baixas). */
  private async lockPayable(
    tenant: TenantContext,
    payableId: number,
    trx: TransactionClientContract
  ) {
    const payable = await Payable.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('id', payableId)
      .forUpdate()
      .first()
    if (!payable) throw new NotFoundException('Título não encontrado.')
    return payable
  }

  private assertNotCancelled(payable: Payable) {
    if (payable.status === 'cancelled') {
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
    payableId: number,
    trx: TransactionClientContract,
    excludeId?: number
  ) {
    const query = PayableSettlement.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('payable_id', payableId)
    if (excludeId !== undefined) query.whereNot('id', excludeId)

    const rows = await query.select('amount')
    const cents = rows.reduce((acc, row) => acc + Math.round(Number(row.amount) * 100), 0)
    return cents / 100
  }

  /** VineJS `Date` → luxon DateTime, for the `@column.date` column. */
  private toDate(value: Date) {
    return DateTime.fromJSDate(value)
  }

  private serialize(row: PayableSettlement) {
    return {
      id: row.id,
      payableId: row.payableId,
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

export default new PayableSettlementService()
