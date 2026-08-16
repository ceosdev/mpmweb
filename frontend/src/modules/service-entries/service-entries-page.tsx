import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CheckCircle2,
  Eye,
  FileInput,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { serviceEntriesApi } from '@/services/service-entries-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { usePermissions } from '@/permissions/use-permissions'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/masks'
import { currentMonthRange, formatIsoDate } from '@/lib/format'
import type { ServiceEntry, ServiceEntryListParams, ServiceEntryStatus } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FinalizeEntryDialog } from '@/modules/service-entries/finalize-entry-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { EntityPicker } from '@/components/common/entity-picker'
import { MultiSelect, type MultiSelectOption } from '@/components/form/multi-select'
import { ServiceEntryStatusBadge } from '@/modules/service-entries/service-entry-status-badge'
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

const STATUS_OPTIONS: MultiSelectOption<ServiceEntryStatus>[] = [
  { value: 'open', label: 'Aberta' },
  { value: 'finalized', label: 'Finalizada' },
  { value: 'cancelled', label: 'Cancelada' },
]

export function ServiceEntriesPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const { canAny } = usePermissions()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  // A coluna "Ações" só aparece se o usuário tem ao menos uma das ações do menu.
  const canActOnRow = canAny([
    'service_entries.view',
    'service_entries.edit',
    'service_entries.finalize',
    'service_entries.cancel',
    'service_entries.delete',
  ])

  // Calculado uma vez, na montagem: o recorte default é o mês corrente.
  const [defaultRange] = useState(currentMonthRange)

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  // Ao montar, os aplicados = default (operação do mês corrente marcada), então
  // a tela já carrega filtrada por isso.
  const filters = useSearchFilters({
    id: '', documentNumber: '',
    supplierId: null as number | null,
    // Operação vem **marcada** por default; emissão, desmarcada.
    operationEnabled: true,
    operationFrom: defaultRange.from,
    operationTo: defaultRange.to,
    issueEnabled: false,
    issueFrom: defaultRange.from,
    issueTo: defaultRange.to,
    // Nenhum selecionado = todas.
    statuses: [] as ServiceEntryStatus[],
  })
  const [page, setPage] = useState(1)
  // `null`: sem ordenação explícita, o backend ordena por operação desc, id desc.
  const [sort, setSort] = useState<SortState | null>(null)

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [finalizeEntry, setFinalizeEntry] = useState<ServiceEntry | null>(null)
  const [cancelId, setCancelId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  function handleSearch() {
    filters.apply()
    setPage(1)
  }

  /** Volta ao **default** (operação no mês corrente), não ao vazio. */
  function clearFilters() {
    filters.clear()
    setPage(1)
  }

  const listParams = useMemo<ServiceEntryListParams>(() => {
    const applied = filters.applied
    return {
      id: applied.id ? Number(applied.id) : undefined,
      documentNumber: applied.documentNumber || undefined,
      supplierId: applied.supplierId ?? undefined,
      // Desmarcar o checkbox desativa o filtro — as datas nem são enviadas.
      operationFrom: applied.operationEnabled ? applied.operationFrom : undefined,
      operationTo: applied.operationEnabled ? applied.operationTo : undefined,
      issueFrom: applied.issueEnabled ? applied.issueFrom : undefined,
      issueTo: applied.issueEnabled ? applied.issueTo : undefined,
      statuses: applied.statuses,
      page,
      perPage: PER_PAGE,
      sort: sort?.column,
      order: sort?.order,
    }
  }, [filters.applied, page, sort])

  const listQuery = useQuery({
    queryKey: ['service-entries', companyId, listParams],
    queryFn: () => serviceEntriesApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => serviceEntriesApi.remove(id),
    onSuccess: () => {
      toast.success('Entrada removida.')
      queryClient.invalidateQueries({ queryKey: ['service-entries'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => serviceEntriesApi.cancel(id),
    onSuccess: () => {
      toast.success('Entrada cancelada.')
      // Cancela também os títulos que a entrada gerou (e exclui as baixas deles)
      // — a tela de contas a pagar precisa refletir isso.
      queryClient.invalidateQueries({ queryKey: ['service-entries', companyId] })
      queryClient.invalidateQueries({ queryKey: ['payables', companyId] })
      setCancelId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrada de serviço"
        description="Lance e acompanhe as notas fiscais de serviço recebidas da empresa ativa."
        // O mesmo ícone do item de menu (Serviços → Entrada de serviço).
        icon={FileInput}
      >
        <Can permission="service_entries.create">
          <Button onClick={() => navigate('/service-entries/new')}>
            <Plus className="size-4" />
            Nova entrada
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          {/* `block` no label: o <input> é inline — sem isso ele sobe para a
              mesma linha do rótulo (os demais filtros têm wrapper bloco). */}
          <label className="block text-xs font-medium text-muted-foreground">Código</label>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Código"
            value={filters.draft.id}
            onChange={(event) => filters.setField('id', event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            className="w-24"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Número do documento</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número"
              className="w-48 pl-9"
              value={filters.draft.documentNumber}
              onChange={(event) => filters.setField('documentNumber', event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Fornecedor</label>
          <div className="w-64">
            <EntityPicker
              source="supplier"
              value={filters.draft.supplierId}
              onChange={(value) => filters.setField('supplierId', value)}
            />
          </div>
        </div>

        <DateRangeFilter
          id="operation"
          label="Data da operação"
          enabled={filters.draft.operationEnabled}
          onEnabledChange={(value) => filters.setField('operationEnabled', value)}
          from={filters.draft.operationFrom}
          to={filters.draft.operationTo}
          onFromChange={(value) => filters.setField('operationFrom', value)}
          onToChange={(value) => filters.setField('operationTo', value)}
        />

        <DateRangeFilter
          id="issue"
          label="Data de emissão"
          enabled={filters.draft.issueEnabled}
          onEnabledChange={(value) => filters.setField('issueEnabled', value)}
          from={filters.draft.issueFrom}
          to={filters.draft.issueTo}
          onFromChange={(value) => filters.setField('issueFrom', value)}
          onToChange={(value) => filters.setField('issueTo', value)}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          {/* O gatilho do MultiSelect é inline-flex; sem este bloco ele subiria
              para a mesma linha da label. */}
          <div className="w-44">
            <MultiSelect
              id="status"
              className="w-full"
              options={STATUS_OPTIONS}
              value={filters.draft.statuses}
              emptyLabel="Todas"
              onChange={(value) => filters.setField('statuses', value)}
            />
          </div>
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
            icon={FileInput}
            title={filters.isFiltered ? 'Nenhuma entrada encontrada' : 'Nenhuma entrada lançada'}
            description={
              filters.isFiltered
                ? 'Tente ajustar os filtros da busca.'
                : 'Lance a primeira entrada de serviço desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="id" sort={sort} onSort={toggleSort}>
                  Código
                </SortableHeader>
                <SortableHeader column="document_number" sort={sort} onSort={toggleSort}>
                  Nº documento
                </SortableHeader>
                <SortableHeader column="supplier" sort={sort} onSort={toggleSort}>
                  Fornecedor
                </SortableHeader>
                <SortableHeader column="document_type" sort={sort} onSort={toggleSort}>
                  Tipo de documento
                </SortableHeader>
                <SortableHeader column="issue_date" sort={sort} onSort={toggleSort}>
                  Emissão
                </SortableHeader>
                <SortableHeader column="operation_date" sort={sort} onSort={toggleSort}>
                  Data operação
                </SortableHeader>
                {/* Ordena pela MESMA expressão que exibe (Σ dos itens), senão a
                    coluna se contradiria. */}
                <SortableHeader column="items_total" sort={sort} onSort={toggleSort}>
                  Valor da entrada
                </SortableHeader>
                <SortableHeader column="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.documentNumber}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.supplierName || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.documentTypeName || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatIsoDate(row.issueDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatIsoDate(row.operationDate)}
                  </TableCell>
                  <TableCell>{formatCurrency(row.itemsTotal)}</TableCell>
                  <TableCell>
                    <ServiceEntryStatusBadge status={row.status} />
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
                            <Can permission="service_entries.view">
                              <DropdownMenuItem
                                onClick={() => navigate(`/service-entries/${row.id}`)}
                              >
                                <Eye className="size-4" />
                                Visualizar
                              </DropdownMenuItem>
                            </Can>
                            {row.status === 'open' && (
                              <Can permission="service_entries.edit">
                                <DropdownMenuItem
                                  onClick={() => navigate(`/service-entries/${row.id}/edit`)}
                                >
                                  <Pencil className="size-4" />
                                  Editar
                                </DropdownMenuItem>
                              </Can>
                            )}
                            {row.status === 'open' && (
                              <Can permission="service_entries.finalize">
                                <DropdownMenuItem onClick={() => setFinalizeEntry(row)}>
                                  <CheckCircle2 className="size-4" />
                                  Finalizar entrada
                                </DropdownMenuItem>
                              </Can>
                            )}
                            {/* Cancelar é terminal — some quando a entrada já está cancelada. */}
                            {row.status !== 'cancelled' && (
                              <Can permission="service_entries.cancel">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setCancelId(row.id)}
                                >
                                  <Ban className="size-4" />
                                  Cancelar entrada
                                </DropdownMenuItem>
                              </Can>
                            )}
                            {row.status === 'open' && (
                              <Can permission="service_entries.delete">
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
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {meta && <Pagination meta={meta} onChange={setPage} />}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir entrada"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />

      <FinalizeEntryDialog
        entry={finalizeEntry}
        open={finalizeEntry !== null}
        onOpenChange={(open) => !open && setFinalizeEntry(null)}
        onConfirmed={() => setFinalizeEntry(null)}
      />

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancelar entrada"
        description="Cancelar esta entrada também cancelará todos os títulos a pagar que ela gerou e excluirá as baixas desses títulos. Esta ação não pode ser desfeita."
        confirmLabel="Sim, cancelar entrada"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelId !== null && cancelMutation.mutate(cancelId)}
      />
    </div>
  )
}

/**
 * Intervalo de datas com checkbox de habilitação. Desmarcado, o filtro não é
 * enviado — as datas continuam à vista (e preservadas) apenas como memória do
 * que estava selecionado.
 */
function DateRangeFilter({
  id,
  label,
  enabled,
  onEnabledChange,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  id: string
  label: string
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-enabled`}
          checked={enabled}
          onCheckedChange={(checked) => onEnabledChange(checked === true)}
        />
        <Label htmlFor={`${id}-enabled`} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          className="w-36"
          disabled={!enabled}
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          aria-label={`${label} — de`}
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          className="w-36"
          disabled={!enabled}
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          aria-label={`${label} — até`}
        />
      </div>
    </div>
  )
}
