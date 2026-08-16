import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ServiceEntry, { type ServiceEntryStatus, type TaxWithholding } from '#models/service_entry'
import ServiceEntryItem from '#models/service_entry_item'
import PaymentType from '#models/payment_type'
import Payable from '#models/payable'
import PayableSettlement from '#models/payable_settlement'
import type { TenantContext } from '#services/tenant_context'
import serviceEntryRepository from '#repositories/service_entry_repository'
import supplierRepository from '#repositories/supplier_repository'
import documentTypeRepository from '#repositories/document_type_repository'
import paymentTypeRepository from '#repositories/payment_type_repository'
import serviceRepository from '#repositories/service_repository'
import payableService from '#services/payable_service'
import payableSettlementService from '#services/payable_settlement_service'
import { splitInstallments, installmentDueDates } from '#utils/installments'
import { BusinessException, ConflictException, NotFoundException } from '#exceptions/app_exception'
import { todayIso } from '#utils/dates'

export interface ListParams {
  /** Busca exata pelo código (autoincremento). Nunca editável, só pesquisável. */
  id?: number
  documentNumber?: string
  supplierId?: number
  operationFrom?: string
  operationTo?: string
  issueFrom?: string
  issueTo?: string
  /** Múltipla escolha. Vazio/ausente = **todos**. */
  statuses?: ServiceEntryStatus[]
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * Ordenações que **não são coluna** desta tabela: fornecedor e tipo de documento
 * vivem atrás de uma FK, `items_total` é a soma dos filhos, e `status` precisa
 * da ordem do ciclo de vida, não da alfabética do slug em inglês.
 *
 * Subquery correlacionada em vez de `join`: o `paginate` do Lucid conta linhas, e
 * manter uma única fonte no `from` evita qualquer surpresa na contagem — é a
 * mesma técnica já usada para trazer `items_total` no `select`.
 *
 * A expressão de `items_total` é **a mesma** que a coluna exibe. Se divergirem, a
 * listagem se contradiz: mostra um valor e ordena por outro.
 */
const SORT_EXPRESSIONS: Record<string, string> = {
  supplier:
    '(select name from suppliers where suppliers.id = service_entries.supplier_id)',
  document_type:
    '(select description from document_types where document_types.id = service_entries.document_type_id)',
  items_total: `(select coalesce(sum(quantity * unit_price - discount), 0)
                   from service_entry_items
                  where service_entry_items.service_entry_id = service_entries.id)`,
  // Ordem do ciclo de vida (Aberta → Finalizada → Cancelada). Ordenar pela
  // coluna crua daria a alfabética do slug em inglês — `cancelled` antes de
  // `open` —, uma ordem que não corresponde a nada que o usuário vê na tela.
  status: `(case status
              when 'open' then 1
              when 'finalized' then 2
              when 'cancelled' then 3
              else 4
            end)`,
}

const SORT_COLUMNS: Record<string, string> = {
  id: 'id',
  document_number: 'document_number',
  issue_date: 'issue_date',
  operation_date: 'operation_date',
}

export interface ServiceEntryItemDTO {
  serviceId: number
  quantity: number
  unitPrice: number
  discount?: number
}

export interface CreateServiceEntryDTO {
  documentTypeId: number
  documentNumber: string
  series?: string
  subSeries?: string
  /** VineJS parses `YYYY-MM-DD` into a `Date`; the model wants a luxon DateTime. */
  issueDate: Date
  supplierId: number
  discount?: number
  taxWithholding?: TaxWithholding
  iss?: number
  pis?: number
  cofins?: number
  inss?: number
  irrf?: number
  csll?: number
  paymentTypeId: number
  installmentCount: number
  firstDueDate: Date
  items: ServiceEntryItemDTO[]
}

export type UpdateServiceEntryDTO = CreateServiceEntryDTO

export class ServiceEntryService {
  async list(tenant: TenantContext, params: ListParams) {
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20
    const direction: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc'

    const query = serviceEntryRepository
      .query(tenant.company.id)
      .preload('supplier')
      .preload('documentType')
      .preload('paymentType')
      // Σ dos filhos como coluna computada. Subquery e não join+group by: o
      // paginate do Lucid conta linhas, e um join com N itens multiplicaria o
      // total da paginação.
      .select('service_entries.*')
      .select(
        db.raw(
          `(select coalesce(sum(quantity * unit_price - discount), 0)
              from service_entry_items
             where service_entry_items.service_entry_id = service_entries.id) as items_total`
        )
      )

    const sortExpression = params.sort && SORT_EXPRESSIONS[params.sort]
    const sortColumn = params.sort && SORT_COLUMNS[params.sort]
    if (sortExpression) {
      // `direction` já veio normalizada para 'asc' | 'desc' acima — nada do
      // cliente entra crua na expressão.
      query.orderByRaw(`${sortExpression} ${direction === 'desc' ? 'desc' : 'asc'}`)
    } else if (sortColumn) {
      query.orderBy(sortColumn, direction)
    } else {
      query.orderBy('operation_date', 'desc').orderBy('id', 'desc')
    }

    if (params.id) query.where('id', params.id)

    if (params.documentNumber) {
      const term = `%${params.documentNumber.toLowerCase()}%`
      query.whereRaw('lower(document_number) like ?', [term])
    }
    if (params.supplierId) query.where('supplier_id', params.supplierId)
    if (params.operationFrom) query.where('operation_date', '>=', params.operationFrom)
    if (params.operationTo) query.where('operation_date', '<=', params.operationTo)
    if (params.issueFrom) query.where('issue_date', '>=', params.issueFrom)
    if (params.issueTo) query.where('issue_date', '<=', params.issueTo)
    if (params.statuses && params.statuses.length > 0) query.whereIn('status', params.statuses)

    const result = await query.paginate(page, perPage)
    return {
      data: result.all().map((row) => this.serialize(row)),
      meta: {
        total: result.total,
        page: result.currentPage,
        perPage: result.perPage,
        lastPage: result.lastPage,
      },
    }
  }

  async show(tenant: TenantContext, id: number) {
    const row = await this.findOrFail(tenant, id)
    await row.load('supplier')
    await row.load('documentType')
    await row.load('paymentType')
    const items = await this.loadItems(tenant, row.id)
    return this.serialize(row, items)
  }

  async create(tenant: TenantContext, dto: CreateServiceEntryDTO) {
    return db.transaction(async (trx) => {
      await this.assertRelations(tenant, dto)

      const issueDate = DateTime.fromJSDate(dto.issueDate)
      const firstDueDate = DateTime.fromJSDate(dto.firstDueDate)
      this.assertConsistent(dto, issueDate, firstDueDate)

      const row = new ServiceEntry()
      row.merge({
        companyId: tenant.company.id,
        ...this.headerValues(dto),
        issueDate,
        firstDueDate,
        // Data do lançamento no sistema — do backend, no fuso da aplicação.
        operationDate: DateTime.fromISO(todayIso()),
        status: 'open',
        finalizedAt: null,
      })
      row.useTransaction(trx)
      await row.save()

      await this.replaceItems(tenant, row.id, dto.items, trx)

      return row.id
    }).then((id) => this.show(tenant, id))
  }

  async update(tenant: TenantContext, id: number, dto: UpdateServiceEntryDTO) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      if (row.status !== 'open') {
        throw new BusinessException(
          'Não é possível editar uma entrada finalizada ou cancelada.'
        )
      }

      // Vínculos já gravados na entrada podem continuar inativos — só uma
      // *troca* para um id inativo diferente é rejeitada.
      const previousServiceIds = await this.loadServiceIds(tenant, row.id, trx)
      await this.assertRelations(tenant, dto, {
        documentTypeId: row.documentTypeId,
        supplierId: row.supplierId,
        paymentTypeId: row.paymentTypeId,
        serviceIds: previousServiceIds,
      })

      const issueDate = DateTime.fromJSDate(dto.issueDate)
      const firstDueDate = DateTime.fromJSDate(dto.firstDueDate)
      this.assertConsistent(dto, issueDate, firstDueDate)

      row.merge({ ...this.headerValues(dto), issueDate, firstDueDate })
      row.useTransaction(trx)
      await row.save()

      // Substituição em bloco: apaga todos e reinsere. Evita ter que diferenciar
      // item novo/alterado/removido no cliente.
      await this.replaceItems(tenant, row.id, dto.items, trx)
    })

    return this.show(tenant, id)
  }

  async destroy(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const row = await this.lock(tenant, id, trx)
      if (row.status !== 'open') {
        throw new BusinessException(
          'Não é possível excluir uma entrada finalizada ou cancelada.'
        )
      }

      await ServiceEntryItem.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('service_entry_id', id)
        .delete()

      try {
        row.useTransaction(trx)
        await row.delete()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException(
            'Não é possível excluir esta entrada porque ela já gerou títulos a pagar.'
          )
        }
        throw error
      }
    })
  }

  /**
   * Turns the entry into money: generates one payable per installment and marks
   * the entry `finalized`.
   *
   * Everything runs in one transaction with the entry locked — there is never a
   * finalized entry without titles, nor titles without a finalized entry.
   */
  async finalize(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const entry = await this.lock(tenant, id, trx)

      if (entry.status !== 'open') {
        throw new BusinessException('Só é possível finalizar uma entrada aberta.')
      }

      const items = await ServiceEntryItem.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('service_entry_id', id)
      if (items.length === 0) {
        throw new BusinessException('A entrada precisa ter ao menos um serviço.')
      }

      const base = this.baseCents(entry, items)
      if (base <= 0) {
        throw new BusinessException(
          'O valor a pagar da nota é zero ou negativo. Revise o desconto e os impostos retidos.'
        )
      }
      const count = entry.installmentCount
      if (base < count) {
        throw new BusinessException(
          `O valor da nota não permite dividir em ${count} parcelas.`
        )
      }

      const paymentType = await PaymentType.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('id', entry.paymentTypeId)
        .first()
      if (!paymentType) throw new BusinessException('Tipo de pagamento inválido.')

      const amounts = splitInstallments(base, count)
      const dueDates = installmentDueDates(entry.firstDueDate, count)
      // Rastro legível para o usuário; a FK é o rastro que o banco usa.
      const notes = `Título gerado a partir da entrada de serviço: ${entry.id} com o tipo de pagamento: ${paymentType.description}`

      for (let index = 0; index < count; index += 1) {
        const payable = await payableService.createFromSource(
          tenant,
          {
            supplierId: entry.supplierId,
            serviceEntryId: entry.id,
            documentNumber: entry.documentNumber,
            installment: index + 1,
            issueDate: entry.issueDate,
            dueDate: dueDates[index],
            amount: amounts[index] / 100,
            notes,
          },
          trx
        )

        // O tipo de pagamento marcado como "realiza baixa automática" fecha o
        // título já na finalização, na data do vencimento da parcela — uma
        // parcela que vence em novembro não deve aparecer baixada em agosto.
        if (paymentType.autoSettlement) {
          await payableSettlementService.settleFullInTransaction(
            tenant,
            payable,
            entry.paymentTypeId,
            dueDates[index],
            'Baixa automática (tipo de pagamento com baixa automática).',
            trx
          )
        }
      }

      entry.status = 'finalized'
      entry.finalizedAt = DateTime.now()
      entry.useTransaction(trx)
      await entry.save()
    })

    return this.show(tenant, id)
  }

  /**
   * Cancels the entry **and every title it generated**, deleting their
   * settlements. There is no reopen: this is how a finalized entry is undone
   * without erasing the document itself.
   *
   * `cancelled` is terminal for both the entry and the titles.
   */
  async cancel(tenant: TenantContext, id: number) {
    await db.transaction(async (trx) => {
      const entry = await this.lock(tenant, id, trx)

      if (entry.status === 'cancelled') {
        throw new BusinessException('Esta entrada já está cancelada.')
      }

      // Ordem crescente de id: mesmo motivo do `batchCreate` de
      // `payable_settlement_service.ts` — trava determinística evita deadlock
      // (`40P01`) contra um pagamento em lote concorrente sobre títulos
      // sobrepostos.
      const payables = await Payable.query({ client: trx })
        .where('company_id', tenant.company.id)
        .where('service_entry_id', id)
        .whereNot('status', 'cancelled')
        .orderBy('id', 'asc')
        .forUpdate()

      for (const payable of payables) {
        // Mesma mecânica do cancelamento de título: as baixas somem, o pago
        // zera e o status vira terminal (não é recalculado a partir do pago).
        await PayableSettlement.query({ client: trx })
          .where('company_id', tenant.company.id)
          .where('payable_id', payable.id)
          .delete()

        payable.paidAmount = 0
        payable.status = 'cancelled'
        payable.useTransaction(trx)
        await payable.save()
      }

      entry.status = 'cancelled'
      entry.useTransaction(trx)
      await entry.save()
    })

    return this.show(tenant, id)
  }

  // ---------------------------------------------------------------- a conta

  /** Σ (quantidade × valor − desconto) de cada item, em centavos. */
  itemsTotalCents(items: ServiceEntryItem[]): number {
    return items.reduce(
      (sum, item) =>
        sum + this.cents(item.unitPrice) * Number(item.quantity) - this.cents(item.discount),
      0
    )
  }

  /**
   * Impostos que abatem o que pagamos. Retenção pelo **emissor** não abate nada
   * — quem recolhe é o fornecedor, e o valor cheio da nota continua devido.
   */
  withheldTaxCents(entry: ServiceEntry): number {
    if (entry.taxWithholding !== 'recipient') return 0
    return (
      this.cents(entry.iss) +
      this.cents(entry.pis) +
      this.cents(entry.cofins) +
      this.cents(entry.inss) +
      this.cents(entry.irrf) +
      this.cents(entry.csll)
    )
  }

  /** O valor que vira contas a pagar, em centavos. */
  baseCents(entry: ServiceEntry, items: ServiceEntryItem[]): number {
    return this.itemsTotalCents(items) - this.cents(entry.discount) - this.withheldTaxCents(entry)
  }

  // ------------------------------------------------------------- internos

  async loadItems(tenant: TenantContext, entryId: number) {
    return ServiceEntryItem.query()
      .where('company_id', tenant.company.id)
      .where('service_entry_id', entryId)
      .preload('service')
      .orderBy('id', 'asc')
  }

  /** Just the `serviceId`s currently persisted — used by `assertRelations` to
   * know which items already existed before an update (so their service may
   * stay inactive). Reads inside the caller's transaction so it sees the row
   * as locked, before `replaceItems` deletes it. */
  private async loadServiceIds(
    tenant: TenantContext,
    entryId: number,
    trx: TransactionClientContract
  ): Promise<number[]> {
    const rows = await ServiceEntryItem.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('service_entry_id', entryId)
    return rows.map((row) => row.serviceId)
  }

  async findOrFail(tenant: TenantContext, id: number) {
    const row = await serviceEntryRepository.findById(tenant.company.id, id)
    if (!row) throw new NotFoundException('Entrada de serviço não encontrada.')
    return row
  }

  /** Carrega com lock da linha — serializa finalizações concorrentes. */
  async lock(tenant: TenantContext, id: number, trx: TransactionClientContract) {
    const row = await ServiceEntry.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('id', id)
      .forUpdate()
      .first()
    if (!row) throw new NotFoundException('Entrada de serviço não encontrada.')
    return row
  }

  private headerValues(dto: CreateServiceEntryDTO) {
    const withholding: TaxWithholding = dto.taxWithholding ?? 'issuer'
    // Retenção pelo emissor zera os impostos AQUI, não na UI: o service não
    // confia no payload.
    const tax = (value: number | undefined) => (withholding === 'recipient' ? (value ?? 0) : 0)

    return {
      documentTypeId: dto.documentTypeId,
      supplierId: dto.supplierId,
      paymentTypeId: dto.paymentTypeId,
      documentNumber: dto.documentNumber,
      series: dto.series || null,
      subSeries: dto.subSeries || null,
      discount: dto.discount ?? 0,
      taxWithholding: withholding,
      iss: tax(dto.iss),
      pis: tax(dto.pis),
      cofins: tax(dto.cofins),
      inss: tax(dto.inss),
      irrf: tax(dto.irrf),
      csll: tax(dto.csll),
      installmentCount: dto.installmentCount,
    }
  }

  private async replaceItems(
    tenant: TenantContext,
    entryId: number,
    items: ServiceEntryItemDTO[],
    trx: TransactionClientContract
  ) {
    await ServiceEntryItem.query({ client: trx })
      .where('company_id', tenant.company.id)
      .where('service_entry_id', entryId)
      .delete()

    await ServiceEntryItem.createMany(
      items.map((item) => ({
        companyId: tenant.company.id,
        serviceEntryId: entryId,
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
      })),
      { client: trx }
    )
  }

  /**
   * Validates existence, tenant and **active** status of every FK referenced
   * by the payload — `documentTypeId`, `supplierId`, `paymentTypeId` and each
   * `items[].serviceId`.
   *
   * `current` carries the ids already gravados na entrada **antes** desta
   * escrita (`undefined` on create, where nothing is grandfathered — every
   * relation must be active). On update, a relation that is inactive but was
   * already the value stored on the row is let through (an old link does not
   * become uneditable just because the catalog entry was deactivated later);
   * *switching* to a different, inactive id is still rejected. Same neutral
   * message whether the problem is existence, tenant or inactivity — none of
   * those leak.
   */
  private async assertRelations(
    tenant: TenantContext,
    dto: CreateServiceEntryDTO,
    current?: {
      documentTypeId: number
      supplierId: number
      paymentTypeId: number
      serviceIds: number[]
    }
  ) {
    const supplier = await supplierRepository.findById(tenant.company.id, dto.supplierId)
    if (!supplier) throw new BusinessException('Fornecedor inválido.')
    if (!supplier.isActive && supplier.id !== current?.supplierId) {
      throw new BusinessException('Fornecedor inválido.')
    }

    const documentType = await documentTypeRepository.findById(tenant.company.id, dto.documentTypeId)
    if (!documentType) throw new BusinessException('Tipo de documento inválido.')
    if (!documentType.isActive && documentType.id !== current?.documentTypeId) {
      throw new BusinessException('Tipo de documento inválido.')
    }

    const paymentType = await paymentTypeRepository.findById(tenant.company.id, dto.paymentTypeId)
    if (!paymentType) throw new BusinessException('Tipo de pagamento inválido.')
    if (!paymentType.isActive && paymentType.id !== current?.paymentTypeId) {
      throw new BusinessException('Tipo de pagamento inválido.')
    }

    const serviceIds = [...new Set(dto.items.map((item) => item.serviceId))]
    const services = await serviceRepository.query(tenant.company.id).whereIn('id', serviceIds)
    if (services.length !== serviceIds.length) {
      throw new BusinessException('Serviço inválido.')
    }
    const allowedInactiveServiceIds = new Set(current?.serviceIds ?? [])
    const hasInvalidService = services.some(
      (service) => !service.isActive && !allowedInactiveServiceIds.has(service.id)
    )
    if (hasInvalidService) {
      throw new BusinessException('Serviço inválido.')
    }
  }

  private assertConsistent(
    dto: CreateServiceEntryDTO,
    issueDate: DateTime,
    firstDueDate: DateTime
  ) {
    for (const item of dto.items) {
      const line = this.cents(item.unitPrice) * item.quantity
      if (this.cents(item.discount ?? 0) > line) {
        throw new BusinessException(
          'O desconto de um serviço não pode ser maior que o valor da linha.'
        )
      }
    }

    const itemsTotal = dto.items.reduce(
      (sum, item) =>
        sum + this.cents(item.unitPrice) * item.quantity - this.cents(item.discount ?? 0),
      0
    )
    if (this.cents(dto.discount ?? 0) > itemsTotal) {
      throw new BusinessException('O desconto da nota não pode ser maior que o total dos serviços.')
    }

    if (firstDueDate.toISODate()! < issueDate.toISODate()!) {
      throw new BusinessException('O 1º vencimento não pode ser anterior à emissão.')
    }
  }

  /**
   * Money in cents. `decimal` columns come back from the driver as strings, and
   * floating-point reais would make the installment split lose fractions of a
   * cent. Integer cents divide exactly.
   */
  private cents(value: number | string | null | undefined): number {
    return Math.round(Number(value ?? 0) * 100)
  }

  serialize(row: ServiceEntry, items?: ServiceEntryItem[]) {
    // `items_total` vem da subquery no list; no show, soma os itens carregados.
    const itemsTotalCents =
      items !== undefined
        ? this.itemsTotalCents(items)
        : this.cents((row.$extras as { items_total?: string }).items_total ?? 0)

    const withheldCents = this.withheldTaxCents(row)
    const netCents = itemsTotalCents - this.cents(row.discount) - withheldCents

    return {
      id: row.id,
      documentTypeId: row.documentTypeId,
      documentTypeName: row.documentType?.description ?? null,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name ?? null,
      paymentTypeId: row.paymentTypeId,
      paymentTypeName: row.paymentType?.description ?? null,
      documentNumber: row.documentNumber,
      series: row.series,
      subSeries: row.subSeries,
      issueDate: row.issueDate.toISODate(),
      operationDate: row.operationDate.toISODate(),
      discount: Number(row.discount),
      taxWithholding: row.taxWithholding,
      iss: Number(row.iss),
      pis: Number(row.pis),
      cofins: Number(row.cofins),
      inss: Number(row.inss),
      irrf: Number(row.irrf),
      csll: Number(row.csll),
      installmentCount: row.installmentCount,
      firstDueDate: row.firstDueDate.toISODate(),
      status: row.status,
      finalizedAt: row.finalizedAt?.toISO() ?? null,
      itemsTotal: itemsTotalCents / 100,
      withheldTaxes: withheldCents / 100,
      netAmount: netCents / 100,
      items: items?.map((item) => ({
        id: item.id,
        serviceId: item.serviceId,
        serviceDescription: item.service?.description ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        lineTotal:
          (this.cents(item.unitPrice) * Number(item.quantity) - this.cents(item.discount)) / 100,
      })),
      createdAt: row.createdAt?.toISO() ?? null,
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23503'
}

export default new ServiceEntryService()
