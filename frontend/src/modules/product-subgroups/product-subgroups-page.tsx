import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { productSubgroupsApi } from '@/services/product-subgroups-api'
import { productGroupsApi } from '@/services/product-groups-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import type { ProductSubgroup } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { ProductSubgroupFormDialog } from '@/modules/product-subgroups/product-subgroup-form-dialog'
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
 * Drill-down page reached from `/product-groups`. The parent group id comes
 * from the URL path; the page reuses the simple-CRUD shape but is scoped to
 * that single parent.
 */
export function ProductSubgroupsPage() {
  const { groupId: groupIdParam } = useParams<{ groupId: string }>()
  const groupId = Number(groupIdParam)
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedSearch = useDebouncedValue(search)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductSubgroup | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const parentQuery = useQuery({
    queryKey: ['product-groups', companyId, groupId],
    queryFn: () => productGroupsApi.get(groupId),
    enabled: Number.isFinite(groupId) && groupId > 0,
    retry: false,
  })

  const parentNotFound =
    !Number.isFinite(groupId) || groupId <= 0 || parentQuery.isError

  const listQuery = useQuery({
    queryKey: ['product-subgroups', companyId, groupId, debouncedSearch, page, sort],
    queryFn: () =>
      productSubgroupsApi.list(groupId, {
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
    mutationFn: (id: number) => productSubgroupsApi.remove(groupId, id),
    onSuccess: () => {
      toast.success('Subgrupo de produto removido.')
      queryClient.invalidateQueries({ queryKey: ['product-subgroups', companyId, groupId] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: ProductSubgroup) {
    setEditing(row)
    setFormOpen(true)
  }

  const backLink = (
    <Link
      to="/product-groups"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Grupos de produto
    </Link>
  )

  if (parentNotFound) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="py-12">
          <EmptyState
            icon={Layers}
            title="Grupo de produto não encontrado"
            description="O grupo solicitado não existe ou foi removido."
          />
        </Card>
      </div>
    )
  }

  const parentName = parentQuery.data?.description
  const title = parentName ? `Subgrupos de ${parentName}` : 'Subgrupos de produto'
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasSearch = debouncedSearch.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <PageHeader
          title={title}
          description="Subgrupos vinculados a este grupo de produto."
        >
          <Can permission="product_subgroups.create">
            <Button onClick={openCreate} disabled={!parentQuery.data}>
              <Plus className="size-4" />
              Novo subgrupo de produto
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
            icon={Layers}
            title={
              hasSearch
                ? 'Nenhum subgrupo de produto encontrado'
                : 'Nenhum subgrupo de produto cadastrado'
            }
            description={
              hasSearch
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro subgrupo deste grupo de produto.'
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
                      <Can permission="product_subgroups.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="product_subgroups.delete">
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

      <ProductSubgroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        groupId={groupId}
        productSubgroup={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir subgrupo de produto"
        description="Esta ação é permanente. Se o subgrupo já estiver vinculado a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
