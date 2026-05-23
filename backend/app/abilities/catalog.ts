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

  // Permissions / administration
  { slug: 'permissions.view', name: 'Visualizar permissões', module: 'permissions', action: 'view', description: 'Consultar perfis e permissões.' },
  { slug: 'permissions.manage', name: 'Administrar permissões', module: 'permissions', action: 'manage', description: 'Definir as permissões extras dos usuários.' },

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
]

export type RoleSlug = 'root' | 'admin' | 'operator'

export interface RoleDefinition {
  slug: RoleSlug
  name: string
  description: string
  /** Permission slugs, or `'*'` for full access. */
  permissions: string[] | typeof WILDCARD
}

/**
 * The three bootstrap roles and the permissions each one receives.
 */
export const ROLES: Record<RoleSlug, RoleDefinition> = {
  root: {
    slug: 'root',
    name: 'ROOT',
    description: 'Usuário master da plataforma, com acesso irrestrito.',
    permissions: WILDCARD,
  },
  admin: {
    slug: 'admin',
    name: 'ADMIN',
    description: 'Administrador da empresa.',
    permissions: [
      'dashboard.view',
      'companies.view',
      'companies.edit',
      'users.view',
      'users.create',
      'users.edit',
      'users.delete',
      'permissions.view',
      'permissions.manage',
    ],
  },
  operator: {
    slug: 'operator',
    name: 'OPERADOR',
    description: 'Usuário operacional, com acesso às funcionalidades permitidas.',
    permissions: ['dashboard.view', 'companies.view', 'users.view'],
  },
}
