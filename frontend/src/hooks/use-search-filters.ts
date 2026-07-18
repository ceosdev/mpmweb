import { useState } from 'react'

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
  const [draft, setDraft] = useState<T>(defaults)
  const [applied, setApplied] = useState<T>(defaults)

  const serializedDefaults = JSON.stringify(defaults)

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
    apply: () => setApplied(draft),
    /** Volta rascunho e aplicados ao padrão → consulta com o default. */
    clear: () => {
      setDraft(defaults)
      setApplied(defaults)
    },
    /** `true` quando o rascunho difere do padrão — controla o botão **Limpar**. */
    isDirty: JSON.stringify(draft) !== serializedDefaults,
    /** `true` quando os filtros **aplicados** diferem do padrão — texto do empty state. */
    isFiltered: JSON.stringify(applied) !== serializedDefaults,
  }
}
