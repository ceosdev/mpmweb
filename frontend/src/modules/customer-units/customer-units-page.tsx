import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { customerUnitsApi } from '@/services/customer-units-api'
import { customerRegionsApi } from '@/services/customer-regions-api'
import { customersApi } from '@/services/customers-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import type { CustomerUnit } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { CustomerUnitFormDialog } from '@/modules/customer-units/customer-unit-form-dialog'
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
 * Drill-down page reached from the regions of a customer. Both parent ids
 * come from the URL path. No permission of its own: reading needs
 * `customers.view`, maintaining needs `customers.edit`.
 */
export function CustomerUnitsPage() {
  const params = useParams<{ customerId: string; regionId: string }>()
  const customerId = Number(params.customerId)
  const regionId = Number(params.regionId)
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({ id: '', search: '', status: 'active' as StatusFilter })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerUnit | null>(null)
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

  const validIds =
    Number.isFinite(customerId) && customerId > 0 && Number.isFinite(regionId) && regionId > 0

  const customerQuery = useQuery({
    queryKey: ['customers', companyId, customerId],
    queryFn: () => customersApi.get(customerId),
    enabled: validIds,
    retry: false,
  })

  // A API devolve 404 se a regional não for deste cliente.
  const regionQuery = useQuery({
    queryKey: ['customer-regions', companyId, customerId, 'detail', regionId],
    queryFn: () => customerRegionsApi.get(customerId, regionId),
    enabled: validIds,
    retry: false,
  })

  const parentNotFound = !validIds || customerQuery.isError || regionQuery.isError
  const parentsLoaded = !!customerQuery.data && !!regionQuery.data

  const listQuery = useQuery({
    queryKey: ['customer-units', companyId, regionId, filters.applied, page, sort],
    queryFn: () =>
      customerUnitsApi.list(customerId, regionId, {
        id: filters.applied.id ? Number(filters.applied.id) : undefined,
        search: filters.applied.search || undefined,
        status: filters.applied.status,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    enabled: parentsLoaded,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customerUnitsApi.remove(customerId, regionId, id),
    onSuccess: () => {
      toast.success('Unidade removida.')
      queryClient.invalidateQueries({ queryKey: ['customer-units', companyId, regionId] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: CustomerUnit) {
    setEditing(row)
    setFormOpen(true)
  }

  const customerName = customerQuery.data ? customerDisplayName(customerQuery.data) : undefined

  const backLink = (
    <Link
      to={parentNotFound ? '/customers' : `/customers/${customerId}/regions`}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      {parentNotFound
        ? 'Clientes'
        : customerName
          ? `Regionais de ${customerName}`
          : 'Regionais'}
    </Link>
  )

  if (parentNotFound) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="py-12">
          <EmptyState
            icon={Building2}
            title="Regional não encontrada"
            description="A regional solicitada não existe, foi removida ou não pertence a este cliente."
          />
        </Card>
      </div>
    )
  }

  const regionName = regionQuery.data?.description
  const title = regionName ? `Unidades de ${regionName}` : 'Unidades'
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasSearch = filters.isFiltered

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <PageHeader
          icon={Building2}
          title={title}
          description={customerName ? `Cliente: ${customerName}` : 'Unidades vinculadas a esta regional.'}
        >
          <Can permission="customers.edit">
            <Button onClick={openCreate} disabled={!parentsLoaded}>
              <Plus className="size-4" />
              Nova unidade
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
        {customerQuery.isLoading || regionQuery.isLoading || listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={hasSearch ? 'Nenhuma unidade encontrada' : 'Nenhuma unidade cadastrada'}
            description={
              hasSearch
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre a primeira unidade desta regional.'
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

      <CustomerUnitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customerId={customerId}
        regionId={regionId}
        unit={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir unidade"
        description="Esta ação é permanente. Se a unidade já estiver vinculada a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
