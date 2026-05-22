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
