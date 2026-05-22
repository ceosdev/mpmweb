import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { paymentTypesApi } from '@/services/payment-types-api'
import { useAuth } from '@/providers/auth-provider'
import { Can } from '@/permissions/can'
import { getErrorMessage } from '@/lib/errors'
import type { PaymentType } from '@/types/api'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/data-table/pagination'
import {
  SortableHeader,
  nextSortState,
  type SortState,
} from '@/components/data-table/sortable-header'
import { PaymentTypeFormDialog } from '@/modules/payment-types/payment-type-form-dialog'
import { Button } from '@/components/ui/button'
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
 * Payment Types module. Simple CRUD pattern (rule `simple-crud-pattern`):
 * description + status, multitenant, hard delete, modal form.
 */
export function PaymentTypesPage() {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const companyId = tenant?.companyId

  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentType | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function toggleSort(column: string) {
    setSort((current) => nextSortState(current, column))
    setPage(1)
  }

  const listQuery = useQuery({
    queryKey: ['payment-types', companyId, page, sort],
    queryFn: () =>
      paymentTypesApi.list({
        page,
        perPage: PER_PAGE,
        sort: sort?.column,
        order: sort?.order,
      }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentTypesApi.remove(id),
    onSuccess: () => {
      toast.success('Tipo de pagamento removido.')
      queryClient.invalidateQueries({ queryKey: ['payment-types'] })
      setDeleteId(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row: PaymentType) {
    setEditing(row)
    setFormOpen(true)
  }

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tipos de pagamento"
        description="Cadastre as formas de pagamento aceitas pela empresa ativa."
      >
        <Can permission="payment_types.create">
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo tipo
          </Button>
        </Can>
      </PageHeader>

      <Card>
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum tipo de pagamento cadastrado"
            description="Cadastre o primeiro tipo de pagamento desta empresa."
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
                      <Can permission="payment_types.edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="payment_types.delete">
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

      <PaymentTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        paymentType={editing}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir tipo de pagamento"
        description="Esta ação é permanente. Se o tipo já estiver vinculado a outros registros, a exclusão será bloqueada pelo sistema."
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
