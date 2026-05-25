import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, Users } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { usePermissions } from '@/permissions/use-permissions'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { companiesApi } from '@/services/companies-api'
import { usersApi } from '@/services/users-api'
import { cn } from '@/lib/utils'
import type { ImportableUser } from '@/types/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'

interface ImportUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the operator confirms selection. Receives the chosen user
   *  and the friendly name of the source company (used in the banner). */
  onSelect: (user: ImportableUser, sourceCompanyName: string) => void
}

/**
 * Modal de seleção para a importação de usuários vindos de outra empresa.
 * Carrega as empresas elegíveis (todas ativas exceto a logada), depois os
 * usuários da empresa escolhida. ROOT e quem já tem vínculo na empresa
 * logada são filtrados no backend.
 */
export function ImportUserDialog({ open, onOpenChange, onSelect }: ImportUserDialogProps) {
  const { tenant } = useAuth()
  const { can } = usePermissions()
  const tenantId = tenant?.companyId

  const [companyId, setCompanyId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<ImportableUser | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  // Reseta sempre que o modal abre — não persiste seleção/busca entre aberturas.
  useEffect(() => {
    if (!open) return
    setCompanyId('')
    setSearch('')
    setSelectedUser(null)
  }, [open])

  const companiesQuery = useQuery({
    queryKey: ['import-source-companies', tenantId],
    queryFn: companiesApi.importSources,
    enabled: open && can('users.import'),
  })

  const usersQuery = useQuery({
    queryKey: ['importable-users', tenantId, companyId, debouncedSearch],
    queryFn: () => usersApi.importable(Number(companyId), debouncedSearch || undefined),
    enabled: open && !!companyId,
  })

  const sourceCompanyName = useMemo(() => {
    const found = companiesQuery.data?.find((c) => String(c.id) === companyId)
    return found ? (found.tradeName || found.legalName) : ''
  }, [companiesQuery.data, companyId])

  function confirm() {
    if (selectedUser && sourceCompanyName) {
      onSelect(selectedUser, sourceCompanyName)
    }
  }

  const companies = companiesQuery.data ?? []
  const users = usersQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar usuário de outra empresa</DialogTitle>
          <DialogDescription>
            Reaproveite um usuário já cadastrado em outra empresa, vinculando-o
            à empresa logada. A senha e os dados pessoais dele não serão
            alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Empresa de origem</label>
            {companiesQuery.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={companyId}
                onValueChange={(value) => {
                  setCompanyId(value)
                  setSelectedUser(null)
                  setSearch('')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Nenhuma empresa disponível.
                    </div>
                  ) : (
                    companies.map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>
                        {company.tradeName || company.legalName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {companyId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Usuário</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou e-mail"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {usersQuery.isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Nenhum usuário disponível"
                    description="Esta empresa não tem usuários elegíveis para importação."
                  />
                ) : (
                  <ul className="divide-y">
                    {users.map((user) => {
                      const isSelected = selectedUser?.id === user.id
                      return (
                        <li key={user.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-foreground'
                                : 'hover:bg-accent'
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{user.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                                Selecionado
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={!selectedUser}>
            {usersQuery.isFetching && <Loader2 className="size-4 animate-spin" />}
            Selecionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
