/**
 * Contrato do EntityPicker. É o que desacopla o componente das entidades: ele
 * conhece apenas `EntitySource`, nunca `suppliers-api` ou `customers-api`.
 *
 * Ver `docs/spec/comum/001-componente-entity-picker.md`.
 */

/** Um candidato exibido na lista, já pronto para apresentação. */
export interface EntityOption {
  /** A FK — é isto que o formulário guarda e o backend persiste. */
  id: number
  /** Linha principal do item. Ex.: "Acme Distribuidora Ltda". */
  label: string
  /** Linha secundária, para desambiguar homônimos. Ex.: o CNPJ. */
  sublabel?: string
  /**
   * Registros inativos não aparecem na busca, mas podem chegar pela hidratação
   * (vínculo antigo). O componente marca esses com "(inativo)".
   */
  isActive: boolean
}

export interface EntitySearchResult {
  options: EntityOption[]
  /** Havia mais resultados além do limite — a UI pede para refinar a busca. */
  hasMore: boolean
}

/**
 * Uma entidade pesquisável. Cada implementação traduz a resposta crua do seu
 * endpoint de lookup em `EntityOption` — **toda a apresentação mora aqui**.
 */
export interface EntitySource {
  /** Placeholder do input. Ex.: "Buscar fornecedor por nome ou CNPJ...". */
  placeholder: string
  /** Texto quando a busca não acha nada. Ex.: "Nenhum fornecedor encontrado.". */
  emptyMessage: string
  search(term: string, signal?: AbortSignal): Promise<EntitySearchResult>
  fetchByIds(ids: number[]): Promise<EntityOption[]>
}
