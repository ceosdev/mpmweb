---
title: Armazene cru, exiba com máscara (CPF, CNPJ, CEP, telefone)
impact: HIGH
impactDescription: Fonte única da verdade no banco, mesma affordance de UI em todo lugar
tags: forms, masks, cpf, cnpj, cep, validation
---

## Armazene cru, exiba com máscara (CPF, CNPJ, CEP, telefone)

**Impacto: HIGH (fonte única da verdade no banco, mesma affordance de UI em todo lugar)**

Documentos e códigos que têm máscara visual (CPF, CNPJ, CEP, telefone)
devem ser:

- **Armazenados sem máscara** no backend e nos payloads da API — apenas
  dígitos, sem pontos, barras, hífens ou parênteses. A coluna do banco é a
  representação canônica; comparações, checagem de unicidade e
  integrações trabalham sobre o valor cru.
- **Renderizados com máscara** na UI — tanto nos controles de input
  (enquanto se digita) quanto em exibições somente leitura (tabelas,
  resumos, telas de detalhe).

A transformação mora inteiramente no **frontend**: a API nunca vê um valor
mascarado e nunca devolve um.

## Formatos padrão

| Campo | Cru (DB / API) | Mascarado (UI) |
| --- | --- | --- |
| CPF | `12345678901` (11 dígitos) | `123.456.789-01` |
| CNPJ | `12345678000190` (14 dígitos) | `12.345.678/0001-90` |
| CEP | `12345678` (8 dígitos) | `12345-678` |
| Telefone (móvel) | `11987654321` (10–11 dígitos) | `(11) 98765-4321` |

## Onde mora a lógica

Dois utilitários em `src/lib/masks.ts`:

```ts
// src/lib/masks.ts

export const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function maskCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function maskCep(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}

/** Detecta CPF vs CNPJ pela contagem de dígitos — usado na coluna `taxId`. */
export function maskTaxId(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = onlyDigits(raw)
  if (d.length <= 11) return maskCpf(d)
  return maskCnpj(d)
}

export function maskPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}
```

## Input — componente MaskedInput

```tsx
// src/components/form/masked-input.tsx
import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { onlyDigits } from '@/lib/masks'

interface Props extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  value: string                                 // apenas dígitos
  onChange: (raw: string) => void               // emite apenas dígitos
  mask: (raw: string) => string                 // formatador
  maxDigits: number
}

export const MaskedInput = forwardRef<HTMLInputElement, Props>(function MaskedInput(
  { value, onChange, mask, maxDigits, ...rest },
  ref
) {
  return (
    <Input
      {...rest}
      ref={ref}
      inputMode="numeric"
      value={mask(value)}
      onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, maxDigits))}
    />
  )
})
```

## Errado

```tsx
// ❌ Ruim — enviando a string mascarada para a API
const onSubmit = (values: FormValues) => {
  companiesApi.create({ ...values, taxId: '12.345.678/0001-90' })
}

// ❌ Ruim — renderizando dígitos crus em uma tabela
<TableCell>{company.taxId /* "12345678000190" */}</TableCell>

// ❌ Ruim — validando a string mascarada no Zod
taxId: z.string().min(18) // conta pontos e barras
```

## Correto

```tsx
// ✅ Bom — o RHF guarda o valor cru, o MaskedInput cuida da exibição mascarada
const form = useForm<CompanyFormValues>({
  resolver: zodResolver(companySchema),
  defaultValues: { legalName: '', tradeName: '', taxId: '' },
})

<Controller
  control={form.control}
  name="taxId"
  render={({ field }) => (
    <MaskedInput
      value={field.value}
      onChange={field.onChange}
      mask={maskCnpj}
      maxDigits={14}
      placeholder="00.000.000/0000-00"
    />
  )}
/>

// ✅ Bom — payload enviado para a API só com dígitos (o form já guarda cru)
const onSubmit = form.handleSubmit((values) => companiesApi.create(values))

// ✅ Bom — a célula da tabela usa o mesmo masker
<TableCell>{maskTaxId(company.taxId)}</TableCell>
```

## Regras com Zod

Valide o valor cru, não o mascarado:

```ts
import { z } from 'zod'
import { onlyDigits } from '@/lib/masks'

const cpfDigits = z.string().transform((v) => onlyDigits(v)).pipe(z.string().length(11))
const cnpjDigits = z.string().transform((v) => onlyDigits(v)).pipe(z.string().length(14))
const cepDigits = z.string().transform((v) => onlyDigits(v)).pipe(z.string().length(8))

// Aceita CPF ou CNPJ na mesma coluna ("taxId"):
const taxId = z
  .string()
  .transform(onlyDigits)
  .refine((d) => d.length === 11 || d.length === 14, 'CPF ou CNPJ inválido.')
```

Use esses helpers nos schemas de formulário em `src/modules/<dominio>/`.

## Quando o campo é opcional

Se o campo é opcional, aceite string vazia e converta para `null` no
payload — a API espera ou uma string válida de dígitos, ou `null`, nunca
uma máscara parcial:

```ts
const payload = {
  ...values,
  taxId: values.taxId ? values.taxId : null,
}
```

## Relacionadas

- [[ui-component-reuse]] — `MaskedInput` mora em `components/form/` e é
  compartilhado por todo módulo que mexe com CPF/CNPJ/CEP/telefone.
- [[crud-form-presentation]] — a máscara funciona igual em formulário de
  modal e de rota.
