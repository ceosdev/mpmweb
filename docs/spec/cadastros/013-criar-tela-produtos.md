# Spec: Criar tela de produtos

> ⚠️ **Não é simple-CRUD puro.** O cadastro tem múltiplos relacionamentos
> (`product_groups`, `product_subgroups`, `units_of_measure`), enum de tipo,
> valores monetários/quantitativos e regras de estoque — a
> [rule simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
> diz para abandonar quando há campos além de descrição+status, valores ou
> relacionamentos. Esta spec mantém a **mesma dinâmica** da família (paginação
> 20/página server-side, ordenação por colunas, formulário em modal, hard delete,
> badge de status, multitenant) — só amplia campos, filtros e regras, na linha dos
> specs [010 — Fornecedores](./010-criar-tela-fornecedores.md),
> [011 — Clientes](./011-criar-tela-clientes.md) e
> [012 — Serviços](./012-criar-tela-servicos.md).

## Problema

Cada empresa precisa catalogar os **produtos** que usa/consome ou que mantém como
ativo imobilizado (peças, insumos, materiais, equipamentos), com classificação por
grupo/subgrupo, unidade de medida, controle de estoque e preço de custo. Esse
cadastro mestre será consumido por módulos futuros (compras, movimentação de
estoque, ordens de serviço, faturamento).

## Solução proposta

Criar tela de CRUD para gerenciar os produtos da empresa ativa.

- A entidade é **por empresa** (multitenant): cada empresa mantém os seus próprios
  produtos. Toda query é filtrada por `tenant.company.id`.
- Cada produto pode (opcionalmente) pertencer a um **grupo de produto**
  (`product_groups`), a um **subgrupo de produto** (`product_subgroups`) e a uma
  **unidade de medida** (`units_of_measure`), todas já existentes.
- Gerar as 4 permissões no catálogo: `products.view`, `products.create`,
  `products.edit`, `products.delete`. ROOT recebe tudo via curinga `*`.
- **Dependência de permissão (decisão "C")**: o formulário reusa o endpoint
  existente de subgrupos (`GET /api/product-groups/:groupId/subgroups`), que é
  gated por `product_subgroups.view`. Portanto, **quem recebe acesso a `products`
  deve também receber `product_subgroups.view`** — caso contrário a cascata de
  subgrupo retorna 403. Isso é documentado aqui e nos critérios de aceite; não há
  endpoint de options próprio (evita duplicar rota).
- O formulário é exibido em **modal** (decisão explícita do usuário) — sem rota
  dedicada.
- O item entra no menu lateral, dentro do grupo **"Cadastros"**, logo após
  "Grupos de produto".

## Domínio

- **Entidade**: produto (`product`).
- **Relacionamentos (todos opcionais)**: grupo de produto (`product_group`),
  subgrupo de produto (`product_subgroup`), unidade de medida (`unit_of_measure`).
- **Exemplos**: *Óleo 5W30* (grupo "Lubrificantes", subgrupo "Óleo motor", UN "L",
  uso e consumo, controla estoque, mín. 10, qtd. 8 → **estoque baixo**); *Parafusadeira*
  (grupo "Ferramentas", ativo imobilizado, não controla estoque).
- **Justificativa de negócio**: módulos futuros (compras, estoque, OS, faturamento)
  precisam apontar para um produto cadastrado, com classificação, unidade e custo —
  este é o cadastro mestre.

## Específicos do módulo

- **Tabela**: `products`
- **Slug do módulo**: `products`
- **Endpoints**: `/api/products`
- **Rota frontend**: `/products`
- **Módulo frontend**: `src/modules/products/`
- **Ícone (lucide-react)**: `Package`
- **Label do menu**: "Produtos"
- **Grupo do menu**: "Cadastros"

## Campos

| Campo (UI, pt-BR)       | Coluna (DB, en)        | Tipo                        | Obrigatório | Observações |
| ----------------------- | ---------------------- | --------------------------- | ----------- | ----------- |
| Descrição do produto    | `description`          | `varchar(120)`              | **sim**     | `trim`; 1–120 caracteres. Único campo obrigatório. |
| Tipo do produto         | `type`                 | `varchar(20)` (enum)        | **sim**     | DB: `consumable` \| `fixed_asset`. UI: "Uso e consumo" / "Ativo imobilizado". Sem default — o usuário precisa escolher. |
| Grupo de produto        | `product_group_id`     | FK `product_groups.id` null | não         | `Select` no form; lista só grupos **ativos**. |
| Subgrupo de produto     | `product_subgroup_id`  | FK `product_subgroups.id` null | não      | `Select` em **cascata** com o grupo (lista só subgrupos do grupo escolhido). |
| Unidade de medida       | `unit_of_measure_id`   | FK `units_of_measure.id` null | não       | `Select` no form. |
| Controla estoque        | `controls_stock`       | `boolean` default `false`   | não         | Toggle no form. Indica se o produto tem estoque no almoxarifado. **Governa** os dois campos abaixo (ver regras). |
| Estoque mínimo          | `minimum_stock`        | `decimal(12,3)` nullable    | não         | `>= 0`. Só editável com "controla estoque" ligado. Off → forçado a `null`. Base da regra de "estoque baixo". Entrada/exibição em formato pt-BR (ver máscaras). |
| Quantidade em estoque   | `quantity_in_stock`    | `decimal(12,3)` nullable    | não         | `>= 0`. **Só editável no create**; no edit é imutável (alterado só pela futura "entrada de nota"). Com "controla estoque" ligado e sem valor informado no create → `0`. Off → `null`. Formato pt-BR. |
| Preço de custo          | `cost_price`           | `decimal(12,2)` nullable    | não         | Valor em **reais**, `>= 0`. Máscara de moeda (R$). Vazio → `null`. |
| Status (ativo)          | `is_active`            | `boolean` default `true`    | sim         | Toggle no form; badge "Ativo"/"Inativo" na listagem. |

> **Idioma** (regra do projeto): nomes de colunas e enum em inglês; labels e
> mensagens em português.

## Comportamento esperado

### Fluxo feliz

- O usuário com permissão `products.view` acessa a tela pelo menu lateral
  ("Cadastros" → "Produtos").
- Vê a listagem paginada (20 por página, server-side) com as colunas:
  - **Descrição** (ordenável, asc por default).
  - **Tipo** (badge: "Uso e consumo" / "Ativo imobilizado"; se nulo, traço `—`. Ordenável).
  - **Grupo** (descrição do grupo; se nulo, `—`). *Não ordenável* — é join.
  - **Unidade** (`description` da UN; se nulo, `—`). *Não ordenável* — é join.
    (`units_of_measure` só tem `description`, não há sigla.)
  - **Estoque** (quantidade em estoque, formatada pt-BR; se **não controla
    estoque** ou nulo, `—`. Quando o produto está em **estoque baixo**, a célula
    recebe destaque visual, ex.: badge/texto em vermelho). Ordenável por
    `quantity_in_stock`.
  - **Custo** (formatado `R$ 0,00`; se nulo, `—`). Ordenável.
  - **Status** (badge "Ativo"/"Inativo", ordenável).
  - **Ações** (Editar / Excluir).
- Clica em "Novo produto" (gated por `products.create`) → abre o formulário em
  **modal** com todos os campos. Só "Descrição" é obrigatório.
- Preenche o que quiser. Submete.
- O registro é salvo, o modal fecha, a listagem atualiza e um toast de sucesso
  aparece.

### Fluxos alternativos

- **Editar**: clica em editar (gated por `products.edit`) → abre o mesmo modal
  preenchido. O campo **"Quantidade em estoque" fica read-only/desabilitado**
  (com texto auxiliar: *"Ajustado pela entrada de nota"*) — ver regras. Demais
  campos editáveis, incluindo controla estoque, estoque mínimo e preço de custo.
  - **Reativar o controle de estoque no edit**: se o usuário liga "controla
    estoque" num produto que estava com ele desligado, "estoque mínimo" volta a
    ser editável, mas "quantidade em estoque" permanece **imutável** (ficará `null`
    até a futura entrada de nota alimentar o saldo — não nasce 0 no edit, só no
    create).
  - **Desligar o controle de estoque no edit**: zera (`null`) tanto estoque mínimo
    quanto quantidade no backend (ver regras) e desabilita os dois campos no form.
  - Se o grupo/subgrupo/unidade vinculados estiverem **inativos** (ou o subgrupo
    pertencer a um grupo já trocado), o respectivo `Select` ainda exibe o valor
    atual (selecionado) para não perder o vínculo, mesmo que não apareça para
    novos cadastros.
- **Excluir**: clica em excluir (gated por `products.delete`) → abre
  `ConfirmDialog` → **hard delete**. Se houver FK violation (módulo futuro
  referenciando o produto), o backend traduz para 409 em pt-BR:
  *"Não é possível excluir este produto porque está em uso."*.
- **Reativar**: editar um inativo e marcar o toggle de status como ativo.
  Inativos continuam visíveis na listagem (com badge "Inativo").

### Filtros

A tela tem **5 filtros + 1 checkbox de estoque baixo** (pedido explícito do
usuário), posicionados na área de busca, entre o `PageHeader` e o `Card` (mesma
área dos demais CRUDs):

| Filtro            | Tipo       | Comportamento |
| ----------------- | ---------- | ------------- |
| Descrição         | `Input`    | Busca debounced (350 ms). Backend faz `lower(description) like %?%`. |
| Grupo de produto  | `Select`   | Opções: *Todos* + grupos ativos da empresa. Filtra por `product_group_id`. |
| Tipo de produto   | `Select`   | Opções: *Todos*, *Uso e consumo*, *Ativo imobilizado*. |
| Controla estoque  | `Select`   | Opções: *Todos*, *Sim*, *Não*. Filtra por `controls_stock`. |
| Status            | `Select`   | Opções: *Todos*, *Ativos*, *Inativos*. Default *Ativos*. |
| Estoque baixo     | `Checkbox` | Quando marcado, lista só produtos com **estoque ≤ estoque mínimo** (ver regra abaixo). |

- Qualquer mudança de filtro reseta `page` para 1.
- Todos os filtros entram na `queryKey` e nos query params do GET.
- Botão "Limpar filtros" só aparece quando ao menos um filtro está ativo (o
  default *Ativos* do status não conta como filtro ativo para esse propósito).
  Ao limpar, **o status volta para *Ativos*** (não para *Todos*); os demais
  filtros voltam ao vazio e o checkbox de estoque baixo é desmarcado.

#### Regra do filtro "estoque baixo"

- Só traz produtos que: **(1) controlam estoque** (`controls_stock = true`),
  **(2)** têm **estoque mínimo configurado** (`minimum_stock IS NOT NULL`) **e**
  **(3)** `quantity_in_stock <= minimum_stock`.
- Produtos que **não controlam estoque** ou que estão **sem `minimum_stock`**
  **nunca** aparecem com o filtro ligado — mesmo que tenham os campos preenchidos
  por algum motivo. (Decisão do usuário: se não controla estoque, é ignorado. Na
  prática o backend já força esses campos a `null` quando `controls_stock=false`,
  então a condição (1) é redundante mas fica explícita por segurança.)
- Exemplo do usuário: estoque mínimo = 199 e quantidade = 200 → **não** aparece;
  só apareceria se a quantidade fosse ≤ 199.
- `quantity_in_stock` nulo é tratado como **0** na comparação (um produto que
  controla estoque, com mínimo definido e quantidade ainda não alimentada, está
  abaixo do mínimo).
- A **mesma condição** (1+2+3) alimenta o **destaque visual de "estoque baixo"**
  na coluna Estoque, independente do checkbox estar ligado.

### Regras de negócio

- **Multitenant**: produtos pertencem à empresa ativa. Um usuário nunca vê
  produtos de outra empresa (exceto ROOT).
- **Campos opcionais**: todos os campos são opcionais, **exceto `description` e
  `type`** (ambos obrigatórios). FKs vazias → `null`; números vazios → `null`.
- **Estoque imutável na edição (estratégia A)**: `quantity_in_stock` só pode ser
  informado no **create**. O `updateProductValidator` **não declara** o campo —
  como o VineJS descarta chaves não declaradas, qualquer valor enviado no PUT é
  silenciosamente ignorado e o saldo atual é mantido. O frontend exibe o campo
  desabilitado no edit. Justificativa: a quantidade será movimentada pela futura
  "entrada de nota", não por edição direta. *Controla estoque e estoque mínimo
  permanecem editáveis.*
- **Ativo imobilizado não controla estoque**: quando `type = 'fixed_asset'`, o
  backend **força** `controls_stock = false` (e, por consequência da governança
  abaixo, `minimum_stock = null` e `quantity_in_stock = null`), em create e update,
  independente do payload. No form, ao escolher "Ativo imobilizado" o toggle
  "controla estoque" trava em desligado e os campos estoque mínimo/quantidade
  ficam desabilitados e limpos.
- **`controls_stock` governa os campos de estoque**: é a fonte da verdade.
  - `controls_stock = false` (em create **ou** update): o backend **força**
    `minimum_stock = null` e `quantity_in_stock = null`. No form, os dois campos
    ficam **desabilitados** (e limpos). Não há validação cruzada que bloqueie o
    submit — o backend apenas normaliza.
  - `controls_stock = true` no **create**: se `quantity_in_stock` não vier (vazio),
    grava **`0`**; `minimum_stock` segue opcional (vazio → `null`).
  - `controls_stock = true` no **update**: `minimum_stock` editável; `quantity_in_stock`
    permanece imutável (estratégia A). Ligar o controle num produto que estava sem
    ele **não** semeia 0 no edit — a quantidade fica `null` até a entrada de nota.
- **Subgrupo em cascata**: `product_subgroup_id`, quando informado, deve pertencer
  ao `product_group_id` informado. O backend valida a consistência
  (subgrupo.product_group_id == product_group_id); caso contrário, 422
  *"Subgrupo não pertence ao grupo selecionado."*. Informar subgrupo sem grupo →
  422 *"Selecione o grupo do subgrupo."*.
- **Validação de FKs por tenant**: cada FK informada (`product_group_id`,
  `product_subgroup_id`, `unit_of_measure_id`) deve **existir e pertencer ao
  tenant**; caso contrário, 422 com mensagem específica em pt-BR (não vaza
  existência de registros de outra empresa).
- **Tipo**: **obrigatório**, enum estrito (`consumable` | `fixed_asset`). Ausente
  ou qualquer outro valor → 422. Coluna `type` é `NOT NULL`.
- **Estoque mínimo / quantidade em estoque**: opcionais, `decimal(12,3)`, `>= 0`.
  Valor negativo → 422. Entrada e exibição em **formato pt-BR** (vírgula decimal,
  até 3 casas) — ver "Máscaras" nas decisões técnicas. Sujeitos à governança de
  `controls_stock` (acima).
- **Preço de custo**: opcional; quando preenchido, número `>= 0` com 2 casas,
  armazenado em reais (`decimal(12,2)`). Vazio → `null`.
- **Descrição**: `trim`, 1–120. **Sem unicidade** — descrições duplicadas são
  permitidas (consistente com a família).
- **Controla estoque**: boolean, default `false`. É a flag que governa os campos
  de estoque (ver bullet acima) e que módulos futuros usarão como gatilho.
- **Status**: `is_active` boolean, default `true`. Sempre visível na listagem.
- **Ordenação default**: descrição ascendente. Colunas ordenáveis: Descrição,
  Tipo, Estoque (`quantity_in_stock`), Custo (`cost_price`), Status.
- **Paginação**: server-side 20/página (regra `crud-pagination`).
- **Exclusão**: hard delete (sem `deleted_at`), consistente com a família.

## Fora de escopo

- Movimentação de estoque, entradas/saídas, histórico de saldo — módulo próprio.
  Aqui o saldo só é semeado no create e exibido na listagem.
- Vínculo com outros módulos (compras, OS, faturamento) — vem nas specs deles.
- Ordenação pelas colunas de join (Grupo, Unidade).
- Unicidade de descrição / código de produto / SKU / código de barras.
- Múltiplas unidades, conversão de unidades, preço de venda, margem, impostos.
- Importação em lote, anexos/foto do produto, auditoria.
- **Entrada de nota / movimentação de saldo** — módulo futuro; é o único caminho
  para alterar `quantity_in_stock` após o create.

## Decisões técnicas

### Backend

- **Migration** nova `create_products_table`:
  ```ts
  table.increments('id').notNullable()

  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('companies').onDelete('RESTRICT')

  table.string('description', 120).notNullable()
  table.string('type', 20).nullable() // 'consumable' | 'fixed_asset'

  table
    .integer('product_group_id')
    .unsigned()
    .nullable()
    .references('id').inTable('product_groups').onDelete('RESTRICT')

  table
    .integer('product_subgroup_id')
    .unsigned()
    .nullable()
    .references('id').inTable('product_subgroups').onDelete('RESTRICT')

  table
    .integer('unit_of_measure_id')
    .unsigned()
    .nullable()
    .references('id').inTable('units_of_measure').onDelete('RESTRICT')

  table.boolean('controls_stock').notNullable().defaultTo(false)
  table.decimal('minimum_stock', 12, 3).nullable()
  table.decimal('quantity_in_stock', 12, 3).nullable()
  table.decimal('cost_price', 12, 2).nullable()
  table.boolean('is_active').notNullable().defaultTo(true)

  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()

  table.index(['company_id', 'description'], 'products_company_description_idx')
  table.index(['company_id', 'product_group_id'], 'products_company_group_idx')
  ```
  **Sem `deleted_at`** (hard delete). Sem unique — duplicados são permitidos.
  Todas as FKs com `onDelete('RESTRICT')`: não dá para excluir grupo/subgrupo/
  unidade que tenha produtos vinculados (o 409 é tratado do lado dessas entidades).

- **Catálogo de permissões** (`backend/app/abilities/catalog.ts`): adicionar
  módulo `products` com `view`, `create`, `edit`, `delete`, na seção depois de
  `product_subgroups`. Textos `name`/`description` em pt-BR.
  - **Dependência de role (decisão "C")**: roles que receberem `products.*`
    precisam também ter `product_subgroups.view` para a cascata de subgrupo
    funcionar. Sem endpoint de options dedicado. Orientar nas roles seedadas/demo
    (se houver) e documentar para o ADMIN que monta perfis.

- **Camadas** (pipeline padrão): `Product` model → `product_repository` →
  `product_service` → `products_controller` → rota em `start/routes.ts` sob
  `/api/products` com `middleware.tenant()` e `middleware.permission(...)` em cada
  ação.
  - **Repository** filtra sempre por `company_id`.
  - **Service** valida tenant + existência de cada FK informada e a consistência
    subgrupo↔grupo antes de criar/editar. Aplica a **normalização de estoque**:
    - `controls_stock=false` → seta `minimum_stock=null` e `quantity_in_stock=null`
      (create e update).
    - `controls_stock=true` no create sem `quantity_in_stock` → `0`.
    - No update, `quantity_in_stock` nem chega ao service (validator A não o
      declara), então o saldo atual é preservado.

- **Validator VineJS** com mensagens em pt-BR. Validações:
  - `description`: `trim`, mín 1, máx 120.
  - `type`: opcional, `enum(['consumable','fixed_asset'])`. Vazio → `null`.
  - `productGroupId` / `productSubgroupId` / `unitOfMeasureId`: opcionais,
    `number` positivo; existência + tenant + cascata validados no service.
  - `controlsStock`: boolean, default `false`.
  - `minimumStock`: opcional, `number` `>= 0` (até 3 casas). Vazio → `null`.
  - `quantityInStock`: opcional, `number` `>= 0` (até 3 casas). Declarado **apenas
    no `createProductValidator`**. O `updateProductValidator` **não inclui o
    campo** (estratégia A — chave descartada no PUT, saldo imutável).
  - `costPrice`: opcional, `number` `>= 0` (2 casas). Vazio → `null`.
  - `isActive`: boolean, default `true` no create.

  > Dois validators distintos (`create` e `update`) — a única diferença prática é
  > a presença de `quantityInStock` no create.

- **Listagem**: paginação 20/página server-side, ordenação default
  `description asc`. A query faz `join`/`leftJoin` em `product_groups` e
  `units_of_measure` para devolver `group_description` e `unit_description` junto
  de cada produto. Query params aceitos: `page`, `perPage`, `sort` (apenas
  `description`, `type`, `quantity_in_stock`, `cost_price`, `is_active`),
  `description`, `productGroupId`, `type`, `controlsStock`, `status`, `lowStock`.
  - `description` → `lower(description) like %?%`.
  - `productGroupId`, `type`, `controlsStock` → igualdade exata, ignora se ausente.
  - `status` → `is_active` (ativos/inativos); default *ativos*.
  - `lowStock=true` → `controls_stock = true and minimum_stock is not null and
    coalesce(quantity_in_stock,0) <= minimum_stock`.

- **Erro de FK na exclusão**: tratar o `23503` no controller/exception handler e
  devolver 409 com *"Não é possível excluir este produto porque está em uso."*.

- **Seeder principal** (`main_seeder.ts`): apenas cadastra as permissões no
  catálogo. Sem produtos pré-cadastrados.

### Frontend

- **Rota nova** `/products` em `routes/router.tsx`, gated por `products.view`,
  registrada com `lazy()`.
- **Item no menu** ([`permissions/menu.ts`](../../../frontend/src/permissions/menu.ts)):
  dentro do grupo "Cadastros", ícone `Package`, label "Produtos", logo após
  "Grupos de produto".
- **Primitivos/utilitários novos a criar**:
  - **`src/components/ui/checkbox.tsx`** — não existe ainda no projeto (só há
    `Checkbox` interno em `table.tsx`/`dropdown-menu.tsx`). Criar o primitivo
    shadcn (Radix `@radix-ui/react-checkbox`), igual ao precedente do `textarea`
    criado na spec 012. Usado no filtro "estoque baixo".
  - **Máscara decimal pt-BR em `lib/masks.ts`** — não há helper para decimais
    livres (só `maskMoney`, fixo em 2 casas). Adicionar `maskQuantity`
    (entrada: vírgula decimal, milhar com ponto, até 3 casas) + `formatQuantity`
    (exibição na listagem). Form mantém o **número cru**; UI mostra pt-BR. Mesma
    abordagem do par `maskMoney`/`formatCurrency`.
- **Página** `src/modules/products/products-page.tsx` reusando os blocos
  compartilhados: `PageHeader`, `Pagination`, `SortableHeader`, `EmptyState`,
  `ConfirmDialog`, `Can`, `Skeleton`, `Badge`, `Select`, e o novo `Checkbox`.
- **Filtros** acima da tabela: `Input` (descrição, debounced 350 ms) + `Select`
  (grupo) + `Select` (tipo) + `Select` (controla estoque) + `Select` (status,
  default *Ativos*) + `Checkbox` (estoque baixo) + botão "Limpar filtros"
  condicional. Toda mudança reseta `page = 1`. **"Limpar filtros" reseta o status
  para *Ativos*** (não *Todos*).
- **Formulário** em modal: `src/modules/products/product-form-dialog.tsx` com
  React Hook Form + Zod. Campos: Descrição (`Input`), Tipo (`Select`), Grupo
  (`Select`, opções de grupos ativos), Subgrupo (`Select` em **cascata** —
  habilitado só com grupo escolhido; recarrega ao trocar o grupo e limpa a
  seleção anterior), Unidade de medida (`Select`), Controla estoque (toggle),
  Estoque mínimo (`maskQuantity`), Quantidade em estoque (`maskQuantity`),
  Preço de custo (input de moeda, reusa `maskMoney`/`formatCurrency`), Status
  (toggle, default ativo).
  - **Governança de `controls_stock` no form**: quando o toggle está **off**, os
    campos "estoque mínimo" e "quantidade em estoque" ficam **desabilitados e
    limpos**. Quando **on**, "estoque mínimo" fica editável; "quantidade em
    estoque" é editável **só no create** (no edit fica desabilitada com o texto
    auxiliar *"Ajustado pela entrada de nota"*).
  - **Cascata de subgrupo**: ao escolher/trocar o grupo, buscar os subgrupos via
    `GET /api/product-groups/:groupId/subgroups` e resetar `productSubgroupId`.
    ⚠️ Esse endpoint exige `product_subgroups.view` (decisão "C" — ver topo).
  - **Selects no edit**: se grupo/subgrupo/unidade vinculados estiverem inativos,
    incluí-los na lista (selecionados) para não perder o vínculo.
  - **Carregamento "só ativos" (estratégia A)**: como no precedente de Serviços,
    cada Select de apoio (grupo, unidade, subgrupos) busca `perPage: 200,
    sort: description, order: asc` e filtra `isActive` no client. **Limite
    conhecido: 200 opções por Select** — aceitável dado o porte da plataforma
    (~15 usuários); registrado aqui para não virar surpresa.
- **API client**: `src/services/products-api.ts`.
- **Tipo `Product`** em `src/types/api.ts` (inclui `groupDescription` e
  `unitDescription` devolvidos pela listagem para as colunas).
- **QueryKey** da listagem:
  `['products', companyId, debouncedDescription, productGroupId, type, controlsStock, status, lowStock, page, sort]`.
  - Selects de apoio: `['product-groups', companyId, 'active']`,
    `['units-of-measure', companyId, 'active']`,
    `['product-subgroups', companyId, groupId]` (reuso/cascata).
- **Exibição**:
  - Preço de custo via `formatCurrency`; `null` → `—`.
  - Estoque via `formatQuantity`: se **não controla estoque** ou nulo → `—`; em
    **estoque baixo** (`controls_stock && minimum_stock != null && qty <= minimum`)
    → destaque vermelho (badge/texto).
  - Unidade: `description` da UN; `null` → `—`.
  - Badge de "Tipo": "Uso e consumo" / "Ativo imobilizado"; nulo → `—`.
  - Badge de "Status": "Ativo" / "Inativo".

## Critérios de aceite

- [ ] Migration cria a tabela `products` com `company_id` + 3 FKs opcionais
      (grupo, subgrupo, unidade, todas `RESTRICT`) + índices; `up`/`down` limpos.
- [ ] Catálogo traz `products.view/create/edit/delete`; ROOT acessa por curinga.
- [ ] Endpoints `/api/products` (GET listar, POST criar, GET detalhe, PUT editar,
      DELETE excluir) com gates de permissão e escopo de tenant.
- [ ] Menu dinâmico mostra "Produtos" dentro de "Cadastros" para quem tem
      `products.view`.
- [ ] Criar produto só com **Descrição** funciona (todos os demais opcionais).
- [ ] Listagem paginada 20/página; ordenação default por descrição asc; colunas
      Descrição, Tipo, Estoque, Custo, Status ordenáveis.
- [ ] Filtros funcionam (descrição `like`, grupo/tipo/controla estoque por
      igualdade, status); "Limpar filtros" só aparece quando há filtro ativo.
- [ ] **Filtro "estoque baixo"**: marca o checkbox → lista só produtos que
      controlam estoque, com `minimum_stock` definido e `quantity_in_stock <=
      minimum_stock`; produto com mínimo 199 e quantidade 200 **não** aparece; com
      quantidade 199 aparece; produto sem mínimo ou que não controla estoque nunca
      aparece. Mesma condição alimenta o destaque vermelho na coluna.
- [ ] **Governança de `controls_stock`**: criar com controla estoque ligado e sem
      quantidade → grava `0`; desligar o controle (create ou edit) → `minimum_stock`
      e `quantity_in_stock` viram `null` e os campos ficam desabilitados no form.
- [ ] **Ativo imobilizado**: escolher tipo "Ativo imobilizado" trava `controls_stock`
      em `false` (toggle desabilitado) e desabilita/limpa estoque mínimo e
      quantidade; o backend força isso mesmo com payload forjado.
- [ ] **Quantidade em estoque** é gravável só no create e **ignorada** no edit
      (validator de update sem o campo); o saldo não muda ao editar outros campos.
- [ ] **Máscaras pt-BR**: estoque mínimo/quantidade aceitam vírgula decimal (até
      3 casas) e exibem formatado; custo via máscara de moeda.
- [ ] **Componente `Checkbox`** novo criado em `components/ui/checkbox.tsx`.
- [ ] **Dependência de permissão (C)**: usuário sem `product_subgroups.view` não
      consegue carregar a cascata; roles com `products.*` devem incluir
      `product_subgroups.view`.
- [ ] **Cascata de subgrupo**: subgrupo lista só os do grupo escolhido; trocar o
      grupo limpa o subgrupo; subgrupo de outro grupo (id forjado) → 422.
- [ ] **Limpar filtros** reseta o status para *Ativos* (não *Todos*).
- [ ] FK de grupo/subgrupo/unidade de **outra empresa** (id forjado) → 422 sem
      vazar dados de outro tenant.
- [ ] Tipo é **obrigatório**: criar/editar sem tipo → 422; aceita só
      `consumable`/`fixed_asset`.
- [ ] Estoque mínimo/quantidade/custo aceitam vazio (gravam `null`) e valores
      `>= 0`; negativos → 422.
- [ ] Modal de edição vem preenchido; grupo/subgrupo/unidade inativos vinculados
      continuam selecionáveis no edit.
- [ ] Excluir abre `ConfirmDialog`; hard delete após confirmação. Produto
      referenciado por módulo futuro → 409 em pt-BR.
- [ ] Excluir grupo/subgrupo/unidade com produtos vinculados → 409 (FK RESTRICT).
- [ ] Multitenant: trocar de empresa invalida o cache e mostra somente os produtos
      da empresa ativa.
- [ ] Inativos aparecem na listagem com badge "Inativo" e podem ser reativados
      pelo modal de edição.
