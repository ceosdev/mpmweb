# Spec: Criar tela de parametrização de LDF

> ⚠️ **Não é simple-CRUD puro.** A entidade tem um relacionamento com um pai
> (`expense_groups`) e a listagem expõe código + filtros compostos — a
> [rule simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
> manda abandonar o padrão quando há campos além de descrição+status ou
> relacionamentos. Esta spec mantém a **mesma dinâmica** da família (paginação
> 20/página server-side, ordenação por colunas, formulário em modal, hard delete,
> badge de status, multitenant, filtro só no clique em "Pesquisar") — só amplia
> campos e filtros, na mesma linha das specs
> [012 — Serviços](./012-criar-tela-servicos.md) e
> [013 — Produtos](./013-criar-tela-produtos.md).

## Problema

O **LDF (Lançamento Direto Financeiro)** é uma forma de gerar um título em contas
a pagar **sem documento formal** (sem nota fiscal / documento fiscal de origem).
O módulo de LDF em si será construído depois; antes dele é preciso o cadastro
mestre que define **quais lançamentos diretos a empresa aceita** e a **qual grupo
de despesa** cada um pertence — é o que esta tela entrega.

## Solução proposta

Criar tela de CRUD para gerenciar as parametrizações de LDF da empresa ativa.

- A entidade é **por empresa** (multitenant): toda query é filtrada por
  `tenant.company.id`.
- Cada parametrização pertence obrigatoriamente a um **grupo de despesa**
  (`expense_groups`, spec [017](./017-criar-tela-grupo-de-despesa.md)), escolhido
  por um `Select` no formulário.
- Gerar as 4 permissões no catálogo: `ldf_parameters.view`, `.create`, `.edit`,
  `.delete`. ROOT recebe tudo via curinga `*`.
- Formulário em **modal** (3 campos).
- Item no menu lateral, no grupo **"Cadastros"**, em ordem alfabética (entre
  "Marcas" e "Produtos").

## Domínio

- **Entidade**: parametrização de LDF (`ldf_parameter`).
- **Pai**: grupo de despesa (`expense_group`).
- **Exemplos**: *Reembolso de quilometragem* (grupo "COMBUSTIVEIS E
  LUBRIFICANTES"); *Adiantamento a fornecedor* (grupo "ALUGUEL VEICULOS E MOTOS
  MENSAL"); *Taxa de cartório* (grupo "CORREIOS E MALOTES").
- **Justificativa de negócio**: o LDF gera contas a pagar sem documento formal;
  cada empresa precisa parametrizar previamente os lançamentos permitidos e
  classificá-los por grupo de despesa, para que a despesa caia na natureza certa
  e possa ser desativada sem perder o histórico.

## Específicos do módulo

- **Tabela**: `ldf_parameters`
- **Slug do módulo**: `ldf_parameters`
- **Endpoints**: `/api/ldf-parameters`
- **Rota frontend**: `/ldf-parameters`
- **Módulo frontend**: `src/modules/ldf-parameters/`
- **Ícone (lucide-react)**: `SlidersHorizontal`
- **Label do menu**: "Parametrizações de LDF"
- **Grupo do menu**: "Cadastros"

## Campos

| Campo (UI, pt-BR) | Coluna (DB, en)    | Tipo                   | Obrigatório | Observações |
| ----------------- | ------------------ | ---------------------- | ----------- | ----------- |
| Código            | `id`               | serial                 | automático  | Não aparece no formulário; é o `id` da linha, exibido como "Código" na listagem e aceito como filtro. |
| Descrição         | `description`      | `varchar(120)`         | sim         | Texto livre, `trim` no submit, mín. 1 / máx. 120. **Sem unicidade** — duplicados permitidos. |
| Grupo de despesa  | `expense_group_id` | FK `expense_groups.id` | sim         | `Select` no formulário. Lista só grupos **ativos**; na edição, o grupo já vinculado continua selecionável mesmo se inativo (marcado "(inativo)"), para o vínculo nunca se perder em silêncio. |
| Ativo             | `is_active`        | boolean                | não         | Default `true`. Inativos aparecem na listagem com badge "Inativa". |

- `company_id` FK `companies.id` `ON DELETE RESTRICT`, NOT NULL.
- `expense_group_id` FK `expense_groups.id` `ON DELETE RESTRICT` — impede excluir
  um grupo de despesa que já esteja parametrizado.
- Sem `deleted_at`: exclusão é **hard delete**.
- Índices: `(company_id, description)` para a ordenação default e
  `(company_id, expense_group_id)` para o filtro por grupo.

## Listagem

Colunas: **Código** (`id`), **Descrição**, **Grupo de despesa**, **Status**, ações.

- Ordenáveis no backend: `id`, `description`, `is_active`, `created_at`.
  Ordenação default: `description asc`.
- Paginação server-side, 20/página.

## Filtros

Barra de filtros acima da tabela; **nada consulta antes do clique em
"Pesquisar"** (hook `useSearchFilters`), exceto a consulta inicial com os
defaults.

| Filtro           | Tipo                                     | Comportamento |
| ---------------- | ---------------------------------------- | ------------- |
| Código           | input numérico                           | Igualdade exata com o `id`. Valor não numérico é ignorado. |
| Descrição        | input texto                              | `like` case-insensitive, parcial. |
| Grupo de despesa | `Select` alimentado por `/expense-groups` | "Todos" (default) ou um grupo específico. |

Botão **Pesquisar** (`SearchButton`, com spinner enquanto a consulta roda) e
**Limpar filtros** (ghost, visível quando há rascunho sujo).

## Critérios de aceite

- [ ] Só quem tem `ldf_parameters.view` abre a tela e vê o item no menu.
- [ ] Criar exige `ldf_parameters.create`; editar, `.edit`; excluir, `.delete` —
      reforçado na API, não só na UI.
- [ ] A listagem mostra código, descrição, grupo de despesa e status, paginada em
      20/página, ordenável pelas colunas `Código`, `Descrição` e `Status`.
- [ ] Os três filtros combinam entre si e só disparam a consulta no clique em
      "Pesquisar" (ou Enter nos inputs de texto).
- [ ] Salvar sem grupo de despesa é bloqueado no formulário e na API.
- [ ] Escolher um grupo de despesa de outra empresa retorna erro de negócio
      ("Grupo de despesa inválido."), mesmo forjando o payload.
- [ ] Excluir pede confirmação (`ConfirmDialog`) e é permanente; se a linha já
      estiver referenciada por outra tabela, a API devolve 409 com mensagem em
      pt-BR.
- [ ] Excluir um grupo de despesa já parametrizado é bloqueado com 409.
- [ ] Trocar de empresa recarrega a listagem (queryKey inclui `companyId`) e
      nenhum dado de outra empresa aparece.
