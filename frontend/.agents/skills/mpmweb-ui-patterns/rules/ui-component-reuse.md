---
title: Prefira extrair um componente compartilhado a duplicar UI
impact: HIGH
impactDescription: Menor custo de manutenção e design consistente entre módulos
tags: ui, components, dry, maintainability
---

## Prefira extrair um componente compartilhado a duplicar UI

**Impacto: HIGH (menor custo de manutenção e design consistente entre módulos)**

Quando o mesmo pedaço de UI aparece (ou está prestes a aparecer) em mais
de um lugar, extraia para um componente compartilhado. JSX duplicado é a
fonte mais comum de divergência: a segunda cópia fica um pouquinho
diferente da primeira, o comportamento começa a divergir e os bugs
precisam ser corrigidos duas vezes.

Aplique a **regra do dois**: na primeira vez, deixar inline tudo bem. Na
segunda vez que o mesmo bloco é escrito, **pare e extraia**.

Esta regra explicitamente sobrescreve qualquer instinto geral de "não
abstrair cedo" quando se trata de UI *visual* neste projeto — a meta é
consistência de design.

## Onde colocar

| Alcance | Localização | Exemplos |
| --- | --- | --- |
| Primitivo (shadcn) | `src/components/ui/` | `button.tsx`, `dialog.tsx` — não editar à mão |
| Bloco entre módulos | `src/components/` | `PageHeader`, `EmptyState`, `ConfirmDialog`, `FullPageLoader` |
| Helpers de tabela / formulário entre módulos | `src/components/data-table/` ou `src/components/form/` | `Pagination`, `SortableHeader`, `MaskedInput` |
| Usado em **um único** módulo | `src/modules/<dominio>/_components/` (privado) | `UserAvatarCell` usado só em `users-page` |

## O que já existe — reutilize primeiro

Antes de criar qualquer coisa nova, verifique se o projeto já tem:

- `PageHeader` — título + descrição + slot de ação para toda tela.
- `EmptyState` — blocos de lista vazia / sem resultados.
- `ConfirmDialog` — confirmação destrutiva / em várias etapas.
- `FullPageLoader` — fallback de Suspense / loader de guard de rota.
- `Can` (`src/permissions/can.tsx`) — renderização gated por permissão.
- `Skeleton` (shadcn) — estados de loading em lista/tabela.

Se o requisito é próximo mas não exato, **estenda** o componente existente
(adicione uma prop) em vez de copiar e colar uma nova variante.

## Errado

```tsx
// ❌ Ruim — empty state específico de página copiado entre módulos
function UsersPage() {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Users className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhum usuário encontrado</p>
      </div>
    )
  }
}

function CompaniesPage() {
  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Building2 className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhuma empresa cadastrada</p>
      </div>
    )
  }
}
```

## Correto

```tsx
// ✅ Bom — o componente compartilhado já existe; reutilize
import { EmptyState } from '@/components/empty-state'

<EmptyState
  icon={Users}
  title="Nenhum usuário encontrado"
  description="Cadastre o primeiro usuário desta empresa."
/>
```

## Quando promover um componente

Um componente privado de módulo é promovido para `src/components/` quando:

- Um segundo módulo precisa dele (a "regra do dois").
- O visual faz parte da identidade da plataforma (cabeçalho de página,
  cabeçalho de dialog).
- Ele codifica uma responsabilidade transversal (loading, empty state,
  confirmação, gate de permissão).

A subpasta `components/data-table/` é o lar certo para qualquer helper
reutilizado entre listagens de CRUD — `Pagination`, `SortableHeader`,
`SearchInput`, `RowActions`, `ColumnVisibilityMenu` etc.

## Anti-padrões a evitar

- **Copiar e colar o corpo de um Dialog** entre dois arquivos
  `*-form-dialog.tsx` — extraia o corpo ou mova os controles de campo
  compartilhados para `components/form/`.
- **Reimplementar o rodapé de paginação** em cada listagem — deve existir
  um único `<Pagination />` compartilhado por todo CRUD.
- **Editar primitivos do shadcn diretamente** para um estilo isolado —
  envolva (`wrap`) o componente ou passe um `className`.

## Relacionadas

- [[crud-pagination]] — o bloco `<Pagination />` mora em `components/data-table/`.
- [[crud-sortable-columns]] — `<SortableHeader />` mora em `components/data-table/`.
- [[form-masked-fields]] — `<MaskedInput />` mora em `components/form/`.
