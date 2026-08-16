import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { documentTypesApi } from '@/services/document-types-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import type { DocumentType } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { DocumentTypeFormDialog } from '@/modules/document-types/document-type-form-dialog'
import { Button } from '@/components/ui/button'
import { SearchButton } from '@/components/common/search-button'
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

export function DocumentTypesPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  const filters = useSearchFilters({ id: '', search: '' })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentType | null>(null)
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

  const listQuery = useQuery({
    queryKey: ['document-types', companyId, filters.applied, page, sort],
    queryFn: () =>
      documentTypesApi.list({
        id: filters.applied.id ? Number(filters.applied.id) : undefined,
        search: filters.applied.search || undefined,
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentTypesApi.remove(id),
    onSuccess: () => {
      toast.success('Tipo de documento removido.')
      queryClient.invalidateQueries({ queryKey: ['document-types'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: DocumentType) {
    setEditing(row)
    setFormOpen(true)
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasSearch = filters.isFiltered

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Tipos de documento"
        description="Cadastre os tipos de documento aceitos pela empresa ativa."
      >
        <Can permission="document_types.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo tipo de documento
          </Button>
        </Can>
      </PageHeader>

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
            icon={FileText}
            title={
              hasSearch ? 'Nenhum tipo de documento encontrado' : 'Nenhum tipo de documento cadastrado'
            }
            description={
              hasSearch
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro tipo de documento desta empresa.'
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
                      {row.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="document_types.edit">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Editar">
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="document_types.delete">
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

      <DocumentTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        documentType={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir tipo de documento"
        description="Esta ação é permanente. Se o tipo de documento já estiver vinculado a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
