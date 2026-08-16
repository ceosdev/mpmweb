import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Eye,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { payablesApi, type PayableListParams } from '@/services/payables-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { usePermissions } from '@/permissions/use-permissions'
import { useSearchFilters } from '@/hooks/use-search-filters'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/masks'
import { currentMonthRange, formatIsoDate } from '@/lib/format'
import type { Payable, PayableStatusFilter } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { EntityPicker } from '@/components/common/entity-picker'
import { MultiSelect, type MultiSelectOption } from '@/components/form/multi-select'
import { PayableFormDialog } from '@/modules/payables/payable-form-dialog'
import { PayableSettlementsDialog } from '@/modules/payables/payable-settlements-dialog'
import { BatchPaymentDialog } from '@/modules/payables/batch-payment-dialog'
import { PayableStatusBadge } from '@/modules/payables/payable-status-badge'
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

/** "Vencido" é virtual: vence antes de hoje e ainda deve algo. */
const STATUS_OPTIONS: MultiSelectOption<PayableStatusFilter>[] = [
  { value: 'open', label: 'Aberto' },
  { value: 'partially_paid', label: 'Pago parcial' },
  { value: 'paid', label: 'Pago' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'overdue', label: 'Vencido' },
]

export function PayablesPage() {
  const { tenant } = useAuth()
  const { canAny, can } = usePermissions()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId
  // A coluna "Ações" só aparece se o usuário tem ao menos uma das ações do menu.
  const canActOnRow = canAny([
    'payables.view',
    'payables.edit',
    'payables.delete',
    'payables.cancel',
    'payable_settlements.view',
  ])
  const canBatch = can('payable_settlements.batch')

  // Calculado uma vez, na montagem: o recorte default é o mês corrente.
  const [defaultRange] = useState(currentMonthRange)

  // Filtros só disparam a consulta no clique em "Pesquisar" (ver useSearchFilters).
  // Ao montar, os aplicados = default (vencimento do mês corrente marcado), então
  // a tela já carrega filtrada por isso.
  const filters = useSearchFilters({
    id: '', documentNumber: '',
    supplierId: null as number | null,
    // Vencimento vem **marcado** por default; emissão, desmarcado.
    dueEnabled: true,
    dueFrom: defaultRange.from,
    dueTo: defaultRange.to,
    issueEnabled: false,
    issueFrom: defaultRange.from,
    issueTo: defaultRange.to,
    // Nenhum selecionado = todos.
    statuses: [] as PayableStatusFilter[],
  })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Payable | null>(null)
  // Reusa o mesmo modal do form para "Visualizar" (somente-leitura).
  const [formReadOnly, setFormReadOnly] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [settlementsFor, setSettlementsFor] = useState<Payable | null>(null)

  // Modo pagamento em lote: multisseleção de títulos que ainda devem, escopada à
  // página/consulta atual. Ver docs/spec/financeiro/003-pagamento-em-lote.md.
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  // Página que o usuário tentou abrir com seleção ativa (dispara o aviso).
  const [pendingPage, setPendingPage] = useState<number | null>(null)

  /** Só entram no lote os títulos que ainda devem (Aberto ou Parcial). */
  function isOwing(row: Payable) {
    return row.status === 'open' || row.status === 'partially_paid'
  }

  /** Desliga o modo lote e limpa a seleção. `notify` avisa o usuário. */
  function exitBatchMode(notify = false) {
    setBatchMode((wasOn) => {
      if (wasOn && notify) toast.info('Modo pagamento em lote desativado.')
      return false
    })
    setSelectedIds(new Set())
  }

  // Trocar de empresa zera o modo lote (a seleção é por id da empresa anterior).
  useEffect(() => {
    setBatchMode(false)
    setSelectedIds(new Set())
  }, [companyId])

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
    // Ordenar troca as linhas visíveis — a seleção deixaria de bater com a tela.
    exitBatchMode(true)
  }

  function handleSearch() {
    filters.apply()
    setPage(1)
    exitBatchMode(true)
  }

  const listParams = useMemo<PayableListParams>(() => {
    const applied = filters.applied
    return {
      id: applied.id ? Number(applied.id) : undefined,
      documentNumber: applied.documentNumber || undefined,
      supplierId: applied.supplierId ?? undefined,
      // Desmarcar o checkbox desativa o filtro — as datas nem são enviadas.
      dueFrom: applied.dueEnabled ? applied.dueFrom : undefined,
      dueTo: applied.dueEnabled ? applied.dueTo : undefined,
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
    queryKey: ['payables', companyId, listParams],
    queryFn: () => payablesApi.list(listParams),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => payablesApi.remove(id),
    onSuccess: () => {
      toast.success('Título removido.')
      queryClient.invalidateQueries({ queryKey: ['payables'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => payablesApi.cancel(id),
    onSuccess: () => {
      toast.success('Título cancelado.')
      queryClient.invalidateQueries({ queryKey: ['payables'] })
      // O cancelamento excluiu as baixas no servidor — invalida a lista de baixas
      // em cache (senão, ao abrir "Pagamentos", o grid mostraria registros já
      // apagados até o cache expirar / reload).
      queryClient.invalidateQueries({ queryKey: ['payable-settlements'] })
      setCancelId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormReadOnly(false)
    setFormOpen(true)
  }
  function openEdit(row: Payable) {
    setEditing(row)
    setFormReadOnly(false)
    setFormOpen(true)
  }
  function openView(row: Payable) {
    setEditing(row)
    setFormReadOnly(true)
    setFormOpen(true)
  }

  /** Volta ao **default** (mês corrente por vencimento), não ao vazio. */
  function clearFilters() {
    filters.clear()
    setPage(1)
    exitBatchMode(true)
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  // Elegíveis da página e estado de seleção derivados das linhas atuais.
  const eligibleRows = useMemo(() => rows.filter(isOwing), [rows])
  const hasEligible = eligibleRows.length > 0
  const allEligibleSelected =
    hasEligible && eligibleRows.every((row) => selectedIds.has(row.id))
  const selectedPayables = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds]
  )

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(eligibleRows.map((row) => row.id)) : new Set())
  }

  function toggleOne(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /**
   * Paginação só vale para a página atual. Com seleção ativa, avisa antes de
   * trocar (e perder a seleção); sem seleção, troca direto e sai do modo.
   */
  function handlePageChange(next: number) {
    if (batchMode && selectedIds.size > 0) {
      setPendingPage(next)
      return
    }
    exitBatchMode(true)
    setPage(next)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a pagar"
        description="Lance e acompanhe os títulos a pagar da empresa ativa."
        // O mesmo ícone do item de menu (Financeiro → Contas a pagar).
        icon={Receipt}
      >
        <Can permission="payables.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo título
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
          <label className="text-xs font-medium text-muted-foreground">Número do título</label>
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
          <label className="text-xs font-medium text-muted-foreground">Cedente</label>
          <div className="w-64">
            <EntityPicker
              source="supplier"
              value={filters.draft.supplierId}
              onChange={(value) => filters.setField('supplierId', value)}
            />
          </div>
        </div>

        <DateRangeFilter
          id="due"
          label="Vencimento"
          enabled={filters.draft.dueEnabled}
          onEnabledChange={(value) => filters.setField('dueEnabled', value)}
          from={filters.draft.dueFrom}
          to={filters.draft.dueTo}
          onFromChange={(value) => filters.setField('dueFrom', value)}
          onToChange={(value) => filters.setField('dueTo', value)}
        />

        <DateRangeFilter
          id="issue"
          label="Emissão"
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
              emptyLabel="Todos"
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

        {/* Entrada do modo lote — alinhada à direita, na mesma linha do Pesquisar. */}
        {canBatch && !batchMode && (
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => setBatchMode(true)}
            disabled={!hasEligible}
            title={
              hasEligible
                ? undefined
                : 'Nenhum título em aberto nesta página para pagar em lote.'
            }
          >
            <ListChecks className="size-4" />
            Pagamento em lote
          </Button>
        )}
      </div>

      {batchMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size === 0
              ? 'Modo pagamento em lote: selecione os títulos em aberto que deseja pagar.'
              : `${selectedIds.size} ${selectedIds.size === 1 ? 'título selecionado' : 'títulos selecionados'}`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => exitBatchMode()}>
              <X className="size-4" />
              Sair do modo lote
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setBatchDialogOpen(true)}
            >
              <Wallet className="size-4" />
              Pagar {selectedIds.size} em lote
            </Button>
          </div>
        </div>
      )}

      <Card>
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={filters.isFiltered ? 'Nenhum título encontrado' : 'Nenhum título lançado'}
            description={
              filters.isFiltered
                ? 'Tente ajustar os filtros da busca.'
                : 'Lance o primeiro título a pagar desta empresa.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="id" sort={sort} onSort={toggleSort}>
                  Código
                </SortableHeader>
                {batchMode && (
                  <TableHead className="w-0">
                    <Checkbox
                      checked={allEligibleSelected}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                      disabled={!hasEligible}
                      aria-label="Selecionar todos os títulos em aberto da página"
                    />
                  </TableHead>
                )}
                <SortableHeader column="document_number" sort={sort} onSort={toggleSort}>
                  Número
                </SortableHeader>
                <SortableHeader column="installment" sort={sort} onSort={toggleSort}>
                  Ordem
                </SortableHeader>
                <SortableHeader column="issue_date" sort={sort} onSort={toggleSort}>
                  Emissão
                </SortableHeader>
                <TableHead>Cedente</TableHead>
                <SortableHeader column="due_date" sort={sort} onSort={toggleSort}>
                  Vencimento
                </SortableHeader>
                {/* Ordena pela mesma expressão que exibe (o total), não por `amount`. */}
                <SortableHeader column="total" sort={sort} onSort={toggleSort}>
                  Valor
                </SortableHeader>
                <TableHead>Saldo</TableHead>
                <SortableHeader column="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortableHeader>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(batchMode && selectedIds.has(row.id) && 'bg-primary/5')}
                >
                  <TableCell className="text-muted-foreground">{row.id}</TableCell>
                  {batchMode && (
                    <TableCell className="w-0">
                      {isOwing(row) && (
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={(checked) => toggleOne(row.id, checked === true)}
                          aria-label={`Selecionar título ${row.documentNumber}`}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{row.documentNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{row.installment}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatIsoDate(row.issueDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.supplierName || '—'}
                  </TableCell>
                  <TableCell>
                    {/* `isOverdue` vem resolvido do backend (fuso da aplicação). */}
                    <span className={cn(row.isOverdue && 'font-medium text-destructive')}>
                      {formatIsoDate(row.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell>{formatCurrency(row.total)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrency(row.balance)}
                  </TableCell>
                  <TableCell>
                    <PayableStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      {/* No modo lote o foco é selecionar; as ações por linha somem. */}
                      {!batchMode && canActOnRow && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Ações">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Can permission="payables.view">
                              <DropdownMenuItem onClick={() => openView(row)}>
                                <Eye className="size-4" />
                                Visualizar
                              </DropdownMenuItem>
                            </Can>
                            <Can permission="payables.edit">
                              <DropdownMenuItem onClick={() => openEdit(row)}>
                                <Pencil className="size-4" />
                                Editar
                              </DropdownMenuItem>
                            </Can>
                            <Can permission="payable_settlements.view">
                              <DropdownMenuItem onClick={() => setSettlementsFor(row)}>
                                <Wallet className="size-4" />
                                Pagamentos
                              </DropdownMenuItem>
                            </Can>
                            {/* Cancelar é terminal — some quando o título já está cancelado. */}
                            {row.status !== 'cancelled' && (
                              <Can permission="payables.cancel">
                                <DropdownMenuItem
                                  onClick={() => setCancelId(row.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="size-4" />
                                  Cancelar título
                                </DropdownMenuItem>
                              </Can>
                            )}
                            {/* Título gerado por entrada de serviço — o backend recusa a
                                exclusão; cancele a entrada para removê-lo. */}
                            {row.serviceEntryId === null && (
                              <Can permission="payables.delete">
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

      {meta && <Pagination meta={meta} onChange={handlePageChange} />}

      <BatchPaymentDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        payables={selectedPayables}
        onSettled={() => {
          setBatchDialogOpen(false)
          exitBatchMode()
        }}
      />

      <ConfirmDialog
        open={pendingPage !== null}
        onOpenChange={(open) => !open && setPendingPage(null)}
        title="Sair do modo pagamento em lote?"
        description="O pagamento em lote funciona apenas na página atual. Mudar de página vai desativar o modo lote e limpar a seleção. Deseja continuar?"
        confirmLabel="Sim, mudar de página"
        onConfirm={() => {
          if (pendingPage !== null) {
            const next = pendingPage
            setPendingPage(null)
            exitBatchMode()
            setPage(next)
          }
        }}
      />

      <PayableFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        payable={editing}
        readOnly={formReadOnly}
      />

      <PayableSettlementsDialog
        open={settlementsFor !== null}
        onOpenChange={(open) => !open && setSettlementsFor(null)}
        payable={settlementsFor}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir título"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancelar título"
        description="Deseja realmente cancelar o título selecionado? O ato de cancelamento irá excluir todas as baixas já realizadas para este título."
        confirmLabel="Sim, cancelar título"
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
