---
title: Desktop-first, sempre responsivo
impact: MEDIUM
impactDescription: UX principal otimizada para notebook sem quebrar no mobile
tags: ui, responsive, layout, tailwind
---

## Desktop-first, sempre responsivo

**Impacto: MEDIUM (UX principal otimizada para notebook sem quebrar no mobile)**

A plataforma é usada quase que totalmente em **notebooks e desktops**.
Desenhe e teste primeiro nesse alvo — espaçamento generoso, layouts em
várias colunas, ações com estado de hover. Mas **toda tela ainda precisa
ser utilizável em celular ou tablet** — nunca deixe um layout vazar,
esconder ações importantes ou quebrar um formulário.

Não é um projeto "mobile-first depois enriquece"; é um projeto "padrão
desktop, colapsa direito".

## Breakpoints do Tailwind

Use os breakpoints do Tailwind v4 com intenção:

| Prefixo | Largura mínima | Uso típico |
| --- | --- | --- |
| (nenhum) | `< 640px` | Celulares — empilhe tudo na vertical. |
| `sm:` | `≥ 640px` | Celulares grandes / tablets pequenos. |
| `md:` | `≥ 768px` | Tablets — formulários começam a ganhar duas colunas. |
| `lg:` | `≥ 1024px` | Notebooks — **o alvo do design**. |
| `xl:` | `≥ 1280px` | Notebooks grandes / desktops — mais respiro. |

Escreva as classes base para **mobile** (a menor tela) e vá adicionando
`md:` / `lg:` para desktop. Esse é o sentido natural do Tailwind mesmo
quando a intenção do design é "desktop-first".

## Errado

```tsx
// ❌ Ruim — larguras fixas, vão estourar no celular
<div className="flex w-[960px] gap-8">
  <Sidebar className="w-72" />
  <main className="w-[688px]">…</main>
</div>

// ❌ Ruim — só classes de desktop, sem fallback para telas pequenas
<div className="grid grid-cols-3 gap-6">{/* campos */}</div>
```

## Correto

```tsx
// ✅ Bom — fluido, colapsa para uma única coluna no celular
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <Field name="legalName" />
  <Field name="tradeName" />
  <Field name="taxId" />
</div>

// ✅ Bom — cabeçalho de página que quebra em telas pequenas
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <PageHeader title="Usuários" description="…" />
  <Button>Novo usuário</Button>
</div>
```

## Checagens obrigatórias antes de dar uma tela como pronta

Rode o dev server e redimensione a janela nestas larguras:

- **≥ 1280px (xl)** — alvo principal. Confira espaçamento e densidade.
- **1024px (lg)** — notebook. Mesma densidade, sem scroll horizontal.
- **768px (md)** — tablet. Formulários multi-coluna viram 2 colunas; a
  sidebar pode virar drawer.
- **375px (sm/mobile)** — confirme que todo formulário é acessível, nenhum
  campo é cortado, tabelas rolam horizontalmente dentro do container,
  nenhuma ação fica escondida atrás de overflow.

Se uma tabela não couber horizontalmente no celular, envolva-a:

```tsx
<div className="overflow-x-auto">
  <Table className="min-w-[640px]">…</Table>
</div>
```

## Padrões específicos

- **Formulários**: padrão `space-y-4`. Multi-coluna dentro de
  `grid gap-4 md:grid-cols-2` — nunca comece com `grid-cols-2` (quebra
  abaixo de `md`).
- **Cabeçalho de página + ação principal**: `flex flex-col gap-3 sm:flex-row
  sm:items-center sm:justify-between`.
- **Sidebar**: colapsa para sheet/drawer abaixo de `lg`. Nunca exiba a
  sidebar fixa e um menu hambúrguer ao mesmo tempo.
- **Modais**: use larguras `sm:max-w-lg`/`sm:max-w-2xl` (já é um padrão do
  Tailwind — largura total abaixo de `sm`, limitada acima).
- **Tabelas**: mantenha no máximo ~6 colunas visíveis no desktop. No
  celular, permita scroll horizontal em vez de esconder colunas em
  silêncio — o usuário precisa saber que o dado está acessível.

## Relacionadas

- [[crud-form-presentation]] — as regras de tamanho de modal moram lá.
- [[ui-component-reuse]] — helpers responsivos (ex.: `ResponsiveTable`,
  `FormGrid`) pertencem a `components/`.
