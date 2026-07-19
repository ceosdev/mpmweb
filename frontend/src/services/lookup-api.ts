import { api } from '@/services/api-client'
import type { CustomerLookup, LookupResponse, SupplierLookup } from '@/types/api'

/**
 * Clientes HTTP dos endpoints de lookup, que alimentam o EntityPicker.
 *
 * São endpoints à parte da listagem do cadastro: não exigem a permissão do
 * módulo (`suppliers.view`, `customers.view`), porque quem alcança uma tela que
 * seleciona fornecedor precisa conseguir buscar mesmo sem acesso ao cadastro.
 * Ver `docs/spec/comum/001-componente-entity-picker.md`.
 */
function lookupApi<T>(resource: string) {
  return {
    /** Busca por termo (nome ou documento). Só registros ativos. */
    search: (q: string, signal?: AbortSignal) =>
      api
        .get<LookupResponse<T>>(`/${resource}/lookup`, { params: { q }, signal })
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
