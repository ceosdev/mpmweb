import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { brandsApi } from '@/services/brands-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import type { Brand } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { BrandFormDialog } from '@/modules/brands/brand-form-dialog'
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

export function BrandsPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedSearch = useDebouncedValue(search)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listQuery = useQuery({
    queryKey: ['brands', companyId, debouncedSearch, page, sort],
    queryFn: () =>
      brandsApi.list({
        search: debouncedSearch || undefined,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => brandsApi.remove(id),
    onSuccess: () => {
      toast.success('Marca removida.')
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: Brand) {
    setEditing(row)
    setFormOpen(true)
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasSearch = debouncedSearch.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marcas"
        description="Cadastre as marcas aceitas pela empresa ativa."
      >
        <Can permission="brands.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Nova marca
          </Button>
        </Can>
      </PageHeader>

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
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={
              hasSearch ? 'Nenhuma marca encontrada' : 'Nenhuma marca cadastrada'
            }
            description={
              hasSearch
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre a primeira marca desta empresa.'
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
                      {row.isActive ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="brands.edit">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Editar">
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="brands.delete">
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)} aria-label="Excluir">
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

      <BrandFormDialog open={formOpen} onOpenChange={setFormOpen} brand={editing} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir marca"
        description="Esta ação é permanente. Se a marca já estiver vinculada a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
