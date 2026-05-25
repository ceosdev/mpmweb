/**
 * Rótulos em português para os módulos do catálogo de permissões. Centralizado
 * aqui para que todas as telas que exibem o catálogo (permissions, roles,
 * users) mostrem os mesmos nomes. Ao adicionar uma permissão nova no backend
 * (`app/abilities/catalog.ts`), registre o rótulo do módulo abaixo.
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
}

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module
}
