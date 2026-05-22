import { useState } from 'react'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/auth-provider'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CompanySwitcherProps {
  collapsed?: boolean
}

/**
 * Switches the active company. Picking a company re-resolves the permission
 * set, which updates the menu and every permission-gated element.
 */
export function CompanySwitcher({ collapsed = false }: CompanySwitcherProps) {
  const { companies, activeCompanyId, selectCompany } = useAuth()
  const [switching, setSwitching] = useState(false)

  const active = companies.find((c) => c.id === activeCompanyId)
  const label = active ? (active.tradeName ?? active.legalName) : 'Selecione a empresa'

  async function handleSelect(companyId: number) {
    if (companyId === activeCompanyId || switching) return
    setSwitching(true)
    try {
      await selectCompany(companyId)
      toast.success('Empresa ativa alterada.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSwitching(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex w-full items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent',
          collapsed && 'justify-center px-0'
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="size-4" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate font-medium">{label}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Empresas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleSelect(company.id)}
            className="gap-2"
          >
            <span className="flex-1 truncate">{company.tradeName ?? company.legalName}</span>
            {company.id === activeCompanyId && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
