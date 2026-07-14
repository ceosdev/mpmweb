import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface MultiSelectOption<T extends string> {
  value: T
  label: string
}

interface MultiSelectProps<T extends string> {
  options: MultiSelectOption<T>[]
  value: T[]
  onChange: (value: T[]) => void
  /** Texto do gatilho quando **nada** está selecionado. Ex.: "Todos". */
  emptyLabel: string
  id?: string
  className?: string
  disabled?: boolean
}

/**
 * Seleção múltipla por checkbox, dentro de um Popover.
 *
 * **Nada selecionado significa "todos"** — é a ausência de filtro, não um filtro
 * vazio que não devolve nada. Por isso o gatilho mostra `emptyLabel` ("Todos") em
 * vez de "Selecione".
 *
 * Para poucas opções fixas (um enum). Se um dia precisar buscar entre muitos
 * registros, o componente certo é o `EntityPicker`.
 */
export function MultiSelect<T extends string>({
  options,
  value,
  onChange,
  emptyLabel,
  id,
  className,
  disabled,
}: MultiSelectProps<T>) {
  function toggle(option: T) {
    onChange(
      value.includes(option)
        ? value.filter((current) => current !== option)
        : [...value, option]
    )
  }

  const summary =
    value.length === 0
      ? emptyLabel
      : value.length === 1
        ? (options.find((option) => option.value === value[0])?.label ?? emptyLabel)
        : `${value.length} selecionados`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('justify-between font-normal', className)}
        >
          <span className={cn('truncate', value.length === 0 && 'text-muted-foreground')}>
            {summary}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-1.5">
        <div className="space-y-0.5">
          {options.map((option) => {
            const checkboxId = `${id ?? 'multi'}-${option.value}`
            return (
              <div
                key={option.value}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <Checkbox
                  id={checkboxId}
                  checked={value.includes(option.value)}
                  onCheckedChange={() => toggle(option.value)}
                />
                <Label htmlFor={checkboxId} className="flex-1 cursor-pointer text-sm font-normal">
                  {option.label}
                </Label>
              </div>
            )
          })}
        </div>

        {value.length > 0 && (
          <>
            <div className="my-1 border-t" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal text-muted-foreground"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
