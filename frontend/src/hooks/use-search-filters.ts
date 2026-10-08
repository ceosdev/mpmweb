import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { filterStorage, type StoredFilters } from '@/lib/filter-storage'

/**
 * Filtros que só disparam a consulta quando o usuário clica em **Pesquisar**.
 *
 * Separa dois estados:
 *  - `draft`   — o que os inputs editam. Digitar/selecionar **não** consulta.
 *  - `applied` — o que alimenta a `queryKey` e o GET.
 *
 * Ao montar, `applied === defaults`: a tela **já carrega** com os filtros padrão.
 * A partir daí, manipular um filtro muda só o `draft`; nada é consultado até
 * `apply()` (botão Pesquisar) ou `clear()` (Limpar filtros).
 *
 * **Persistência:** rascunho e aplicados ficam no `sessionStorage`, por empresa
 * ativa + rota (`filterStorage`). Abrir um registro e voltar (botão Voltar,
 * Fechar, menu) remonta a tela com os filtros como estavam. Só **Limpar
 * filtros** (`clear()`) apaga o salvo; fechar a aba ou sair da conta também.
 *
 * Paginação e ordenação **não** passam por aqui — continuam imediatas, operando
 * sobre os filtros já aplicados. A página reseta `page` para 1 no `apply`/`clear`.
 *
 * @example
 * const filters = useSearchFilters({ search: '', status: 'all' as StatusFilter })
 * // input:  value={filters.draft.search}
 * //         onChange={(e) => filters.setField('search', e.target.value)}
 * // query:  queryKey: ['x', companyId, filters.applied, page]
 * // botão:  onClick={() => { filters.apply(); setPage(1) }}
 */
export function useSearchFilters<T extends Record<string, unknown>>(defaults: T) {
  const { tenant } = useAuth()
  const { pathname } = useLocation()
  const storageKey = filterStorage.key(tenant?.companyId, pathname)

  const initial = (key: string): StoredFilters<T> =>
    filterStorage.read(key, defaults) ?? { draft: defaults, applied: defaults }

  const [state, setState] = useState(() => ({ key: storageKey, ...initial(storageKey) }))

  // Trocou de empresa (ou de rota) sem remontar: carrega o salvo da nova chave
  // durante o render, antes do efeito abaixo gravar valores antigos nela.
  let current = state
  if (state.key !== storageKey) {
    current = { key: storageKey, ...initial(storageKey) }
    setState(current)
  }
  const { draft, applied } = current

  const serializedDefaults = JSON.stringify(defaults)

  useEffect(() => {
    // No padrão não há o que lembrar — mantém o storage limpo.
    if (JSON.stringify(state.draft) === serializedDefaults &&
        JSON.stringify(state.applied) === serializedDefaults) {
      filterStorage.remove(state.key)
    } else {
      filterStorage.write(state.key, { draft: state.draft, applied: state.applied })
    }
  }, [state, serializedDefaults])

  function setDraft(value: T | ((current: T) => T)) {
    setState((s) => ({
      ...s,
      draft: typeof value === 'function' ? value(s.draft) : value,
    }))
  }

  function setField<K extends keyof T>(key: K, value: T[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return {
    /** Valores em edição — ligados aos inputs. */
    draft,
    /** Atualiza um campo do rascunho. Não consulta. */
    setField,
    /** Substitui o rascunho inteiro (uso raro). */
    setDraft,
    /** Valores que alimentam a consulta (entram na `queryKey`). */
    applied,
    /** Aplica o rascunho → dispara a consulta. Ligar ao botão **Pesquisar**. */
    apply: () => setState((s) => ({ ...s, applied: s.draft })),
    /** Volta rascunho e aplicados ao padrão e apaga o salvo → consulta com o default. */
    clear: () => {
      filterStorage.remove(storageKey)
      setState({ key: storageKey, draft: defaults, applied: defaults })
    },
    /** `true` quando o rascunho difere do padrão — controla o botão **Limpar**. */
    isDirty: JSON.stringify(draft) !== serializedDefaults,
    /** `true` quando os filtros **aplicados** diferem do padrão — texto do empty state. */
    isFiltered: JSON.stringify(applied) !== serializedDefaults,
  }
}
