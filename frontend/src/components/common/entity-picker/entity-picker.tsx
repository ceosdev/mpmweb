import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Command as CommandPrimitive } from 'cmdk'
import { X } from 'lucide-react'

import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@/lib/utils'
import { ENTITY_SOURCES, type EntitySourceKey } from './entity-sources'
import type { EntityOption } from './types'

/**
 * Campo de busca de entidade com muitos registros (fornecedor, cliente, …).
 *
 * O usuário digita, a busca acontece **no servidor** (debounce de 350 ms, a
 * partir de 2 caracteres) e o item escolhido vira um chip com "×". O valor do
 * campo é sempre a **FK** — rótulo é apresentação e nunca é persistido.
 *
 * O componente não conhece nenhuma entidade: fala só com `ENTITY_SOURCES`.
 * Ver `docs/spec/comum/001-componente-entity-picker.md`.
 */

interface EntityPickerBaseProps {
  source: EntitySourceKey
  /** Liga o <Label htmlFor>. */
  id?: string
  disabled?: boolean
  /** Pinta a borda de erro (o formulário decide, via Zod). */
  invalid?: boolean
  /** Sobrescreve o placeholder do source. */
  placeholder?: string
  /** Mínimo de caracteres antes de buscar. Default 2. */
  minChars?: number
}

export type EntityPickerProps =
  | (EntityPickerBaseProps & {
      multiple?: false
      value: number | null
      onChange: (value: number | null) => void
    })
  | (EntityPickerBaseProps & {
      multiple: true
      value: number[]
      onChange: (value: number[]) => void
    })

export function EntityPicker(props: EntityPickerProps) {
  const { source, id, disabled, invalid, placeholder, minChars = 2 } = props
  const entitySource = ENTITY_SOURCES[source]

  const { tenant } = useAuth()
  const companyId = tenant?.companyId

  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebouncedValue(term, 350)

  const inputRef = useRef<HTMLInputElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)

  const selectedIds = useMemo(
    () => (props.multiple ? props.value : props.value === null ? [] : [props.value]),
    [props.multiple, props.value]
  )

  // Rótulos já resolvidos. Sobrevive à troca de seleção, então nunca buscamos
  // duas vezes o mesmo id.
  const [labels, setLabels] = useState<Record<number, EntityOption>>({})
  const missingIds = useMemo(
    () => selectedIds.filter((entityId) => !labels[entityId]),
    [selectedIds, labels]
  )

  // Hidratação: a tela entrega só a FK (ex.: ao abrir um registro para edição),
  // e o componente descobre o rótulo sozinho.
  const hydration = useQuery({
    queryKey: ['entity-lookup-ids', source, companyId, missingIds],
    queryFn: () => entitySource.fetchByIds(missingIds),
    enabled: missingIds.length > 0,
  })

  useEffect(() => {
    if (!hydration.data) return
    setLabels((current) => {
      const next = { ...current }
      for (const option of hydration.data) next[option.id] = option
      return next
    })
  }, [hydration.data])

  const searchTerm = debouncedTerm.trim()
  const typedEnough = term.trim().length >= minChars
  const searchReady = searchTerm.length >= minChars

  const search = useQuery({
    // O `signal` do TanStack Query aborta a busca anterior quando o termo muda —
    // sem isso, a resposta lenta de "ac" chega depois da de "acme" e sobrescreve
    // a lista com resultados errados.
    queryKey: ['entity-lookup', source, companyId, searchTerm],
    queryFn: ({ signal }) => entitySource.search(searchTerm, signal),
    enabled: open && searchReady,
    staleTime: 30_000,
  })

  // Já selecionado não reaparece entre os candidatos.
  const options = (search.data?.options ?? []).filter(
    (option) => !selectedIds.includes(option.id)
  )

  const selectedOptions = selectedIds
    .map((entityId) => labels[entityId])
    .filter((option): option is EntityOption => Boolean(option))

  function handleSelect(option: EntityOption) {
    setLabels((current) => ({ ...current, [option.id]: option }))
    setTerm('')

    if (props.multiple) {
      if (!props.value.includes(option.id)) props.onChange([...props.value, option.id])
      inputRef.current?.focus()
      return
    }

    props.onChange(option.id)
    setOpen(false)
  }

  function handleRemove(entityId: number) {
    if (props.multiple) {
      props.onChange(props.value.filter((current) => current !== entityId))
    } else {
      props.onChange(null)
    }
    // No modo simples o input reaparece no lugar do chip — já focado.
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === 'Backspace' &&
      term === '' &&
      props.multiple &&
      props.value.length > 0
    ) {
      props.onChange(props.value.slice(0, -1))
    }
  }

  // No modo simples, o chip ocupa o lugar do input.
  const showInput = props.multiple || selectedIds.length === 0
  const isHydrating = missingIds.length > 0 && hydration.isPending

  return (
    <Command shouldFilter={false} className="overflow-visible bg-transparent">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={fieldRef}
            onClick={() => inputRef.current?.focus()}
            className={cn(
              'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs transition-[color,box-shadow]',
              'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
              invalid && 'border-destructive focus-within:ring-destructive/20',
              disabled && 'cursor-not-allowed opacity-50',
              'dark:bg-input/30'
            )}
          >
            {isHydrating && <Skeleton className="h-5 w-40" />}

            {selectedOptions.map((option) => (
              <Chip
                key={option.id}
                option={option}
                disabled={disabled}
                onRemove={() => handleRemove(option.id)}
              />
            ))}

            {showInput && (
              <CommandPrimitive.Input
                ref={inputRef}
                id={id}
                value={term}
                onValueChange={(value) => {
                  setTerm(value)
                  setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-invalid={invalid}
                placeholder={
                  selectedOptions.length > 0 ? '' : (placeholder ?? entitySource.placeholder)
                }
                className="min-w-[10rem] flex-1 bg-transparent py-1 outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed"
              />
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={4}
          // Sem isso o Radix rouba o foco do input ao abrir e a digitação para.
          onOpenAutoFocus={(event) => event.preventDefault()}
          // Clicar no próprio campo não é "fora" — senão o dropdown pisca ao clicar.
          onInteractOutside={(event) => {
            if (fieldRef.current?.contains(event.target as Node)) event.preventDefault()
          }}
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <CommandList>
            {!typedEnough ? (
              <Hint>Digite ao menos {minChars} caracteres</Hint>
            ) : !searchReady || search.isFetching ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            ) : search.isError ? (
              // Erro local ao campo, com o usuário ainda digitando: inline, sem toast.
              <Hint className="text-destructive">Não foi possível buscar. Tente novamente.</Hint>
            ) : options.length === 0 ? (
              <Hint>{entitySource.emptyMessage}</Hint>
            ) : (
              <>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={String(option.id)}
                      onSelect={() => handleSelect(option)}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.sublabel && (
                          <span className="truncate text-xs text-muted-foreground">
                            {option.sublabel}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {search.data?.hasMore && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Mostrando os {search.data.options.length} primeiros. Refine a busca.
                  </p>
                )}
              </>
            )}
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  )
}

function Chip({
  option,
  disabled,
  onRemove,
}: {
  option: EntityOption
  disabled?: boolean
  onRemove: () => void
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
      <span className="truncate">
        {option.label}
        {!option.isActive && ' (inativo)'}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          aria-label={`Remover ${option.label}`}
          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('py-6 text-center text-sm text-muted-foreground', className)}>{children}</p>
  )
}
