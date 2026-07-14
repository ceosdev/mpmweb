import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, Search, Shapes, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { brandModelsApi } from '@/services/brand-models-api'
import { brandsApi } from '@/services/brands-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import type { BrandModel } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { BrandModelFormDialog } from '@/modules/brand-models/brand-model-form-dialog'
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
 * Drill-down page reached from `/brands`. The parent brand id comes from the
 * URL path; the page reuses the simple-CRUD shape but is scoped to that
 * single parent.
 */
export function BrandModelsPage() {
  const { brandId: brandIdParam } = useParams<{ brandId: string }>()
  const brandId = Number(brandIdParam)
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedSearch = useDebouncedValue(search)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BrandModel | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const parentQuery = useQuery({
    queryKey: ['brands', companyId, brandId],
    queryFn: () => brandsApi.get(brandId),
    enabled: Number.isFinite(brandId) && brandId > 0,
    retry: false,
  })

  const parentNotFound = !Number.isFinite(brandId) || brandId <= 0 || parentQuery.isError

  const listQuery = useQuery({
    queryKey: ['brand-models', companyId, brandId, debouncedSearch, page, sort],
    queryFn: () =>
      brandModelsApi.list(brandId, {
        search: debouncedSearch || undefined,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    enabled: !!parentQuery.data,
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => brandModelsApi.remove(brandId, id),
    onSuccess: () => {
      toast.success('Modelo removido.')
      queryClient.invalidateQueries({ queryKey: ['brand-models', companyId, brandId] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: BrandModel) {
    setEditing(row)
    setFormOpen(true)
  }

  const backLink = (
    <Link
      to="/brands"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Marcas
    </Link>
  )

  if (parentNotFound) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="py-12">
          <EmptyState
            icon={Shapes}
            title="Marca não encontrada"
            description="A marca solicitada não existe ou foi removida."
          />
        </Card>
      </div>
    )
  }

  const parentName = parentQuery.data?.description
  const title = parentName ? `Modelos de ${parentName}` : 'Modelos'
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasSearch = debouncedSearch.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <PageHeader icon={Shapes} title={title} description="Modelos vinculados a esta marca.">
          <Can permission="brand_models.create">
            <Button onClick={openCreate} disabled={!parentQuery.data}>
              <Plus className="size-4" />
              Novo modelo
            </Button>
          </Can>
        </PageHeader>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
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
            icon={Shapes}
            title={hasSearch ? 'Nenhum modelo encontrado' : 'Nenhum modelo cadastrado'}
            description={
              hasSearch
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro modelo desta marca.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell className="font-medium">{row.description}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="brand_models.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="brand_models.delete">
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

      <BrandModelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        brandId={brandId}
        brandModel={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir modelo"
        description="Esta ação é permanente. Se o modelo já estiver vinculado a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
