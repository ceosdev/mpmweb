# Spec: Criar tela de serviços

> ⚠️ **Não é simple-CRUD puro.** O cadastro tem relacionamento com um pai
> (`service_groups`), enum de tipo (interno / terceiro), valor monetário opcional
> e campo de observações — a [rule simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
> diz para abandonar quando há campos além de descrição+status, valores ou
> relacionamentos. Esta spec mantém a **mesma dinâmica** da família (paginação
> 20/página server-side, ordenação por colunas, formulário em modal, hard delete,
> badge de status, multitenant) — só amplia campos e filtros, na mesma linha dos
> specs [010 — Fornecedores](./010-criar-tela-fornecedores.md),
> [011 — Clientes](./011-criar-tela-clientes.md) e
> [006 — Subgrupo de produto](./006-criar-tela-subgrupo-de-produto.md) (FK para o pai).

## Problema

Cada empresa precisa catalogar os **serviços que oferece** (ex.: troca de óleo,
alinhamento, instalação) com um valor sugerido e uma classificação entre serviço
executado internamente ou contratado de terceiros. Esse cadastro mestre será
consumido por módulos futuros (ordens de serviço, orçamentos, faturamento).

## Solução proposta

Criar tela de CRUD para gerenciar os serviços da empresa ativa.

- A entidade é **por empresa** (multitenant): cada empresa mantém os seus
  próprios serviços. Toda query é filtrada por `tenant.company.id`.
- Cada serviço pertence a um **grupo de serviço** (`service_groups`, já existente),
  escolhido por um `Select` no formulário.
- Gerar as 4 permissões no catálogo: `services.view`, `services.create`,
  `services.edit`, `services.delete`. ROOT recebe tudo via curinga `*`.
- O formulário é exibido em **modal** (decisão explícita do usuário).
- O item entra no menu lateral, dentro do grupo **"Cadastros"**, logo após
  "Grupos de serviço".

## Domínio

- **Entidade**: serviço (`service`).
- **Pai**: grupo de serviço (`service_group`).
- **Exemplos**: *Troca de óleo* (grupo "Manutenção", interno, R$ 120,00);
  *Alinhamento e balanceamento* (grupo "Manutenção", interno, R$ 90,00);
  *Recarga de ar-condicionado* (grupo "Climatização", terceiro, R$ 250,00).
- **Justificativa de negócio**: futuras telas (OS, orçamentos, faturamento)
  precisam apontar para um serviço cadastrado, com um valor de referência e a
  informação de quem o executa — este é o cadastro mestre.

## Específicos do módulo

- **Tabela**: `services`
- **Slug do módulo**: `services`
- **Endpoints**: `/api/services`
- **Rota frontend**: `/services`
- **Módulo frontend**: `src/modules/services/`
- **Ícone (lucide-react)**: `Hammer` (o `Wrench` já é usado por "Grupos de serviço"; ajustável)
- **Label do menu**: "Serviços"
- **Grupo do menu**: "Cadastros"

## Campos

| Campo (UI, pt-BR)     | Coluna (DB, en)     | Tipo                       | Obrigatório | Observações |
| --------------------- | ------------------- | -------------------------- | ----------- | ----------- |
| Descrição do serviço  | `description`       | `varchar(120)`             | sim         | `trim`; 1–120 caracteres. |
| Grupo do serviço      | `service_group_id`  | FK `service_groups.id`     | sim         | `Select` no form; lista só grupos **ativos** da empresa. |
| Valor sugerido        | `suggested_value`   | `decimal(12,2)` nullable   | não         | Valor em **reais**. `>= 0`. Exibido/editado com máscara de moeda (R$). |
| Tipo                  | `type`              | `varchar(20)` (enum)       | sim         | Valores no DB: `internal` \| `third_party`. Labels na UI: "Serviço interno" / "Serviço de terceiro". Default `internal`. |
| Observações           | `notes`             | `text` nullable            | não         | `trim`; máx 1000. String vazia → `null`. |
| Status                | `is_active`         | `boolean` default `true`   | sim         | Toggle no form; badge "Ativo"/"Inativo" na listagem. |

> **Idioma** (regra do projeto): nomes de colunas e enum em inglês; labels e
> mensagens em português.

## Comportamento esperado

### Fluxo feliz

- O usuário com permissão `services.view` acessa a tela pelo menu lateral
  ("Cadastros" → "Serviços").
- Vê a listagem paginada (20 por página, server-side) com as colunas:
  - **Descrição** (ordenável, asc por default).
  - **Grupo** (descrição do grupo de serviço). *Não ordenável nesta versão* — é
    um join; manter simples (ver "Fora de escopo").
  - **Tipo** (badge: "Interno" / "Terceiro", ordenável).
  - **Valor sugerido** (formatado `R$ 0,00`; se nulo, traço `—`; ordenável).
  - **Status** (badge "Ativo"/"Inativo", ordenável).
  - **Ações** (Editar / Excluir).
- Clica em "Novo serviço" (gated por `services.create`) → abre o formulário em
  **modal**, com os campos: Descrição, Grupo do serviço (`Select`), Tipo
  (`Select`/radio), Valor sugerido (input de moeda, opcional), Observações
  (`textarea`), Status (toggle, default ativo).
- Preenche os obrigatórios (Descrição, Grupo, Tipo). Submete.
- O registro é salvo, o modal fecha, a listagem atualiza e um toast de sucesso
  aparece.

### Fluxos alternativos

- **Editar**: clica em editar (gated por `services.edit`) → abre o mesmo modal
  preenchido. É permitido trocar o grupo do serviço. Se o serviço estava num
  grupo que ficou **inativo**, o `Select` ainda exibe o grupo atual (selecionado)
  para não perder o vínculo, mesmo que ele não apareça para novos cadastros.
- **Excluir**: clica em excluir (gated por `services.delete`) → abre
  `ConfirmDialog` → **hard delete**. Se houver FK violation (módulo futuro
  referenciando o serviço), o backend traduz para 409 em pt-BR:
  *"Não é possível excluir este serviço porque está em uso."*.
- **Reativar**: editar um inativo e marcar o toggle de status como ativo.
  Inativos continuam visíveis na listagem (com badge "Inativo").

### Filtros

A tela tem **2 filtros** (pedido explícito do usuário), posicionados em uma linha
entre o `PageHeader` e o `Card` (mesma área de busca dos demais CRUDs):

| Filtro     | Tipo       | Comportamento |
| ---------- | ---------- | ------------- |
| Descrição  | `Input`    | Busca debounced (350 ms). Backend faz `lower(description) like ?`. |
| Tipo       | `Select`   | Opções: *Todos*, *Serviço interno*, *Serviço de terceiro*. Default *Todos*. |

- Qualquer mudança de filtro reseta `page` para 1.
- Ambos os filtros entram na `queryKey` e nos query params do GET.
- Botão "Limpar filtros" só aparece quando ao menos um filtro está ativo.
- **Sem filtro de status** nesta versão: inativos aparecem na listagem com badge
  "Inativo" (consistente com a família — o usuário precisa enxergá-los para
  reativar). Se um filtro de status for pedido depois, vira ajuste próprio.

### Regras de negócio

- **Multitenant**: serviços pertencem à empresa ativa. Um usuário nunca vê
  serviços de outra empresa (exceto ROOT, que enxerga tudo).
- **`company_id` denormalizado**: embora derivável via `service_group_id →
  company_id`, a coluna `company_id` fica direto em `services` (mesma decisão do
  spec 006) para defender contra acesso cruzado entre tenants e simplificar as
  queries de listagem.
- **Grupo do serviço**: obrigatório. O backend valida que o `service_group_id`
  recebido **existe e pertence ao tenant**; caso contrário, 422 com mensagem
  *"Grupo de serviço inválido."* (não vaza existência de grupos de outra empresa).
  No create, o `Select` lista apenas grupos **ativos**.
- **Tipo**: enum estrito (`internal` | `third_party`). Default `internal` no
  create. Qualquer outro valor → 422.
- **Valor sugerido**: opcional; quando preenchido, número `>= 0` com 2 casas
  decimais, armazenado em reais (`decimal(12,2)`). Vazio → `null`.
- **Observações**: opcional, texto livre até 1000 caracteres. Vazio → `null`.
- **Descrição**: `trim`, 1–120. **Sem unicidade** — descrições duplicadas são
  permitidas (consistente com a família).
- **Status**: campo `is_active` boolean, default `true`. Sempre visível na
  coluna da listagem.
- **Ordenação default**: descrição ascendente. Colunas ordenáveis: Descrição,
  Tipo, Valor sugerido, Status (regra `crud-sortable-columns`).
- **Paginação**: server-side 20/página (regra `crud-pagination`).
- **Exclusão**: hard delete (sem `deleted_at`), consistente com a família.

## Fora de escopo

- Vínculo com outros módulos (OS, orçamentos, faturamento) — vem nas specs deles.
- Ordenação pela coluna "Grupo" (sort por campo de join) — listagem ordena por
  colunas da própria `services` nesta versão.
- Filtro por grupo de serviço e filtro por status.
- Unicidade de descrição por empresa/grupo.
- Importação em lote, histórico/auditoria, anexos.
- Tabela de preços por cliente / faixas de preço — há um único "valor sugerido".
- Imposto, custo, margem ou qualquer cálculo financeiro derivado do valor.

## Decisões técnicas

### Backend

- **Migration** nova `create_services_table`:
  ```ts
  table.increments('id').notNullable()

  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('companies').onDelete('RESTRICT')

  table
    .integer('service_group_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('service_groups').onDelete('RESTRICT')

  table.string('description', 120).notNullable()
  table.decimal('suggested_value', 12, 2).nullable()
  table.string('type', 20).notNullable() // 'internal' | 'third_party'
  table.text('notes').nullable()
  table.boolean('is_active').notNullable().defaultTo(true)

  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()

  table.index(['company_id', 'description'], 'services_company_description_idx')
  table.index(['company_id', 'service_group_id'], 'services_company_group_idx')
  ```
  **Sem `deleted_at`** (hard delete). Sem unique — duplicados são permitidos.
  `service_group_id` com `onDelete('RESTRICT')`: não dá para excluir um grupo de
  serviço que tenha serviços vinculados (o spec 004 já trata esse 409 do lado do
  grupo).

- **Catálogo de permissões** (`backend/app/abilities/catalog.ts`): adicionar
  módulo `services` com `view`, `create`, `edit`, `delete`, na seção depois de
  `service_groups`. Textos `name`/`description` em pt-BR.

- **Camadas** (pipeline padrão): `Service` model → `service_repository` →
  `service_service` → `services_controller` → rota em `start/routes.ts` sob
  `/api/services` com `middleware.tenant()` e `middleware.permission(...)` em
  cada ação.
  - **Repository** filtra sempre por `company_id`.
  - **Service** valida que o `service_group_id` existe e pertence ao tenant antes
    de criar/editar.

- **Validator VineJS** com mensagens em pt-BR. Validações:
  - `description`: `trim`, mín 1, máx 120.
  - `serviceGroupId`: `number`, positivo, obrigatório; existência + tenant
    validados no service.
  - `suggestedValue`: opcional, `number` `>= 0` (2 casas). Vazio → `null`.
  - `type`: `enum(['internal','third_party'])`.
  - `notes`: `trim`, opcional, máx 1000. Vazio → `null`.
  - `isActive`: boolean, default `true` no create.

- **Listagem**: paginação 20/página server-side, ordenação default
  `description asc`. A query faz `join` em `service_groups` para devolver a
  descrição do grupo (`group_description`) junto de cada serviço.
  Query params aceitos: `page`, `perPage`, `sort` (campo+direção — apenas
  `description`, `type`, `suggested_value`, `is_active`), `description`, `type`.
  - `description` → `lower(description) like %?%`.
  - `type` → igualdade exata, ignora se ausente.

- **Erro de FK na exclusão**: tratar o `23503` no controller/exception handler e
  devolver 409 com *"Não é possível excluir este serviço porque está em uso."*.

- **Seeder principal** (`main_seeder.ts`): apenas cadastra as permissões no
  catálogo. Sem serviços pré-cadastrados.

### Frontend

- **Rota nova** `/services` em `routes/router.tsx`, gated por `services.view`,
  registrada com `lazy()`.
- **Item no menu** ([`permissions/menu.ts`](../../../frontend/src/permissions/menu.ts)):
  dentro do grupo "Cadastros", ícone `Hammer`, label "Serviços", logo após
  "Grupos de serviço".
- **Página** `src/modules/services/services-page.tsx` reusando os blocos
  compartilhados: `PageHeader`, `Pagination`, `SortableHeader`, `EmptyState`,
  `ConfirmDialog`, `Can`, `Skeleton`, `Badge`.
- **Filtros** acima da tabela: 1 `Input` (descrição) + 1 `Select` (tipo) +
  botão "Limpar filtros" condicional. `useDebouncedValue` (350 ms) na descrição.
  Toda mudança reseta `page = 1`.
- **Formulário** em modal: `src/modules/services/service-form-dialog.tsx` com
  React Hook Form + Zod. Campos: Descrição (`Input`), Grupo do serviço
  (`Select`, opções via `useQuery` de `serviceGroupsApi.list` filtrando ativos),
  Tipo (`Select`), Valor sugerido (input de moeda), Observações (`textarea`),
  Status (toggle, default ativo).
  - **Input de moeda**: não há precedente monetário no projeto. Criar um
    componente reutilizável `MoneyInput` (ou estender `MaskedInput`) que mantém o
    valor numérico cru no form e exibe `R$ 1.234,56`. Helper `formatCurrency` em
    `lib/masks.ts` (ou `lib/format.ts`) para a exibição na listagem.
  - **Grupo no edit**: se o grupo atual estiver inativo, incluí-lo na lista de
    opções (selecionado) para não perder o vínculo.
- **API client**: `src/services/services-api.ts`.
- **Tipo `Service`** em `src/types/api.ts` (inclui `groupDescription` devolvido
  pela listagem para a coluna "Grupo").
- **QueryKey** da listagem:
  `['services', companyId, debouncedDescription, type, page, sort]`.
  - Lista de grupos no form: `['service-groups', companyId, 'active']` (ou reuso
    da query existente de grupos de serviço).
- **Exibição**:
  - Valor sugerido formatado via `formatCurrency`; se `null`, traço `—`.
  - Badge de "Tipo": "Interno" (variante `secondary`) / "Terceiro" (variante
    `default`).
  - Badge de "Status": "Ativo" / "Inativo".

## Critérios de aceite

- [ ] Migration cria a tabela `services` com as 2 FKs (`company_id`,
      `service_group_id`, ambas `RESTRICT`) + índices; `up` e `down` rodam limpas.
- [ ] Catálogo traz `services.view/create/edit/delete`; ROOT acessa por curinga.
- [ ] Endpoints `/api/services` (GET listar, POST criar, GET detalhe, PUT editar,
      DELETE excluir) com gates de permissão e escopo de tenant.
- [ ] Menu dinâmico mostra "Serviços" dentro de "Cadastros" para quem tem
      `services.view`.
- [ ] Listagem paginada 20/página; ordenação default por descrição asc; colunas
      Descrição, Tipo, Valor sugerido, Status ordenáveis.
- [ ] Filtros funcionam (descrição com `like`, tipo com igualdade); "Limpar
      filtros" só aparece quando há filtro ativo.
- [ ] Modal de criação salva com Descrição + Grupo + Tipo obrigatórios; rejeita
      faltantes com mensagem amigável (422).
- [ ] Selecionar um grupo de serviço de **outra empresa** (id forjado) retorna
      422 *"Grupo de serviço inválido."* — não vaza dados de outro tenant.
- [ ] Valor sugerido aceita vazio (grava `null`) e aceita valor monetário `>= 0`
      com 2 casas; valor negativo é rejeitado.
- [ ] Observações aceita vazio (grava `null`) e até 1000 caracteres.
- [ ] Tipo aceita apenas `internal` ou `third_party`; outro valor → 422.
- [ ] Modal de edição vem preenchido; trocar o grupo é permitido; grupo inativo
      vinculado continua selecionável no edit.
- [ ] Excluir abre `ConfirmDialog`; hard delete após confirmação. Serviço
      referenciado por módulo futuro → 409 em pt-BR.
- [ ] Excluir um grupo de serviço com serviços vinculados → 409 (FK RESTRICT do
      lado do grupo, mensagem já existente do spec 004).
- [ ] Multitenant: trocar de empresa invalida o cache e mostra somente os
      serviços da empresa ativa.
- [ ] Inativos aparecem na listagem com badge "Inativo" e podem ser reativados
      pelo modal de edição.
