import { Link, NavLink } from 'react-router-dom'
import { Boxes } from 'lucide-react'
import { MENU } from '@/permissions/menu'
import { usePermissions } from '@/permissions/use-permissions'
import { CompanySwitcher } from '@/components/company-switcher'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  collapsed: boolean
}

/**
 * Retractable sidebar. The navigation is dynamic: only menu items whose
 * permission is granted in the active company are rendered.
 */
export function AppSidebar({ collapsed }: AppSidebarProps) {
  const { can } = usePermissions()
  const items = MENU.filter((item) => can(item.permission))

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
        className="flex h-14 items-center gap-2.5 px-4 transition-opacity hover:opacity-80"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="size-5" />
        </span>
        {!collapsed && <span className="text-sm font-semibold tracking-tight">MPM Web</span>}
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
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
        ))}
      </nav>

      <div className="border-t px-3 py-3">
        <CompanySwitcher collapsed={collapsed} />
      </div>
    </aside>
  )
}
