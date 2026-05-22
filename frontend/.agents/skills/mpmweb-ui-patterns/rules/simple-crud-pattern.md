---
title: Padrão de CRUD simples (descrição + status)
impact: HIGH
impactDescription: Cadastros básicos seguem o mesmo molde, reduzindo retrabalho e divergência entre módulos
tags: crud, cadastros, full-stack, multitenant
---

## Padrão de CRUD simples (descrição + status)

**Impacto: HIGH (cadastros básicos seguem o mesmo molde, reduzindo retrabalho e divergência entre módulos)**

> Esta rule é **full-stack** — atravessa backend e frontend. Fica nesta skill
> por proximidade com as outras regras da família CRUD, mas as decisões de
> banco/permissão/seed valem do mesmo jeito.

Vários cadastros básicos da plataforma seguem exatamente o mesmo molde —
tipo de pagamento, tipo de documento, unidade de medida, categoria, etc.
Esta rule documenta o padrão único para que toda spec e toda implementação
dessa família tenha a mesma forma.

A spec correspondente fica curta: declara apenas o domínio e referencia esta
rule. O modelo de spec está no final do documento.

## Quando aplicar

O cadastro entra neste padrão quando **todos** os pontos abaixo valem:

- Tem exatamente **dois campos visíveis** em tela: descrição (texto livre) e status (ativo/inativo).
- Não precisa de tabs, abas, listas aninhadas, upload de arquivo ou integração externa.
- É **por empresa** (multitenant) — cada empresa cadastra os seus.
- Não há regra de unicidade explícita (duplicados são permitidos).
- Não há requisito de soft delete (auditoria, recuperação).

Se algum desses pontos não vale, **veja a seção "Quando NÃO usar"** mais abaixo.

## Decisões fixas

### Schema do banco

- Tabela: `snake_case` plural em inglês (ex.: `payment_types`, `document_types`, `units_of_measure`).
- Colunas:
  - `id` (autoincrement)
  - `company_id` (FK `companies.id`, NOT NULL)
  - `description` (`varchar(120)`, NOT NULL)
  - `is_active` (boolean, default `true`, NOT NULL)
  - `created_at`, `updated_at`
- **Sem `deleted_at`** — exclusão é hard delete.
- Índice composto `(company_id, description)` para a ordenação default.

### Permissões

- 4 slugs em inglês: `<module>.view`, `<module>.create`, `<module>.edit`, `<module>.delete`.
- Adicionar em `backend/app/abilities/catalog.ts`.
- ROOT já cobre via curinga `*`. Atribuição a ADMIN/OPERADOR não é decidida aqui — vem com a tela futura de montagem de perfil.
- **Nunca** traduzir os slugs (`tipos_pagamento.criar` é errado).

### Backend (camadas)

Seguir o pipeline padrão do projeto:

```
Migration → Model → Repository → Service → Validator → Controller → Rota
```

- Validator VineJS com `SimpleMessagesProvider` em pt-BR.
- Rota sob `/api/<kebab-case-do-recurso>` (ex.: `/api/payment-types`) com `middleware.tenant()` e `middleware.permission(...)` em cada ação.
- Toda query escopada por `tenant.company.id` (não-ROOT).
- Listagem com paginação 20/página server-side; ordenação default `description asc`.
- Exclusão é `DELETE` SQL direto.
- **Tratamento de FK violation na exclusão**: o controller (ou o exception handler) captura o erro do PostgreSQL e devolve **409** com mensagem amigável em pt-BR: *"Não é possível excluir este(a) `<entidade>` porque está em uso."*

### Frontend

- Rota nova em `frontend/src/routes/router.tsx` gated por `<module>.view`, registrada com `lazy()`.
- Item no menu (`frontend/src/permissions/menu.ts`) com ícone `lucide-react` apropriado e label em pt-BR.
- Página em `src/modules/<kebab-case>/<kebab-case>-page.tsx` reusando os blocos compartilhados: `PageHeader`, `Pagination`, `SortableHeader`, `EmptyState`, `ConfirmDialog`, `Can`, `Skeleton`, `Badge`.
- Formulário em **modal** (regra [[crud-form-presentation]] — 2 campos → modal): `<entity>-form-dialog.tsx`.
- Listagem paginada 20/página (regra [[crud-pagination]]), cabeçalhos ordenáveis (regra [[crud-sortable-columns]]).
- Inativos visíveis na listagem com badge "Inativa" — o usuário precisa ver para reativar.
- **Busca por descrição** por padrão: `Input` com ícone `Search` (lucide-react), `max-w-sm`, posicionado entre o `PageHeader` e o `Card`. Estado local + `useDebouncedValue` (350 ms, hook em `@/hooks/use-debounced-value`). Toda mudança de texto reseta `page` para 1. O termo debounced entra na `queryKey` e no parâmetro `search` do API client; backend já filtra com `lower(description) like ?`.
- **Empty state contextual**: título e descrição mudam conforme há busca ativa ou não — `"Nenhum X encontrad{o,a}"` + `"Tente ajustar os termos da busca."` quando há `debouncedSearch`; `"Nenhum X cadastrad{o,a}"` + `"Cadastre o/a primeiro/a X desta empresa."` caso contrário.
- Sem filtro de status por padrão (a menos que entre gratuitamente via componente compartilhado).
- `ConfirmDialog` na exclusão (regra [[crud-confirmation-dialogs]]).
- Toast (`sonner`) + `getErrorMessage()` para feedback.
- `queryKey` inclui `tenant.companyId` para invalidar cache ao trocar de empresa.

### Validação

- Descrição: aplica `trim` no submit; mínimo **1 caractere** após o trim; máximo 120.
- Status: boolean; default ativo na criação.
- **Sem regra de unicidade** — descrições duplicadas são permitidas.

### Seed

- O `main_seeder.ts` cadastra apenas as **permissões** desse módulo no catálogo.
- **Sem registros pré-cadastrados** — cada empresa começa vazia e cadastra os seus.

## Anti-padrões a evitar

- **Soft delete** neste tipo de entidade — sempre hard delete.
- **Filtro de status** antes de haver pedido real do usuário.
- **Remover a busca por descrição** sob alegação de "ninguém vai usar" — ela faz parte do padrão e custa quase nada.
- **Form em rota** — sempre modal (são 2 campos).
- **Restrição de unicidade** sem requisito explícito.
- **Tipos pré-cadastrados no seed** — cada empresa decide.
- **Slugs em português** — sempre inglês (`module.action`).
- **Permissão `view` ausente** do catálogo — sem ela ninguém abre a tela.
- **Esquecer o filtro multitenant** no repository — vaza dado entre empresas.
- **Manter inativos escondidos** — o usuário precisa enxergar pra reativar.

## Quando NÃO usar este padrão

Se algum desses pontos vale, **abandone esta rule** e desenhe sob medida:

- A entidade tem campos além de descrição+status (valores, datas, relacionamentos, código manual etc.).
- Precisa de tabs, listas aninhadas, upload — vai para rota dedicada (regra [[crud-form-presentation]]).
- É global (não-multitenant).
- Precisa de soft delete (auditoria, recuperação, ou tem dependências que justificam preservar histórico).
- Tem regra de unicidade.

Para esses casos, a spec é escrita do zero — esta rule não se aplica.

## Modelo de spec

A spec de um cadastro deste padrão deve ser **curta** e referenciar esta
rule. Use este molde:

```markdown
# Spec: Criar tela de <entidade>

CRUD simples padrão — ver rule [simple-crud-pattern](...).

## Domínio
- Entidade: <nome legível em pt-BR>
- Exemplos: <2–4 valores típicos>
- Justificativa de negócio: <1 frase>

## Específicos do módulo
- Tabela: `<snake_case_plural>`
- Slug do módulo: `<snake_case>`
- Endpoints: `/api/<kebab-case-plural>`
- Rota frontend: `/<kebab-case-plural>`
- Módulo frontend: `src/modules/<kebab-case-plural>/`
- Ícone (lucide-react): `<Nome>`
- Label do menu: "<texto em pt-BR>"

## Critérios de aceite específicos
(Opcional — só liste o que diverge do padrão. Critérios universais já estão na rule.)
```

## Relacionadas

- [[crud-pagination]] — paginação 20/página, server-side.
- [[crud-sortable-columns]] — cabeçalhos clicáveis que ordenam no backend.
- [[crud-form-presentation]] — 2 campos → modal.
- [[crud-confirmation-dialogs]] — confirmação obrigatória na exclusão.
- [[ui-component-reuse]] — reuso de `PageHeader`, `EmptyState`, `ConfirmDialog` etc.
