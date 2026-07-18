import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, HardDrive, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { productAssetsApi, type ProductAssetListParams } from '@/services/product-assets-api'
import { productsApi } from '@/services/products-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import type { AssetSituation, ProductAsset } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { ProductAssetFormDialog } from '@/modules/product-assets/product-asset-form-dialog'
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

const SITUATION_LABELS: Record<AssetSituation, string> = {
  available: 'Disponível',
  allocated: 'Alocado',
  sold: 'Vendido',
}

/** Semantic badge colors per situation — theme-aware (claro/escuro). */
const SITUATION_BADGE: Record<AssetSituation, string> = {
  available: 'bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  allocated: 'bg-muted text-muted-foreground',
  sold: 'bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
}

type SituationFilter = AssetSituation | 'all'

/**
 * Drill-down page reached from `/products` (only for fixed-asset products). The
 * parent product id comes from the URL path; the page reuses the CRUD shape but
 * is scoped to that single parent.
 */
export function ProductAssetsPage() {
  const { productId: productIdParam } = useParams<{ productId: string }>()
  const productId = Number(productIdParam)
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({
    assetCode: '',
    description: '',
    situationFilter: 'all' as SituationFilter,
  })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductAsset | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const parentQuery = useQuery({
    queryKey: ['products', companyId, productId],
    queryFn: () => productsApi.get(productId),
    enabled: Number.isFinite(productId) && productId > 0,
    retry: false,
  })

  const parentInvalid =
    !Number.isFinite(productId) || productId <= 0 || parentQuery.isError
  // A product that exists but is not a fixed asset cannot own assets.
  const notFixedAsset = !!parentQuery.data && parentQuery.data.type !== 'fixed_asset'
  const canList = !!parentQuery.data && !notFixedAsset

  const listParams = useMemo<ProductAssetListParams>(
    () => ({
      assetCode: filters.applied.assetCode || undefined,
      description: filters.applied.description || undefined,
      situation:
        filters.applied.situationFilter === 'all' ? undefined : filters.applied.situationFilter,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [filters.applied, page, sort]
  )

  const listQuery = useQuery({
    queryKey: ['product-assets', companyId, productId, listParams],
    queryFn: () => productAssetsApi.list(productId, listParams),
    enabled: canList,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productAssetsApi.remove(productId, id),
    onSuccess: () => {
      toast.success('Ativo removido.')
      queryClient.invalidateQueries({ queryKey: ['product-assets', companyId, productId] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: ProductAsset) {
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

  const backLink = (
    <Link
      to="/products"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Produtos
    </Link>
  )

  if (parentInvalid) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="py-12">
          <EmptyState
            icon={HardDrive}
            title="Produto não encontrado"
            description="O produto solicitado não existe ou foi removido."
          />
        </Card>
      </div>
    )
  }

  if (notFixedAsset) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="py-12">
          <EmptyState
            icon={HardDrive}
            title="Produto não permite ativos"
            description="Apenas produtos do tipo ativo imobilizado podem ter ativos cadastrados."
          />
        </Card>
      </div>
    )
  }

  const parentName = parentQuery.data?.description
  const title = parentName ? `Ativos de ${parentName}` : 'Ativos'
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <PageHeader icon={HardDrive} title={title} description="Ativos vinculados a este produto imobilizado.">
          <Can permission="product_assets.create">
            <Button onClick={openCreate} disabled={!parentQuery.data}>
              <Plus className="size-4" />
              Novo ativo
            </Button>
          </Can>
        </PageHeader>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cód. patrimônio</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por patrimônio"
              value={filters.draft.assetCode}
              onChange={(event) => filters.setField('assetCode', event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              className="w-48 pl-9"
            />
          </div>
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
          <label className="text-xs font-medium text-muted-foreground">Situação</label>
          <Select
            value={filters.draft.situationFilter}
            onValueChange={(value) => filters.setField('situationFilter', value as SituationFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="allocated">Alocado</SelectItem>
              <SelectItem value="sold">Vendido</SelectItem>
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
        {parentQuery.isLoading || listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={HardDrive}
            title={filters.isFiltered ? 'Nenhum ativo encontrado' : 'Nenhum ativo cadastrado'}
            description={
              filters.isFiltered
                ? 'Tente ajustar os filtros da busca.'
                : 'Cadastre o primeiro ativo deste produto.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="description" sort={sort} onSort={toggleSort}>
                  Descrição
                </SortableHeader>
                <SortableHeader column="asset_code" sort={sort} onSort={toggleSort}>
                  Cód. patrimônio
                </SortableHeader>
                <SortableHeader column="situation" sort={sort} onSort={toggleSort}>
                  Situação
                </SortableHeader>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.description}</TableCell>
                  <TableCell className="text-muted-foreground">{row.assetCode || '—'}</TableCell>
                  <TableCell>
                    <Badge className={SITUATION_BADGE[row.situation]}>
                      {SITUATION_LABELS[row.situation]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="product_assets.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="product_assets.delete">
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

      <ProductAssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        productId={productId}
        asset={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir ativo"
        description="Esta ação é permanente. Se o ativo já estiver vinculado a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
