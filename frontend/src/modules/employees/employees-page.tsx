import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IdCard, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { employeesApi, type EmployeeListParams } from '@/services/employees-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import { maskCpf, maskPhone } from '@/lib/masks'
import type { Employee } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { MaskedInput } from '@/components/form/masked-input'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { EmployeeFormDialog } from '@/modules/employees/employee-form-dialog'
import { Button } from '@/components/ui/button'
import { SearchButton } from '@/components/common/search-button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PER_PAGE = 20

type StatusFilter = 'all' | 'active' | 'inactive'

/** Mobile first — it is what an employee usually has; landline as fallback. */
function displayPhone(employee: Employee): string {
  const value = employee.mobile || employee.phone
  return value ? maskPhone(value) : '—'
}

export function EmployeesPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({
    id: '',
    name: '',
    taxId: '',
    status: 'active' as StatusFilter,
  })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listParams = useMemo<EmployeeListParams>(
    () => ({
      id: filters.applied.id ? Number(filters.applied.id) : undefined,
      name: filters.applied.name || undefined,
      taxId: filters.applied.taxId || undefined,
      status: filters.applied.status,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [filters.applied, page, sort]
  )

  const listQuery = useQuery({
    queryKey: ['employees', companyId, listParams],
    queryFn: () => employeesApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => employeesApi.remove(id),
    onSuccess: () => {
      toast.success('Funcionário removido.')
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: Employee) {
    setEditing(row)
    setFormOpen(true)
  }

  function handleSearch() {
    filters.apply()
    setPage(1)
  }
  function clearFilters() {
    filters.clear()
    setPage(1)
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        icon={IdCard}
        title="Funcionários"
        description="Cadastre os funcionários da empresa ativa."
      >
        <Can permission="employees.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo funcionário
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          {/* `block` no label: o <input> é inline — sem isso ele sobe para a
              mesma linha do rótulo (os demais filtros têm wrapper bloco). */}
          <label className="block text-xs font-medium text-muted-foreground">Código</label>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Código"
            value={filters.draft.id}
            onChange={(event) => filters.setField('id', event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            className="w-24"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nome</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome"
              value={filters.draft.name}
              onChange={(event) => filters.setField('name', event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              className="w-64 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">CPF</label>
          <MaskedInput
            placeholder="Buscar por CPF"
            value={filters.draft.taxId}
            onChange={(value) => filters.setField('taxId', value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            mask={maskCpf}
            maxDigits={11}
            className="block w-44"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select
            value={filters.draft.status}
            onValueChange={(value) => filters.setField('status', value as StatusFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SearchButton onClick={handleSearch} loading={listQuery.isFetching} />
        {filters.isDirty && (
          <Button variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
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
            icon={IdCard}
            title={
              filters.isFiltered
                ? 'Nenhum funcionário encontrado'
                : 'Nenhum funcionário cadastrado'
            }
            description={
              filters.isFiltered
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro funcionário desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="id" sort={sort} onSort={toggleSort}>
                  Código
                </SortableHeader>
                <SortableHeader column="name" sort={sort} onSort={toggleSort}>
                  Nome
                </SortableHeader>
                <SortableHeader column="tax_id" sort={sort} onSort={toggleSort}>
                  CPF
                </SortableHeader>
                <SortableHeader column="role_title" sort={sort} onSort={toggleSort}>
                  Função
                </SortableHeader>
                <TableHead>Celular</TableHead>
                <SortableHeader column="is_active" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{row.id}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.taxId ? maskCpf(row.taxId) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.roleTitle || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{displayPhone(row)}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="employees.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="employees.delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
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

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir funcionário"
        description="Esta ação é permanente. Se o funcionário já estiver vinculado a outros registros, a exclusão será bloqueada — nesse caso, inative-o."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
