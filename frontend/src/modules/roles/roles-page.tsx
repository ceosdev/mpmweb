import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Shield, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { rolesApi } from '@/services/roles-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import type { RoleListItem } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PER_PAGE = 20

/**
 * Roles (per-company profiles) listing. The platform-level ROOT role is
 * filtered out by the backend; only manageable profiles for the active
 * company are listed.
 */
export function RolesPage() {
  const navigate = useNavigate()
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const [deleteRow, setDeleteRow] = useState<RoleListItem | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listQuery = useQuery({
    queryKey: ['roles-list', companyId, debouncedSearch, page, sort],
    queryFn: () =>
      rolesApi.list({
        search: debouncedSearch || undefined,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rolesApi.remove(id),
    onSuccess: () => {
      toast.success('Perfil removido.')
      queryClient.invalidateQueries({ queryKey: ['roles-list'] })
      queryClient.invalidateQueries({ queryKey: ['roles', companyId] })
      setDeleteRow(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasSearch = debouncedSearch.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfis"
        description="Cadastre os perfis (roles) da empresa ativa e defina as permissões de cada um."
      >
        <Can permission="roles.create">
          <Button onClick={() => navigate('/roles/new')}>
            <Plus className="size-4" />
            Novo perfil
          </Button>
        </Can>
      </PageHeader>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <Card>
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={hasSearch ? 'Nenhum perfil encontrado' : 'Nenhum perfil cadastrado'}
            description={
              hasSearch
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro perfil desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="name" sort={sort} onSort={toggleSort}>
                  Nome
                </SortableHeader>
                <TableHead>Descrição</TableHead>
                <TableHead>Permissões</TableHead>
                <SortableHeader column="is_active" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.description || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.permissionsCount} permissões</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="roles.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label="Editar"
                        >
                          <Link to={`/roles/${row.id}/edit`}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                      </Can>
                      <Can permission="roles.delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRow(row)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {meta && <Pagination meta={meta} onChange={setPage} />}

      <ConfirmDialog
        open={deleteRow !== null}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        title="Excluir perfil"
        description={
          deleteRow
            ? `Tem certeza que deseja excluir o perfil "${deleteRow.name}"? Se houver usuários atrelados a este perfil, a exclusão será bloqueada.`
            : ''
        }
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteRow && deleteMutation.mutate(deleteRow.id)}
      />
    </div>
  )
}
