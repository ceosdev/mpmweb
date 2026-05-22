import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { onlyDigits } from '@/lib/masks'

interface MaskedInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value' | 'type'> {
  /** Raw, digits-only value held by the form. */
  value: string
  /** Emits the raw, digits-only value back to the form. */
  onChange: (raw: string) => void
  /** Formatter that turns raw digits into the displayed mask. */
  mask: (raw: string) => string
  /** Maximum number of digits the field accepts. */
  maxDigits: number
}

/**
 * Input that masks the displayed value while keeping the form state raw
 * (digits only). Pair with `Controller` from React Hook Form.
 */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(function MaskedInput(
  { value, onChange, mask, maxDigits, ...rest },
  ref
) {
  return (
    <Input
      {...rest}
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      value={mask(value)}
      onChange={(event) => onChange(onlyDigits(event.target.value).slice(0, maxDigits))}
    />
  )
})
