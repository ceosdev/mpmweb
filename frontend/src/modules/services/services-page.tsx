import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hammer, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { servicesApi, type ServiceListParams } from '@/services/services-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/masks'
import type { Service, ServiceType } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { ServiceFormDialog } from '@/modules/services/service-form-dialog'
import { Button } from '@/components/ui/button'
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

const TYPE_LABELS: Record<ServiceType, string> = {
  internal: 'Interno',
  third_party: 'Terceiro',
}

type TypeFilter = ServiceType | 'all'

export function ServicesPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [descriptionFilter, setDescriptionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)
  const debouncedDescription = useDebouncedValue(descriptionFilter)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listParams = useMemo<ServiceListParams>(
    () => ({
      description: debouncedDescription || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }),
    [debouncedDescription, typeFilter, page, sort]
  )

  const listQuery = useQuery({
    queryKey: ['services', companyId, listParams],
    queryFn: () => servicesApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => servicesApi.remove(id),
    onSuccess: () => {
      toast.success('Serviço removido.')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(row: Service) {
    setEditing(row)
    setFormOpen(true)
  }

  function resetPage() {
    setPage(1)
  }

  function clearFilters() {
    setDescriptionFilter('')
    setTypeFilter('all')
    setPage(1)
  }

  const hasFilters = descriptionFilter.length > 0 || typeFilter !== 'all'

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        description="Cadastre os serviços oferecidos pela empresa ativa."
      >
        <Can permission="services.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo serviço
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
              value={descriptionFilter}
              onChange={(event) => {
                setDescriptionFilter(event.target.value)
                resetPage()
              }}
              className="w-64 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value as TypeFilter)
              resetPage()
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="internal">Serviço interno</SelectItem>
              <SelectItem value="third_party">Serviço de terceiro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
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
            icon={Hammer}
            title={hasFilters ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
            description={
              hasFilters
                ? 'Tente ajustar os termos da busca.'
                : 'Cadastre o primeiro serviço desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="description" sort={sort} onSort={toggleSort}>
                  Descrição
                </SortableHeader>
                <TableHead>Grupo</TableHead>
                <SortableHeader column="type" sort={sort} onSort={toggleSort}>
                  Tipo
                </SortableHeader>
                <SortableHeader column="suggested_value" sort={sort} onSort={toggleSort}>
                  Valor sugerido
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
                  <TableCell className="text-muted-foreground">
                    {row.groupDescription || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.type === 'internal' ? 'secondary' : 'default'}>
                      {TYPE_LABELS[row.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.suggestedValue !== null ? formatCurrency(row.suggestedValue) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? 'default' : 'outline'}>
                      {row.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="services.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="services.delete">
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

      <ServiceFormDialog open={formOpen} onOpenChange={setFormOpen} service={editing} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir serviço"
        description="Esta ação é permanente. Se o serviço já estiver vinculado a outros registros, a exclusão será bloqueada."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
