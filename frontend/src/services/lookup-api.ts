import { api } from '@/services/api-client'
import type {
  CustomerLookup,
  EmployeeLookup,
  LookupResponse,
  ProductAssetLookup,
  ProductLookup,
  SupplierLookup,
} from '@/types/api'

/**
 * Clientes HTTP dos endpoints de lookup, que alimentam o EntityPicker.
 *
 * São endpoints à parte da listagem do cadastro: não exigem a permissão do
 * módulo (`suppliers.view`, `customers.view`), porque quem alcança uma tela que
 * seleciona fornecedor precisa conseguir buscar mesmo sem acesso ao cadastro.
 * Ver `docs/spec/comum/001-componente-entity-picker.md`.
 */
function lookupApi<T>(resource: string, extraParams?: Record<string, string>) {
  return {
    /**
     * Busca por termo (nome ou documento). Só registros ativos. `extraParams`
     * (filtros fixos da fonte) valem **só aqui**, nunca na hidratação.
     */
    search: (q: string, signal?: AbortSignal) =>
      api
        .get<LookupResponse<T>>(`/${resource}/lookup`, { params: { ...extraParams, q }, signal })
        .then((r) => r.data),

    /**
     * Hidratação: resolve ids em rótulos. Traz o registro **mesmo inativo**, para
     * que um vínculo antigo não desapareça da tela de edição.
     */
    byIds: (ids: number[]) =>
      api
        .get<LookupResponse<T>>(`/${resource}/lookup`, { params: { ids: ids.join(',') } })
        .then((r) => r.data),
  }
}

export const supplierLookupApi = lookupApi<SupplierLookup>('suppliers')
export const customerLookupApi = lookupApi<CustomerLookup>('customers')
export const productLookupApi = lookupApi<ProductLookup>('products')
export const employeeLookupApi = lookupApi<EmployeeLookup>('employees')
export const productAssetLookupApi = lookupApi<ProductAssetLookup>('product-assets')
export const consumableStockProductLookupApi = lookupApi<ProductLookup>('products', {
  type: 'consumable',
  controlsStock: 'true',
})
export const toolProductLookupApi = lookupApi<ProductLookup>('products', {
  type: 'tool',
  controlsStock: 'true',
})
