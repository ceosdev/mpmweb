/**
 * Rótulos em português para os módulos do catálogo de permissões. Centralizado
 * aqui para que todas as telas que exibem o catálogo (permissions, roles,
 * users) mostrem os mesmos nomes. Ao adicionar uma permissão nova no backend
 * (`app/abilities/catalog.ts`), registre o rótulo do módulo abaixo.
 *
 * Padrão do rótulo: pt-BR capitalizado (só a inicial maiúscula), no plural.
 *
 * Módulo de tela filha (aberta a partir de outra) nomeia o pai no próprio
 * rótulo, para o usuário saber de onde ele vem: `Subgrupos de produto`,
 * `Ativos do produto`, `Modelos da marca` — e não só `Ativos` / `Modelos`.
 */
export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  companies: 'Empresas',
  users: 'Usuários',
  permissions: 'Permissões',
  roles: 'Perfis',
  payment_types: 'Tipos de pagamento',
  document_types: 'Tipos de documento',
  units_of_measure: 'Unidades de medida',
  service_groups: 'Grupos de serviço',
  product_groups: 'Grupos de produto',
  product_subgroups: 'Subgrupos de produto',
  suppliers: 'Fornecedores',
  customers: 'Clientes',
  services: 'Serviços',
  products: 'Produtos',
  product_assets: 'Ativos do produto',
  brands: 'Marcas',
  brand_models: 'Modelos da marca',
  payables: 'Contas a pagar',
}

export function moduleLabel(module: string): string {
  const label = MODULE_LABELS[module]
  if (!label) {
    // O slug cru (inglês) vazaria para a UI — sinaliza o rótulo faltante em dev.
    if (import.meta.env.DEV) {
      console.warn(`[module-labels] módulo sem rótulo em pt-BR: "${module}"`)
    }
    return module
  }
  return label
}
