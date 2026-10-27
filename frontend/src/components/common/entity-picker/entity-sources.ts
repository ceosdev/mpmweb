import {
  consumableStockProductLookupApi,
  customerLookupApi,
  employeeLookupApi,
  productAssetLookupApi,
  productLookupApi,
  supplierLookupApi,
  toolProductLookupApi,
} from '@/services/lookup-api'
import { maskTaxId } from '@/lib/masks'
import type {
  CustomerLookup,
  EmployeeLookup,
  ProductAssetLookup,
  ProductLookup,
  SupplierLookup,
} from '@/types/api'
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

const productSource: EntitySource = {
  placeholder: 'Buscar produto por código ou descrição...',
  emptyMessage: 'Nenhum produto encontrado.',

  async search(term, signal) {
    const { data, hasMore } = await productLookupApi.search(term, signal)
    return { options: data.map(toProductOption), hasMore }
  },

  async fetchByIds(ids) {
    const { data } = await productLookupApi.byIds(ids)
    return data.map(toProductOption)
  },
}

function toProductOption(row: ProductLookup): EntityOption {
  const kind = row.type === 'fixed_asset' ? 'Ativo' : row.type === 'tool' ? 'Ferramenta' : 'Consumo'
  return {
    id: row.id,
    label: row.description,
    sublabel: `#${row.id} · ${kind} · ${row.unitOfMeasure ?? '—'}`,
    isActive: row.isActive,
    data: row,
  }
}

const employeeSource: EntitySource = {
  placeholder: 'Buscar funcionário por código ou nome...',
  emptyMessage: 'Nenhum funcionário encontrado.',

  async search(term, signal) {
    const { data, hasMore } = await employeeLookupApi.search(term, signal)
    return { options: data.map(toEmployeeOption), hasMore }
  },

  async fetchByIds(ids) {
    const { data } = await employeeLookupApi.byIds(ids)
    return data.map(toEmployeeOption)
  },
}

function toEmployeeOption(row: EmployeeLookup): EntityOption {
  return {
    id: row.id,
    label: row.name,
    sublabel: `#${row.id} · ${row.roleTitle ?? '—'}`,
    isActive: row.isActive,
  }
}

const productAssetSource: EntitySource = {
  placeholder: 'Buscar ativo por código, patrimônio ou descrição...',
  emptyMessage: 'Nenhum ativo encontrado.',

  async search(term, signal) {
    const { data, hasMore } = await productAssetLookupApi.search(term, signal)
    return { options: data.map(toProductAssetOption), hasMore }
  },

  async fetchByIds(ids) {
    const { data } = await productAssetLookupApi.byIds(ids)
    return data.map(toProductAssetOption)
  },
}

function toProductAssetOption(row: ProductAssetLookup): EntityOption {
  return {
    id: row.id,
    label: `${row.productDescription} – ${row.description}`,
    sublabel: `#${row.id} · ${row.assetCode ?? 'Sem patrimônio'}`,
    // Ativo vendido volta na hidratação; fica marcado como indisponível.
    isActive: row.situation !== 'sold',
    data: row,
  }
}

/** Produtos de consumo com controle de estoque — itens da saída de consumo. */
const consumableStockProductSource: EntitySource = {
  placeholder: 'Buscar produto de consumo por código ou descrição...',
  emptyMessage: 'Nenhum produto encontrado.',

  async search(term, signal) {
    const { data, hasMore } = await consumableStockProductLookupApi.search(term, signal)
    return { options: data.map(toProductOption), hasMore }
  },

  async fetchByIds(ids) {
    const { data } = await consumableStockProductLookupApi.byIds(ids)
    return data.map(toProductOption)
  },
}

/** Ferramentas com controle de estoque — itens da saída de ferramenta. */
const toolProductSource: EntitySource = {
  placeholder: 'Buscar ferramenta por código ou descrição...',
  emptyMessage: 'Nenhuma ferramenta encontrada.',

  async search(term, signal) {
    const { data, hasMore } = await toolProductLookupApi.search(term, signal)
    return { options: data.map(toProductOption), hasMore }
  },

  async fetchByIds(ids) {
    const { data } = await toolProductLookupApi.byIds(ids)
    return data.map(toProductOption)
  },
}

export const ENTITY_SOURCES = {
  supplier: supplierSource,
  customer: customerSource,
  product: productSource,
  employee: employeeSource,
  productAsset: productAssetSource,
  consumableStockProduct: consumableStockProductSource,
  toolProduct: toolProductSource,
} satisfies Record<string, EntitySource>

export type EntitySourceKey = keyof typeof ENTITY_SOURCES
