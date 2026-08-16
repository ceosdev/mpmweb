import {
  Boxes,
  Briefcase,
  Building2,
  ClipboardList,
  Contact,
  FileInput,
  FileText,
  Hammer,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  ReceiptText,
  Ruler,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * Folha do menu: um link único, gated por uma permissão.
 */
export interface MenuLeaf {
  label: string
  to: string
  icon: LucideIcon
  permission: string
}

/**
 * Grupo do menu: um rótulo de seção que agrupa folhas. O grupo aparece
 * somente se pelo menos uma folha for permitida na empresa ativa.
 */
export interface MenuGroup {
  label: string
  icon: LucideIcon
  children: MenuLeaf[]
}

export type MenuEntry = MenuLeaf | MenuGroup

export function isMenuGroup(entry: MenuEntry): entry is MenuGroup {
  return 'children' in entry
}

export const MENU: MenuEntry[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
  {
    label: 'Cadastros',
    icon: ClipboardList,
    children: [
      { label: 'Clientes', to: '/customers', icon: Contact, permission: 'customers.view' },
      { label: 'Empresas', to: '/companies', icon: Building2, permission: 'companies.view' },
      { label: 'Fornecedores', to: '/suppliers', icon: Truck, permission: 'suppliers.view' },
      { label: 'Grupos de despesa', to: '/expense-groups', icon: ReceiptText, permission: 'expense_groups.view' },
      { label: 'Grupos de produto', to: '/product-groups', icon: Package, permission: 'product_groups.view' },
      { label: 'Grupos de serviço', to: '/service-groups', icon: Wrench, permission: 'service_groups.view' },
      { label: 'Marcas', to: '/brands', icon: Tags, permission: 'brands.view' },
      { label: 'Parametrizações de LDF', to: '/ldf-parameters', icon: SlidersHorizontal, permission: 'ldf_parameters.view' },
      { label: 'Produtos', to: '/products', icon: Boxes, permission: 'products.view' },
      { label: 'Serviços', to: '/services', icon: Hammer, permission: 'services.view' },
      { label: 'Tipos de documento', to: '/document-types', icon: FileText, permission: 'document_types.view' },
      { label: 'Tipos de pagamento', to: '/payment-types', icon: Wallet, permission: 'payment_types.view' },
      { label: 'Unidades de medida', to: '/units-of-measure', icon: Ruler, permission: 'units_of_measure.view' },
    ],
  },
  {
    label: 'Financeiro',
    icon: Landmark,
    children: [
      { label: 'Contas a pagar', to: '/payables', icon: Receipt, permission: 'payables.view' },
      { label: 'Contas a receber', to: '/receivables', icon: HandCoins, permission: 'receivables.view' },
    ],
  },
  {
    label: 'Serviços',
    icon: Briefcase,
    children: [
      { label: 'Entrada de serviço', to: '/service-entries', icon: FileInput, permission: 'service_entries.view' },
    ],
  },
  {
    label: 'Configurações',
    icon: Settings,
    children: [
      { label: 'Perfis', to: '/roles', icon: Shield, permission: 'roles.view' },
      { label: 'Permissões', to: '/permissions', icon: ShieldCheck, permission: 'permissions.view' },
      { label: 'Usuários', to: '/users', icon: Users, permission: 'users.view' },
    ],
  },
]
