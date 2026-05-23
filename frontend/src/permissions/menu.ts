import {
  Building2,
  FileText,
  LayoutDashboard,
  Package,
  Ruler,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
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
  { label: 'Tipos de documento', to: '/document-types', icon: FileText, permission: 'document_types.view' },
  { label: 'Unidades de medida', to: '/units-of-measure', icon: Ruler, permission: 'units_of_measure.view' },
  { label: 'Grupos de serviço', to: '/service-groups', icon: Wrench, permission: 'service_groups.view' },
  { label: 'Grupos de produto', to: '/product-groups', icon: Package, permission: 'product_groups.view' },
]
