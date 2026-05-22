import { LogOut, PanelLeft } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { usePermissions } from '@/permissions/use-permissions'
import { getInitials } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AppHeaderProps {
  onToggleSidebar: () => void
}

const ROLE_LABELS: Record<string, string> = {
  root: 'ROOT',
  admin: 'ADMIN',
  operator: 'OPERADOR',
}

/**
 * Top bar — sidebar toggle, theme switch and the user menu.
 */
export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const { user, logout } = useAuth()
  const { role } = usePermissions()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Recolher menu">
        <PanelLeft className="size-4" />
      </Button>

      <div className="flex-1" />

      {role && <Badge variant="secondary">{ROLE_LABELS[role] ?? role}</Badge>}
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Abrir menu do usuário">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {user ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate font-medium">{user?.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void logout()} className="text-destructive">
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
