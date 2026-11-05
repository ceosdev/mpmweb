import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Network, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { customerRegionsApi } from '@/services/customer-regions-api'
import { customersApi } from '@/services/customers-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import type { CustomerRegion } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { CustomerRegionFormDialog } from '@/modules/customer-regions/customer-region-form-dialog'
import { customerDisplayName } from '@/modules/customer-regions/customer-display-name'
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

/**
 * Drill-down page reached from `/customers`. The parent customer id comes
 * from the URL path; the page reuses the simple-CRUD shape but is scoped to
 * that single parent. No permission of its own: reading needs
 * `customers.view`, maintaining needs `customers.edit`.
 */
export function CustomerRegionsPage() {
  const { customerId: customerIdParam } = useParams<{ customerId: string }>()
  const customerId = Number(customerIdParam)
  const navigate = useNavigate()
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({ id: '', search: '', status: 'active' as StatusFilter })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerRegion | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  function handleSearch() {
    filters.apply()
    setPage(1)
  }
  function clearFilters() {
    filters.clear()
    setPage(1)
  }

  const validId = Number.isFinite(customerId) && customerId > 0

  const parentQuery = useQuery({
    queryKey: ['customers', companyId, customerId],
    queryFn: () => customersApi.get(customerId),
    enabled: validId,
    retry: false,
  })

  const parentNotFound = !validId || parentQuery.isError

  const listQuery = useQuery({
    queryKey: ['customer-regions', companyId, customerId, filters.applied, page, sort],
    queryFn: () =>
      customerRegionsApi.list(customerId, {
        id: filters.applied.id ? Number(filters.applied.id) : undefined,
        search: filters.applied.search || undefined,
        status: filters.applied.status,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    enabled: !!parentQuery.data,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customerRegionsApi.remove(customerId, id),
    onSuccess: () => {
      toast.success('Regional removida.')
      queryClient.invalidateQueries({ queryKey: ['customer-regions', companyId, customerId] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: CustomerRegion) {
    setEditing(row)
    setFormOpen(true)
  }

  const backLink = (
    <Link
      to="/customers"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Clientes
    </Link>
  )

  if (parentNotFound) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="py-12">
          <EmptyState
            icon={Network}
            title="Cliente não encontrado"
            description="O cliente solicitado não existe ou foi removido."
          />
        </Card>
      </div>
    )
  }

  const parentName = parentQuery.data ? customerDisplayName(parentQuery.data) : undefined
  const title = parentName ? `Regionais de ${parentName}` : 'Regionais'
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasSearch = filters.isFiltered

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <PageHeader icon={Network} title={title} description="Regionais vinculadas a este cliente.">
          <Can permission="customers.edit">
            <Button onClick={openCreate} disabled={!parentQuery.data}>
              <Plus className="size-4" />
              Nova regional
            </Button>
          </Can>
        </PageHeader>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-[7rem]">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Código"
            value={filters.draft.id}
            onChange={(event) => filters.setField('id', event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição"
            value={filters.draft.search}
            onChange={(event) => filters.setField('search', event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.draft.status}
          onValueChange={(value) => filters.setField('status', value as StatusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <SearchButton onClick={handleSearch} loading={listQuery.isFetching} />
        {filters.isDirty && (
          <Button variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      <Card>
        {parentQuery.isLoading || listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Network}
            title={hasSearch ? 'Nenhuma regional encontrada' : 'Nenhuma regional cadastrada'}
            description={
              hasSearch
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre a primeira regional deste cliente.'
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
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="customers.view">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            navigate(`/customers/${customerId}/regions/${row.id}/units`)
                          }
                          aria-label="Unidades"
                          title="Unidades"
                        >
                          <Building2 className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="customers.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
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

      <CustomerRegionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customerId={customerId}
        region={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir regional"
        description="Esta ação é permanente. Se a regional já tiver unidades cadastradas, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
