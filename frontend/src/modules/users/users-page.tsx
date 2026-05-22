import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { usersApi } from '@/services/users-api'
import { catalogApi } from '@/services/catalog-api'
import { useAuth } from '@/providers/auth-provider'
import { usePermissions } from '@/permissions/use-permissions'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import type { UserDetail } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { UserFormDialog } from '@/modules/users/user-form-dialog'
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
 * Users module — CRUD scoped to the active company, gated by RBAC.
 */
export function UsersPage() {
  const { tenant } = useAuth()
  const { can } = usePermissions()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const canEditOrCreate = can('users.create') || can('users.edit')

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listQuery = useQuery({
    queryKey: ['users', companyId, debouncedSearch, page, sort],
    queryFn: () =>
      usersApi.list({
        search: debouncedSearch || undefined,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    placeholderData: (prev) => prev,
  })

  const rolesQuery = useQuery({
    queryKey: ['roles', companyId],
    queryFn: catalogApi.roles,
    enabled: canEditOrCreate,
  })

  const permissionsQuery = useQuery({
    queryKey: ['permissions', companyId],
    queryFn: catalogApi.permissions,
    enabled: can('permissions.manage'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      toast.success('Usuário removido da empresa.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  async function openCreate() {
    setEditingUser(null)
    setFormOpen(true)
  }

  async function openEdit(id: number) {
    try {
      const detail = await usersApi.get(id)
      setEditingUser(detail)
      setFormOpen(true)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const users = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Gerencie os usuários vinculados à empresa ativa.">
        <Can permission="users.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo usuário
          </Button>
        </Can>
      </PageHeader>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail"
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
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário encontrado"
            description="Cadastre o primeiro usuário desta empresa."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="name" sort={sort} onSort={toggleSort}>
                  Nome
                </SortableHeader>
                <SortableHeader column="email" sort={sort} onSort={toggleSort}>
                  E-mail
                </SortableHeader>
                <TableHead>Perfil</TableHead>
                <SortableHeader column="is_active" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <SortableHeader column="last_login_at" sort={sort} onSort={toggleSort}>
                  Último acesso
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.membershipId}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.role ? <Badge variant="secondary">{user.role.name}</Badge> : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'outline'}>
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.lastLoginAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="users.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void openEdit(user.id)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="users.delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(user.id)}
                          aria-label="Remover"
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

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        roles={rolesQuery.data ?? []}
        permissions={permissionsQuery.data ?? []}
        canManagePermissions={can('permissions.manage')}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remover usuário"
        description="O usuário perderá o acesso a esta empresa. Esta ação pode ser desfeita recriando o vínculo."
        confirmLabel="Remover"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
