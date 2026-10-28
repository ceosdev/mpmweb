import { useCallback, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { formatDecimalString } from '@/modules/goods-exits/quantity'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { InventoryItem } from '@/types/api'
import { normalizeDecimal, parseCount } from '@/modules/inventories/count-quantity'

export interface RowState {
  saving?: boolean
  error?: string
}

interface Props {
  /** Itens visíveis, já filtrados e ordenados. */
  items: InventoryItem[]
  revealed: boolean
  /** Input só com `inventories.count` e inventário aberto. */
  editable: boolean
  rowStates: Record<number, RowState>
  /** Grava a quantidade (string da API ou null). */
  onSave: (item: InventoryItem, value: string | null) => Promise<boolean>
  onRowError: (itemId: number, error: string | undefined) => void
}

function signed(diff: string): string {
  const neg = diff.startsWith('-')
  const body = formatDecimalString(neg ? diff.slice(1) : diff)
  if (neg) return `-${body}`
  return body === '0' ? '0' : `+${body}`
}

export function InventoryCountTable({
  items,
  revealed,
  editable,
  rowStates,
  onSave,
  onRowError,
}: Props) {
  const inputs = useRef(new Map<number, HTMLInputElement>())
  // Texto em edição por item; ausente = mostra o valor do servidor.
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  // Último valor enviado por item: evita regravar no blur que o Enter provoca.
  const submitted = useRef(new Map<number, string>())

  const serverText = (item: InventoryItem) =>
    item.countedQuantity === null ? '' : formatDecimalString(item.countedQuantity)

  const clearDraft = useCallback((itemId: number) => {
    setDrafts((d) => {
      if (!(itemId in d)) return d
      const rest = { ...d }
      delete rest[itemId]
      return rest
    })
  }, [])

  function commit(item: InventoryItem) {
    const text = drafts[item.id]
    if (text === undefined) return
    const parsed = parseCount(text)
    if (!parsed.ok) {
      onRowError(item.id, parsed.error)
      return
    }
    const key = parsed.value ?? ''
    if (normalizeDecimal(parsed.value) === normalizeDecimal(item.countedQuantity)) {
      onRowError(item.id, undefined)
      clearDraft(item.id)
      return
    }
    if (submitted.current.get(item.id) === key) return
    submitted.current.set(item.id, key)
    onRowError(item.id, undefined)
    // O rascunho sai quando a gravação dá certo (o valor do servidor assume);
    // em erro ele permanece para o usuário corrigir.
    void onSave(item, parsed.value).then((ok) => {
      if (!ok) submitted.current.delete(item.id)
      setDrafts((d) => {
        if (!ok || d[item.id] !== text) return d
        const rest = { ...d }
        delete rest[item.id]
        return rest
      })
    })
  }

  function focusNext(index: number) {
    const next = items[index + 1]
    const el = next ? inputs.current.get(next.id) : undefined
    if (el) {
      el.focus()
      el.select()
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Código</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead className="w-24">Un.</TableHead>
          {revealed && <TableHead className="w-36 text-right">Qtd. estoque</TableHead>}
          <TableHead className="w-48 text-right">Qtd. contada</TableHead>
          {revealed && <TableHead className="w-32 text-right">Diferença</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => {
          const st = rowStates[item.id] ?? {}
          const value = drafts[item.id] ?? serverText(item)
          const uncounted = item.countedQuantity === null
          return (
            <TableRow
              key={item.id}
              data-state-row={item.state}
              className={cn(revealed && item.state === 'divergent' && 'bg-destructive/10')}
            >
              <TableCell className="tabular-nums">{item.productId}</TableCell>
              <TableCell>{item.productDescription}</TableCell>
              <TableCell>{item.unitOfMeasure ?? '—'}</TableCell>
              {revealed && (
                <TableCell className="text-right tabular-nums">
                  {item.stockQuantity !== undefined ? formatDecimalString(item.stockQuantity) : '—'}
                </TableCell>
              )}
              <TableCell className="text-right">
                {editable ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {st.saving && (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Gravando" />
                      )}
                      <Input
                        ref={(el) => {
                          if (el) inputs.current.set(item.id, el)
                          else inputs.current.delete(item.id)
                        }}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Quantidade contada de ${item.productDescription}`}
                        aria-invalid={st.error ? true : undefined}
                        placeholder="—"
                        className="h-8 w-32 text-right tabular-nums"
                        value={value}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const text = e.target.value
                          setDrafts((d) => ({ ...d, [item.id]: text }))
                          if (st.error) onRowError(item.id, undefined)
                          submitted.current.delete(item.id)
                        }}
                        onBlur={() => commit(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commit(item)
                            focusNext(index)
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            clearDraft(item.id)
                            submitted.current.delete(item.id)
                            onRowError(item.id, undefined)
                          }
                        }}
                      />
                    </div>
                    {st.error && (
                      <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="size-3" />
                        {st.error}
                      </p>
                    )}
                  </div>
                ) : uncounted ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="tabular-nums">{formatDecimalString(item.countedQuantity!)}</span>
                )}
              </TableCell>
              {revealed && (
                <TableCell className="text-right tabular-nums">
                  {item.difference != null ? (
                    signed(item.difference)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
