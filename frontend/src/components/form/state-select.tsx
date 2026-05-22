import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Two-letter codes for every Brazilian state plus DF. */
export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

export type BrazilianState = (typeof BRAZILIAN_STATES)[number]

interface StateSelectProps {
  /** Empty string means "no selection". */
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  disabled?: boolean
}

/**
 * Select with the 27 Brazilian states. Stores the empty string when no
 * state is chosen so it composes cleanly with optional form fields.
 */
export function StateSelect({
  value,
  onChange,
  id,
  placeholder = 'UF',
  disabled,
}: StateSelectProps) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {BRAZILIAN_STATES.map((uf) => (
          <SelectItem key={uf} value={uf}>
            {uf}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
