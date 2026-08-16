import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ldfParametersApi, type LdfParameterListParams } from '@/services/ldf-parameters-api'
import { expenseGroupsApi } from '@/services/expense-groups-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import type { LdfParameter } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { LdfParameterFormDialog } from '@/modules/ldf-parameters/ldf-parameter-form-dialog'
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

/**
 * Parametrizações de LDF (lançamento direto financeiro). Ver
 * `docs/spec/cadastros/018`: mesma dinâmica da família de cadastros
 * (paginação 20/página, colunas ordenáveis, modal, hard delete), com FK
 * obrigatória para grupo de despesa e filtros por código, descrição e grupo.
 */
export function LdfParametersPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({ code: '', description: '', groupFilter: 'all' })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LdfParameter | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const groupsQuery = useQuery({
    queryKey: ['expense-groups', companyId, 'options'],
    queryFn: () =>
      expenseGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
  })
  const groupOptions = useMemo(
    () => (groupsQuery.data?.data ?? []).filter((group) => group.isActive),
    [groupsQuery.data]
  )

  const listParams = useMemo<LdfParameterListParams>(
    () => ({
      code: filters.applied.code ? Number(filters.applied.code) : undefined,
      description: filters.applied.description || undefined,
      expenseGroupId:
        filters.applied.groupFilter === 'all' ? undefined : Number(filters.applied.groupFilter),
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [filters.applied, page, sort]
  )

  const listQuery = useQuery({
    queryKey: ['ldf-parameters', companyId, listParams],
    queryFn: () => ldfParametersApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ldfParametersApi.remove(id),
    onSuccess: () => {
      toast.success('Parametrização de LDF removida.')
      queryClient.invalidateQueries({ queryKey: ['ldf-parameters'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row: LdfParameter) {
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
        icon={SlidersHorizontal}
        title="Parametrizações de LDF"
        description="Parametrize os lançamentos diretos financeiros da empresa ativa e o grupo de despesa de cada um."
      >
        <Can permission="ldf_parameters.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nova parametrização
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          {/* `block` no label: o <input> é inline — sem isso ele sobe para a
              mesma linha do rótulo (os demais filtros têm um wrapper bloco). */}
          <label className="block text-xs font-medium text-muted-foreground">Código</label>
          <Input
            inputMode="numeric"
            placeholder="Código"
            value={filters.draft.code}
            onChange={(event) =>
              filters.setField('code', event.target.value.replace(/\D/g, ''))
            }
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            className="w-36"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Descrição</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição"
              value={filters.draft.description}
              onChange={(event) => filters.setField('description', event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              className="w-56 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Grupo de despesa</label>
          <Select
            value={filters.draft.groupFilter}
            onValueChange={(value) => filters.setField('groupFilter', value)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {groupOptions.map((group) => (
                <SelectItem key={group.id} value={String(group.id)}>
                  {group.description}
                </SelectItem>
              ))}
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
            icon={SlidersHorizontal}
            title={
              filters.isFiltered
                ? 'Nenhuma parametrização de LDF encontrada'
                : 'Nenhuma parametrização de LDF cadastrada'
            }
            description={
              filters.isFiltered
                ? 'Tente ajustar os filtros da busca.'
                : 'Cadastre a primeira parametrização de LDF desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="id" sort={sort} onSort={toggleSort}>
                  Código
                </SortableHeader>
                <SortableHeader column="description" sort={sort} onSort={toggleSort}>
                  Descrição
                </SortableHeader>
                <TableHead>Grupo de despesa</TableHead>
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
                  <TableCell className="font-medium">{row.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.expenseGroupDescription || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="ldf_parameters.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="ldf_parameters.delete">
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

      <LdfParameterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        ldfParameter={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir parametrização de LDF"
        description="Esta ação é permanente. Se a parametrização já estiver vinculada a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
