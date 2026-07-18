import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, HardDrive, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { productsApi, type ProductListParams } from '@/services/products-api'
import { productGroupsApi } from '@/services/product-groups-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { formatCurrency, formatQuantity } from '@/lib/masks'
import type { Product, ProductType } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { ProductFormDialog } from '@/modules/products/product-form-dialog'
import { Button } from '@/components/ui/button'
import { SearchButton } from '@/components/common/search-button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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

const TYPE_LABELS: Record<ProductType, string> = {
  consumable: 'Uso e consumo',
  fixed_asset: 'Ativo imobilizado',
}

type TypeFilter = ProductType | 'all'
type StatusFilter = 'all' | 'active' | 'inactive'
type ControlsStockFilter = 'all' | 'yes' | 'no'

/** A stock-controlled product whose balance is at or below the configured min. */
function isLowStock(row: Product): boolean {
  return (
    row.controlsStock &&
    row.minimumStock !== null &&
    (row.quantityInStock ?? 0) <= row.minimumStock
  )
}

export function ProductsPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({
    description: '',
    groupFilter: 'all',
    typeFilter: 'all' as TypeFilter,
    controlsStockFilter: 'all' as ControlsStockFilter,
    statusFilter: 'active' as StatusFilter,
    lowStockFilter: false,
  })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const groupsQuery = useQuery({
    queryKey: ['product-groups', companyId, 'options'],
    queryFn: () =>
      productGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
  })
  const groupOptions = useMemo(
    () => (groupsQuery.data?.data ?? []).filter((g) => g.isActive),
    [groupsQuery.data]
  )

  const listParams = useMemo<ProductListParams>(
    () => ({
      description: filters.applied.description || undefined,
      productGroupId:
        filters.applied.groupFilter === 'all' ? undefined : Number(filters.applied.groupFilter),
      type: filters.applied.typeFilter === 'all' ? undefined : filters.applied.typeFilter,
      controlsStock:
        filters.applied.controlsStockFilter === 'all'
          ? undefined
          : filters.applied.controlsStockFilter === 'yes',
      status: filters.applied.statusFilter,
      lowStock: filters.applied.lowStockFilter || undefined,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [filters.applied, page, sort]
  )

  const listQuery = useQuery({
    queryKey: ['products', companyId, listParams],
    queryFn: () => productsApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => {
      toast.success('Produto removido.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: Product) {
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
        icon={Boxes}
        title="Produtos"
        description="Cadastre os produtos da empresa ativa."
      >
        <Can permission="products.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo produto
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
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
          <label className="text-xs font-medium text-muted-foreground">Grupo</label>
          <Select
            value={filters.draft.groupFilter}
            onValueChange={(value) => filters.setField('groupFilter', value)}
          >
            <SelectTrigger className="w-44">
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

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select
            value={filters.draft.typeFilter}
            onValueChange={(value) => filters.setField('typeFilter', value as TypeFilter)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="consumable">Uso e consumo</SelectItem>
              <SelectItem value="fixed_asset">Ativo imobilizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Controla estoque</label>
          <Select
            value={filters.draft.controlsStockFilter}
            onValueChange={(value) =>
              filters.setField('controlsStockFilter', value as ControlsStockFilter)
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Sim</SelectItem>
              <SelectItem value="no">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select
            value={filters.draft.statusFilter}
            onValueChange={(value) => filters.setField('statusFilter', value as StatusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 self-end pb-2.5">
          <Checkbox
            id="lowStock"
            checked={filters.draft.lowStockFilter}
            onCheckedChange={(checked) => filters.setField('lowStockFilter', Boolean(checked))}
          />
          <Label htmlFor="lowStock" className="text-sm font-normal">
            Estoque baixo
          </Label>
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
            icon={Package}
            title={filters.isFiltered ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
            description={
              filters.isFiltered
                ? 'Tente ajustar os filtros da busca.'
                : 'Cadastre o primeiro produto desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="description" sort={sort} onSort={toggleSort}>
                  Descrição
                </SortableHeader>
                <SortableHeader column="type" sort={sort} onSort={toggleSort}>
                  Tipo
                </SortableHeader>
                <TableHead>Grupo</TableHead>
                <TableHead>Unidade</TableHead>
                <SortableHeader column="quantity_in_stock" sort={sort} onSort={toggleSort}>
                  Estoque
                </SortableHeader>
                <SortableHeader column="cost_price" sort={sort} onSort={toggleSort}>
                  Custo
                </SortableHeader>
                <SortableHeader column="is_active" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const low = isLowStock(row)
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {TYPE_LABELS[row.type]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.groupDescription || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.unitDescription || '—'}
                    </TableCell>
                    <TableCell>
                      {row.controlsStock && row.quantityInStock !== null ? (
                        <span
                          className={cn(
                            low && 'font-medium text-destructive'
                          )}
                        >
                          {formatQuantity(row.quantityInStock)}
                          {low && ' (baixo)'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.costPrice !== null ? formatCurrency(row.costPrice) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? 'default' : 'outline'}>
                        {row.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {row.type === 'fixed_asset' && (
                          <Can permission="product_assets.view">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/products/${row.id}/assets`)}
                              aria-label="Ativos"
                            >
                              <HardDrive className="size-4" />
                            </Button>
                          </Can>
                        )}
                        <Can permission="products.edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(row)}
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </Can>
                        <Can permission="products.delete">
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
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {meta && <Pagination meta={meta} onChange={setPage} />}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir produto"
        description="Esta ação é permanente. Se o produto já estiver vinculado a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
