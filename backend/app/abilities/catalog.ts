/**
 * RBAC catalog — the single source of truth for permissions and the default
 * permission set of each role. The database seeder reads this file, so the
 * catalog and the seeded data never drift apart.
 *
 * Identifiers (slug / module / action) are in English; the `name` and
 * `description` fields are stored in the database and shown in the UI, so
 * they are written in Portuguese.
 *
 * Permission slug convention: `<module>.<action>`.
 */

/** Granted to root users — matches every permission check. */
export const WILDCARD = '*'

export interface PermissionDefinition {
  slug: string
  name: string
  module: string
  action: string
  description: string
}

/**
 * Every protected action in the platform. Add new permissions here and they
 * become available to the seeder and the authorization layer.
 */
export const PERMISSIONS: PermissionDefinition[] = [
  // Dashboard
  { slug: 'dashboard.view', name: 'Visualizar dashboard', module: 'dashboard', action: 'view', description: 'Acessar a página inicial e os indicadores.' },

  // Companies
  { slug: 'companies.view', name: 'Visualizar empresas', module: 'companies', action: 'view', description: 'Listar e consultar empresas.' },
  { slug: 'companies.create', name: 'Criar empresas', module: 'companies', action: 'create', description: 'Cadastrar novas empresas na plataforma.' },
  { slug: 'companies.edit', name: 'Editar empresas', module: 'companies', action: 'edit', description: 'Alterar dados de empresas.' },
  { slug: 'companies.delete', name: 'Excluir empresas', module: 'companies', action: 'delete', description: 'Remover empresas da plataforma.' },

  // Users
  { slug: 'users.view', name: 'Visualizar usuários', module: 'users', action: 'view', description: 'Listar e consultar usuários da empresa.' },
  { slug: 'users.create', name: 'Criar usuários', module: 'users', action: 'create', description: 'Cadastrar usuários e vinculá-los à empresa.' },
  { slug: 'users.edit', name: 'Editar usuários', module: 'users', action: 'edit', description: 'Alterar dados e perfil de usuários.' },
  { slug: 'users.delete', name: 'Excluir usuários', module: 'users', action: 'delete', description: 'Remover usuários da empresa.' },
  { slug: 'users.import', name: 'Importar usuários', module: 'users', action: 'import', description: 'Reaproveitar usuários já cadastrados em outras empresas.' },

  // Permissions / administration
  { slug: 'permissions.view', name: 'Visualizar permissões', module: 'permissions', action: 'view', description: 'Consultar perfis e permissões.' },
  { slug: 'permissions.manage', name: 'Administrar permissões', module: 'permissions', action: 'manage', description: 'Definir as permissões extras dos usuários.' },

  // Roles (perfis por empresa)
  { slug: 'roles.view', name: 'Visualizar perfis', module: 'roles', action: 'view', description: 'Listar e consultar perfis da empresa.' },
  { slug: 'roles.create', name: 'Criar perfis', module: 'roles', action: 'create', description: 'Cadastrar novos perfis na empresa.' },
  { slug: 'roles.edit', name: 'Editar perfis', module: 'roles', action: 'edit', description: 'Alterar perfis e suas permissões.' },
  { slug: 'roles.delete', name: 'Excluir perfis', module: 'roles', action: 'delete', description: 'Remover perfis da empresa.' },

  // Payment types
  { slug: 'payment_types.view', name: 'Visualizar tipos de pagamento', module: 'payment_types', action: 'view', description: 'Listar e consultar tipos de pagamento da empresa.' },
  { slug: 'payment_types.create', name: 'Criar tipos de pagamento', module: 'payment_types', action: 'create', description: 'Cadastrar novos tipos de pagamento.' },
  { slug: 'payment_types.edit', name: 'Editar tipos de pagamento', module: 'payment_types', action: 'edit', description: 'Alterar tipos de pagamento existentes.' },
  { slug: 'payment_types.delete', name: 'Excluir tipos de pagamento', module: 'payment_types', action: 'delete', description: 'Remover tipos de pagamento.' },

  // Tipos de documento
  { slug: 'document_types.view', name: 'Visualizar tipos de documento', module: 'document_types', action: 'view', description: 'Listar e consultar tipos de documento da empresa.' },
  { slug: 'document_types.create', name: 'Criar tipos de documento', module: 'document_types', action: 'create', description: 'Cadastrar tipos de documento.' },
  { slug: 'document_types.edit', name: 'Editar tipos de documento', module: 'document_types', action: 'edit', description: 'Alterar tipos de documento existentes.' },
  { slug: 'document_types.delete', name: 'Excluir tipos de documento', module: 'document_types', action: 'delete', description: 'Remover tipos de documento.' },

  // Unidades de medida
  { slug: 'units_of_measure.view', name: 'Visualizar unidades de medida', module: 'units_of_measure', action: 'view', description: 'Listar e consultar unidades de medida da empresa.' },
  { slug: 'units_of_measure.create', name: 'Criar unidades de medida', module: 'units_of_measure', action: 'create', description: 'Cadastrar unidades de medida.' },
  { slug: 'units_of_measure.edit', name: 'Editar unidades de medida', module: 'units_of_measure', action: 'edit', description: 'Alterar unidades de medida existentes.' },
  { slug: 'units_of_measure.delete', name: 'Excluir unidades de medida', module: 'units_of_measure', action: 'delete', description: 'Remover unidades de medida.' },

  // Grupos de serviço
  { slug: 'service_groups.view', name: 'Visualizar grupos de serviço', module: 'service_groups', action: 'view', description: 'Listar e consultar grupos de serviço da empresa.' },
  { slug: 'service_groups.create', name: 'Criar grupos de serviço', module: 'service_groups', action: 'create', description: 'Cadastrar grupos de serviço.' },
  { slug: 'service_groups.edit', name: 'Editar grupos de serviço', module: 'service_groups', action: 'edit', description: 'Alterar grupos de serviço existentes.' },
  { slug: 'service_groups.delete', name: 'Excluir grupos de serviço', module: 'service_groups', action: 'delete', description: 'Remover grupos de serviço.' },

  // Grupos de produto
  { slug: 'product_groups.view', name: 'Visualizar grupos de produto', module: 'product_groups', action: 'view', description: 'Listar e consultar grupos de produto da empresa.' },
  { slug: 'product_groups.create', name: 'Criar grupos de produto', module: 'product_groups', action: 'create', description: 'Cadastrar grupos de produto.' },
  { slug: 'product_groups.edit', name: 'Editar grupos de produto', module: 'product_groups', action: 'edit', description: 'Alterar grupos de produto existentes.' },
  { slug: 'product_groups.delete', name: 'Excluir grupos de produto', module: 'product_groups', action: 'delete', description: 'Remover grupos de produto.' },

  // Subgrupos de produto (filhos de product_groups, drill-down a partir da listagem de grupos)
  { slug: 'product_subgroups.view', name: 'Visualizar subgrupos de produto', module: 'product_subgroups', action: 'view', description: 'Listar e consultar subgrupos de um grupo de produto.' },
  { slug: 'product_subgroups.create', name: 'Criar subgrupos de produto', module: 'product_subgroups', action: 'create', description: 'Cadastrar subgrupos dentro de um grupo de produto.' },
  { slug: 'product_subgroups.edit', name: 'Editar subgrupos de produto', module: 'product_subgroups', action: 'edit', description: 'Alterar subgrupos de produto existentes.' },
  { slug: 'product_subgroups.delete', name: 'Excluir subgrupos de produto', module: 'product_subgroups', action: 'delete', description: 'Remover subgrupos de produto.' },

  // Fornecedores
  { slug: 'suppliers.view', name: 'Visualizar fornecedores', module: 'suppliers', action: 'view', description: 'Listar e consultar fornecedores da empresa.' },
  { slug: 'suppliers.create', name: 'Criar fornecedores', module: 'suppliers', action: 'create', description: 'Cadastrar novos fornecedores.' },
  { slug: 'suppliers.edit', name: 'Editar fornecedores', module: 'suppliers', action: 'edit', description: 'Alterar fornecedores existentes.' },
  { slug: 'suppliers.delete', name: 'Excluir fornecedores', module: 'suppliers', action: 'delete', description: 'Remover fornecedores.' },

  // Clientes
  { slug: 'customers.view', name: 'Visualizar clientes', module: 'customers', action: 'view', description: 'Listar e consultar clientes da empresa.' },
  { slug: 'customers.create', name: 'Criar clientes', module: 'customers', action: 'create', description: 'Cadastrar novos clientes.' },
  { slug: 'customers.edit', name: 'Editar clientes', module: 'customers', action: 'edit', description: 'Alterar clientes existentes.' },
  { slug: 'customers.delete', name: 'Excluir clientes', module: 'customers', action: 'delete', description: 'Remover clientes.' },

  // Serviços
  { slug: 'services.view', name: 'Visualizar serviços', module: 'services', action: 'view', description: 'Listar e consultar serviços da empresa.' },
  { slug: 'services.create', name: 'Criar serviços', module: 'services', action: 'create', description: 'Cadastrar novos serviços.' },
  { slug: 'services.edit', name: 'Editar serviços', module: 'services', action: 'edit', description: 'Alterar serviços existentes.' },
  { slug: 'services.delete', name: 'Excluir serviços', module: 'services', action: 'delete', description: 'Remover serviços.' },

  // Produtos (o formulário usa a cascata de subgrupos — conceder também product_subgroups.view)
  { slug: 'products.view', name: 'Visualizar produtos', module: 'products', action: 'view', description: 'Listar e consultar produtos da empresa.' },
  { slug: 'products.create', name: 'Criar produtos', module: 'products', action: 'create', description: 'Cadastrar novos produtos.' },
  { slug: 'products.edit', name: 'Editar produtos', module: 'products', action: 'edit', description: 'Alterar produtos existentes.' },
  { slug: 'products.delete', name: 'Excluir produtos', module: 'products', action: 'delete', description: 'Remover produtos.' },

  // Ativos (filhos de produtos fixed_asset; o formulário usa marcas + a cascata de modelos — conceder também brands.view e brand_models.view)
  { slug: 'product_assets.view', name: 'Visualizar ativos', module: 'product_assets', action: 'view', description: 'Listar e consultar os ativos de um produto imobilizado.' },
  { slug: 'product_assets.create', name: 'Criar ativos', module: 'product_assets', action: 'create', description: 'Cadastrar ativos em um produto imobilizado.' },
  { slug: 'product_assets.edit', name: 'Editar ativos', module: 'product_assets', action: 'edit', description: 'Alterar ativos existentes.' },
  { slug: 'product_assets.delete', name: 'Excluir ativos', module: 'product_assets', action: 'delete', description: 'Remover ativos.' },

  // Marcas
  { slug: 'brands.view', name: 'Visualizar marcas', module: 'brands', action: 'view', description: 'Listar e consultar marcas da empresa.' },
  { slug: 'brands.create', name: 'Criar marcas', module: 'brands', action: 'create', description: 'Cadastrar marcas.' },
  { slug: 'brands.edit', name: 'Editar marcas', module: 'brands', action: 'edit', description: 'Alterar marcas existentes.' },
  { slug: 'brands.delete', name: 'Excluir marcas', module: 'brands', action: 'delete', description: 'Remover marcas.' },

  // Modelos (filhos de marcas)
  { slug: 'brand_models.view', name: 'Visualizar modelos', module: 'brand_models', action: 'view', description: 'Listar e consultar modelos de uma marca.' },
  { slug: 'brand_models.create', name: 'Criar modelos', module: 'brand_models', action: 'create', description: 'Cadastrar modelos em uma marca.' },
  { slug: 'brand_models.edit', name: 'Editar modelos', module: 'brand_models', action: 'edit', description: 'Alterar modelos existentes.' },
  { slug: 'brand_models.delete', name: 'Excluir modelos', module: 'brand_models', action: 'delete', description: 'Remover modelos.' },

  // Contas a pagar (financeiro). O fornecedor é escolhido pelo EntityPicker, que
  // usa o lookup — sem exigir suppliers.view.
  { slug: 'payables.view', name: 'Visualizar contas a pagar', module: 'payables', action: 'view', description: 'Listar e consultar os títulos a pagar da empresa.' },
  { slug: 'payables.create', name: 'Criar contas a pagar', module: 'payables', action: 'create', description: 'Lançar novos títulos a pagar.' },
  { slug: 'payables.edit', name: 'Editar contas a pagar', module: 'payables', action: 'edit', description: 'Alterar títulos a pagar existentes.' },
  { slug: 'payables.delete', name: 'Excluir contas a pagar', module: 'payables', action: 'delete', description: 'Remover títulos a pagar.' },
  { slug: 'payables.cancel', name: 'Cancelar contas a pagar', module: 'payables', action: 'cancel', description: 'Cancelar um título, excluindo todas as suas baixas.' },

  // Baixas / pagamentos (filhos de contas a pagar). Abrem a partir do grid de
  // contas a pagar; movem o saldo do título.
  { slug: 'payable_settlements.view', name: 'Visualizar baixas', module: 'payable_settlements', action: 'view', description: 'Consultar as baixas (pagamentos) de um título a pagar.' },
  { slug: 'payable_settlements.create', name: 'Criar baixas', module: 'payable_settlements', action: 'create', description: 'Lançar baixas (pagamentos) em um título a pagar.' },
  { slug: 'payable_settlements.edit', name: 'Editar baixas', module: 'payable_settlements', action: 'edit', description: 'Alterar baixas existentes de um título.' },
  { slug: 'payable_settlements.delete', name: 'Excluir baixas', module: 'payable_settlements', action: 'delete', description: 'Remover baixas de um título.' },
  { slug: 'payable_settlements.batch', name: 'Pagar em lote', module: 'payable_settlements', action: 'batch', description: 'Pagar vários títulos de uma vez, com a mesma forma de pagamento.' },
]

export type RoleSlug = 'root'

export interface RoleDefinition {
  slug: RoleSlug
  name: string
  description: string
  /** Permission slugs, or `'*'` for full access. */
  permissions: string[] | typeof WILDCARD
}

/**
 * Bootstrap roles. Only ROOT is a platform-level role; every other profile
 * is created per company by the users themselves via the roles management
 * screen.
 */
export const ROLES: Record<RoleSlug, RoleDefinition> = {
  root: {
    slug: 'root',
    name: 'ROOT',
    description: 'Usuário master da plataforma, com acesso irrestrito.',
    permissions: WILDCARD,
  },
}
