import {
  Building2,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * Navigation item. `permission` is the slug required to see it — the sidebar
 * filters this list against the active company's permission set, so the menu
 * is fully dynamic and tenant-aware.
 */
export interface MenuItem {
  label: string
  to: string
  icon: LucideIcon
  permission: string
}

export const MENU: MenuItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Usuários', to: '/users', icon: Users, permission: 'users.view' },
  { label: 'Empresas', to: '/companies', icon: Building2, permission: 'companies.view' },
  { label: 'Permissões', to: '/permissions', icon: ShieldCheck, permission: 'permissions.view' },
  { label: 'Tipos de pagamento', to: '/payment-types', icon: Wallet, permission: 'payment_types.view' },
]
