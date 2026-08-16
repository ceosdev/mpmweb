import { customerLookupApi, supplierLookupApi } from '@/services/lookup-api'
import { maskTaxId } from '@/lib/masks'
import type { CustomerLookup, SupplierLookup } from '@/types/api'
import type { EntityOption, EntitySource } from './types'

/**
 * Registry das entidades pesquisáveis pelo EntityPicker.
 *
 * Para acrescentar uma entidade nova (ex.: produto):
 *   1. Backend: `GET /api/products/lookup` (mesmo contrato dos daqui).
 *   2. Um `EntitySource` abaixo, mapeando a resposta crua em `EntityOption`.
 *   3. Uma linha em `ENTITY_SOURCES`.
 *
 * Nada dentro de `entity-picker.tsx` muda. Registrar aqui apenas **torna a
 * entidade disponível** para busca — usar `EntityPicker` ou um `Select` comum
 * continua sendo decisão de cada tela.
 */

/**
 * Sublinha da opção: **código** sempre, e o documento quando houver.
 *
 * O código entra aqui porque o lookup passou a achar por ele — quem digita "704"
 * precisa ver qual dos resultados é o 704, senão a busca por código acha mas não
 * identifica. `maskTaxId` devolve string vazia quando não há documento, e nesse
 * caso sobra só o código.
 */
function entitySublabel(id: number, taxId: string): string {
  const documento = taxIdSublabel(taxId)
  return documento ? `#${id} · ${documento}` : `#${id}`
}

/** `maskTaxId` devolve string vazia quando não há documento; o sublabel some. */
function taxIdSublabel(taxId: string): string | undefined {
  return maskTaxId(taxId) || undefined
}

const supplierSource: EntitySource = {
  placeholder: 'Buscar fornecedor por código, nome ou CNPJ...',
  emptyMessage: 'Nenhum fornecedor encontrado.',

  async search(term, signal) {
    const { data, hasMore } = await supplierLookupApi.search(term, signal)
    return { options: data.map(toSupplierOption), hasMore }
  },

  async fetchByIds(ids) {
    const { data } = await supplierLookupApi.byIds(ids)
    return data.map(toSupplierOption)
  },
}

function toSupplierOption(row: SupplierLookup): EntityOption {
  return {
    id: row.id,
    label: row.name,
    sublabel: entitySublabel(row.id, row.taxId),
    isActive: row.isActive,
  }
}

const customerSource: EntitySource = {
  placeholder: 'Buscar cliente por código, nome ou CPF/CNPJ...',
  emptyMessage: 'Nenhum cliente encontrado.',

  async search(term, signal) {
    const { data, hasMore } = await customerLookupApi.search(term, signal)
    return { options: data.map(toCustomerOption), hasMore }
  },

  async fetchByIds(ids) {
    const { data } = await customerLookupApi.byIds(ids)
    return data.map(toCustomerOption)
  },
}

function toCustomerOption(row: CustomerLookup): EntityOption {
  return {
    id: row.id,
    label: row.legalName,
    // Código sempre; depois o nome fantasia, que identifica melhor que o
    // documento, com o CPF/CNPJ de reserva.
    sublabel: `#${row.id} · ${row.tradeName ?? taxIdSublabel(row.taxId) ?? '—'}`,
    isActive: row.isActive,
  }
}

export const ENTITY_SOURCES = {
  supplier: supplierSource,
  customer: customerSource,
} satisfies Record<string, EntitySource>

export type EntitySourceKey = keyof typeof ENTITY_SOURCES
