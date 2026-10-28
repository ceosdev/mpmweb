import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList,
  Eye,
  Lock,
  MoreHorizontal,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { inventoriesApi } from '@/services/inventories-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { usePermissions } from '@/permissions/use-permissions'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import { currentMonthRange, formatDate, formatIsoDate } from '@/lib/format'
import { openPdf } from '@/lib/open-pdf'
import type { InventoryListParams, InventoryStatus } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { InventoryStatusBadge } from '@/modules/inventories/inventory-status-badge'
import { OpenInventoryDialog } from '@/modules/inventories/open-inventory-dialog'
import { Button } from '@/components/ui/button'
import { SearchButton } from '@/components/common/search-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type StatusFilter = 'all' | InventoryStatus

export function InventoriesPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const { canAny } = usePermissions()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // A coluna "Ações" só aparece se o usuário tem ao menos uma das ações do menu.
  const canActOnRow = canAny(['inventories.view', 'inventories.close', 'inventories.delete'])

  // Calculado uma vez, na montagem: o recorte default é o mês corrente.
  const [defaultRange] = useState(currentMonthRange)

  const filters = useSearchFilters({
    // Data de abertura vem **marcada** por default.
    openingEnabled: true,
    openingFrom: defaultRange.from,
    openingTo: defaultRange.to,
    status: 'all' as StatusFilter,
  })
  const [page, setPage] = useState(1)
  // `null`: sem ordenação explícita, o backend ordena por abertura desc, id desc.
  const [sort, setSort] = useState<SortState | null>(null)

  const [openDialog, setOpenDialog] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  function handleSearch() {
    filters.apply()
    setPage(1)
  }

  /** Volta ao **default** (abertura no mês corrente), não ao vazio. */
  function clearFilters() {
    filters.clear()
    setPage(1)
  }

  const listParams = useMemo<InventoryListParams>(() => {
    const applied = filters.applied
    return {
      openingFrom: applied.openingEnabled ? applied.openingFrom : undefined,
      openingTo: applied.openingEnabled ? applied.openingTo : undefined,
      status: applied.status === 'all' ? undefined : applied.status,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }
  }, [filters.applied, page, sort])

  const listQuery = useQuery({
    queryKey: ['inventories', companyId, 'list', listParams],
    queryFn: () => inventoriesApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => inventoriesApi.remove(id),
    onSuccess: () => {
      toast.success('Inventário excluído.')
      queryClient.invalidateQueries({ queryKey: ['inventories', companyId] })
      setDeleteId(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
      setDeleteId(null)
    },
  })

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasOpen = meta?.hasOpen ?? false

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventário de produtos"
        description="Conte o estoque físico e acerte o saldo do sistema da empresa ativa."
        // O mesmo ícone do item de menu (Mercadoria → Inventário de produtos).
        icon={ClipboardList}
      >
        <Can permission="inventories.create">
          {/* Botão desabilitado não dispara hover: o `title` fica no wrapper. */}
          <span title={hasOpen ? 'Já existe um inventário em aberto.' : undefined}>
            <Button onClick={() => setOpenDialog(true)} disabled={hasOpen}>
              <Plus className="size-4" />
              Novo inventário
            </Button>
          </span>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id="opening-enabled"
              checked={filters.draft.openingEnabled}
              onCheckedChange={(checked) => filters.setField('openingEnabled', checked === true)}
            />
            <Label htmlFor="opening-enabled" className="text-xs font-medium text-muted-foreground">
              Data de abertura
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              className="w-36"
              disabled={!filters.draft.openingEnabled}
              value={filters.draft.openingFrom}
              onChange={(event) => filters.setField('openingFrom', event.target.value)}
              aria-label="Data de abertura — de"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              className="w-36"
              disabled={!filters.draft.openingEnabled}
              value={filters.draft.openingTo}
              onChange={(event) => filters.setField('openingTo', event.target.value)}
              aria-label="Data de abertura — até"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">Status</label>
          <Select
            value={filters.draft.status}
            onValueChange={(value) => filters.setField('status', value as StatusFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
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
            icon={ClipboardList}
            title={
              filters.isFiltered ? 'Nenhum inventário encontrado' : 'Nenhum inventário ainda'
            }
            description={
              filters.isFiltered
                ? 'Tente ajustar os filtros da busca.'
                : 'Abra o primeiro inventário de produtos desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="id" sort={sort} onSort={toggleSort}>
                  Código
                </SortableHeader>
                <SortableHeader column="opening_date" sort={sort} onSort={toggleSort}>
                  Data de abertura
                </SortableHeader>
                <SortableHeader column="closed_at" sort={sort} onSort={toggleSort}>
                  Data de fechamento
                </SortableHeader>
                <TableHead>Grupos</TableHead>
                <TableHead>Itens</TableHead>
                <SortableHeader column="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isOpen = row.status === 'open'
                const groupsLabel = row.groups.length
                  ? row.groups.map((group) => group.description).join(', ')
                  : 'Todos os grupos'
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatIsoDate(row.openingDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.closedAt ? formatDate(row.closedAt) : '—'}
                    </TableCell>
                    <TableCell className="max-w-64">
                      <div className="truncate" title={groupsLabel}>
                        {groupsLabel}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.countedCount} / {row.itemCount}
                    </TableCell>
                    <TableCell>
                      <InventoryStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        {canActOnRow && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Ações">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Can permission="inventories.view">
                                <DropdownMenuItem onClick={() => navigate(`/inventories/${row.id}`)}>
                                  <Eye className="size-4" />
                                  Contagem
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    void openPdf(() =>
                                      inventoriesApi.countSheet(row.id, { reveal: false }),
                                    )
                                  }
                                >
                                  <Printer className="size-4" />
                                  Imprimir contagem
                                </DropdownMenuItem>
                              </Can>
                              {isOpen && (
                                <Can permission="inventories.close">
                                  <DropdownMenuItem
                                    onClick={() => navigate(`/inventories/${row.id}?close=1`)}
                                  >
                                    <Lock className="size-4" />
                                    Fechar inventário
                                  </DropdownMenuItem>
                                </Can>
                              )}
                              {isOpen && (
                                <Can permission="inventories.delete">
                                  <DropdownMenuItem
                                    onClick={() => setDeleteId(row.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="size-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </Can>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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

      <OpenInventoryDialog open={openDialog} onOpenChange={setOpenDialog} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir inventário"
        description="Deseja realmente excluir o inventário e toda a sua contagem?"
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
