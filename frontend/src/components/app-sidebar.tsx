import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Boxes, ChevronDown } from 'lucide-react'
import {
  MENU,
  isMenuGroup,
  type MenuEntry,
  type MenuGroup,
  type MenuLeaf,
} from '@/permissions/menu'
import { usePermissions } from '@/permissions/use-permissions'
import { CompanySwitcher } from '@/components/company-switcher'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  collapsed: boolean
}

/**
 * Retractable sidebar. A navegação é dinâmica: apenas itens cujas permissões
 * estão concedidas na empresa ativa aparecem. Itens podem estar agrupados em
 * seções (Cadastros, Configurações) — um grupo só aparece se ao menos um
 * filho passar pelo filtro de permissões.
 *
 * No modo recolhido, os grupos são "achatados" para uma lista plana de
 * ícones — não há espaço para rótulos de seção nem chevrons.
 *
 * Os grupos começam sempre fechados ao entrar na aplicação; expandir é uma
 * ação explícita do usuário.
 */
export function AppSidebar({ collapsed }: AppSidebarProps) {
  const { can } = usePermissions()
  const items = filterMenu(MENU, can)

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      <Link
        to="/"
        title={collapsed ? 'Ir para o dashboard' : undefined}
        className="flex h-14 shrink-0 items-center gap-2.5 px-4 transition-opacity hover:opacity-80"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="size-5" />
        </span>
        {!collapsed && <span className="text-sm font-semibold tracking-tight">MPM Web</span>}
      </Link>

      {/*
        `min-h-0` é o que faz o scroll funcionar: num flex column, um filho
        `flex-1` não encolhe abaixo da altura do próprio conteúdo sem isso — o
        menu crescia para fora da tela e levava o seletor de empresa junto,
        deixando os últimos grupos inalcançáveis com tudo expandido.
      */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {collapsed
          ? flattenLeaves(items).map((leaf) => (
              <SidebarLeaf key={leaf.to} item={leaf} collapsed />
            ))
          : items.map((entry) =>
              isMenuGroup(entry) ? (
                <SidebarGroup key={entry.label} group={entry} />
              ) : (
                <SidebarLeaf key={entry.to} item={entry} collapsed={false} />
              )
            )}
      </nav>

      <div className="shrink-0 border-t px-3 py-3">
        <CompanySwitcher collapsed={collapsed} />
      </div>
    </aside>
  )
}

function SidebarLeaf({ item, collapsed }: { item: MenuLeaf; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-primary/10 font-medium text-primary dark:bg-sidebar-accent dark:text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
        )
      }
    >
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  )
}

function SidebarGroup({ group }: { group: MenuGroup }) {
  // Ao entrar na aplicação, todo grupo começa fechado — nada abre sozinho, nem
  // mesmo o grupo que contém a rota atual. Só o clique do usuário expande.
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      >
        <group.icon className="size-4 shrink-0" />
        <span className="flex-1 text-left font-medium">{group.label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform',
            !expanded && '-rotate-90'
          )}
        />
      </button>
      {expanded && (
        <div className="ml-3 space-y-1 border-l pl-2">
          {group.children.map((leaf) => (
            <SidebarLeaf key={leaf.to} item={leaf} collapsed={false} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Aplica o filtro de permissões. Grupos sem filhos visíveis somem por completo. */
function filterMenu(items: MenuEntry[], can: (permission: string) => boolean): MenuEntry[] {
  const result: MenuEntry[] = []
  for (const item of items) {
    if (isMenuGroup(item)) {
      const visibleChildren = item.children.filter((child) => can(child.permission))
      if (visibleChildren.length > 0) {
        result.push({ ...item, children: visibleChildren })
      }
    } else if (can(item.permission)) {
      result.push(item)
    }
  }
  return result
}

/** Achata uma lista de menus (grupos + folhas) em apenas folhas. */
function flattenLeaves(items: MenuEntry[]): MenuLeaf[] {
  return items.flatMap((item) => (isMenuGroup(item) ? item.children : [item]))
}
