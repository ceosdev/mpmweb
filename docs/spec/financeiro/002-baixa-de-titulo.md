# Spec: Baixa (pagamento) de título a pagar

> **Continuação direta da [tela de contas a pagar](001-criar-tela-contas-a-pagar.md).**
> O CRUD do título já deixou o terreno pronto: a coluna `paid_amount`, o
> `PayableService.recomputeStatus()` (o **único** ponto que deriva `status`) e a
> mensagem de FK *"já possui baixas"* já existem, esperando esta spec. Aqui
> nasce a entidade que **move o `paid_amount`** — a **baixa** (`settlement`).
>
> **Não é uma tela de menu.** É um **drill-down** aberto a partir do grid de
> contas a pagar (como *Ativos do produto* / *Modelos da marca*): não entra no
> `menu.ts`, só no `module-labels.ts` e no `catalog.ts`.
>
> **É a primeira operação multi-tabela do financeiro** — cada baixa criada,
> editada ou removida escreve na tabela de baixas **e** recalcula o título. Isso
> roda **sempre em transação** (ver [Integridade e transação](#integridade-e-transação)).

## Problema

Um título lançado em contas a pagar nasce **Aberto**, devendo o total. Não há
como registrar que ele foi **pago** — total ou parcialmente. A empresa precisa
lançar as **baixas** de cada título: quando pagou, por qual meio, quanto, e com
qual documento. É a baixa que movimenta o saldo e leva o título de **Aberto** a
**Parcial** e a **Pago**.

## Solução proposta

Criar a entidade **baixa de título** (`payable_settlement`), filha do título, e
a tela (modal) que a gerencia a partir do grid de contas a pagar.

- Um título tem **N baixas**. A soma das baixas compõe o valor pago
  (`paid_amount`) e **nunca pode exceder o total** do título. Um título de
  R$ 100,00 pode ter 3 baixas (25 + 25 + 50), desde que a soma **feche exatamente**
  o total para ficar **Pago**.
- A baixa é aberta por uma **ação no grid** de contas a pagar. As ações do grid
  passam a ficar num **menu "Ações"** (Editar / Excluir / **Pagamentos**), no
  lugar dos ícones soltos de hoje.
- A tela de baixa é um **modal que abre na listagem** das baixas do título, com
  um botão **"Nova baixa"** — é um CRUD aberto a partir de outra tela.
- Gerar 4 permissões: `payable_settlements.view/create/edit/delete`.
- Toda escrita de baixa **recalcula `paid_amount` e o `status`** do título,
  **dentro de uma transação**.

## Domínio

- **Entidade**: baixa de título (`payable_settlement`) — o pagamento (total ou
  parcial) de um título.
- **Pai**: título a pagar (`payable`). FK `RESTRICT` — não se apaga um título que
  tenha baixa (a regra e a mensagem 409 já vivem em `PayableService.destroy`).
- **Exemplo**: título 1234/1 de R$ 100,00 → baixa de R$ 25,00 em 10/07 (boleto),
  baixa de R$ 25,00 em 12/07 (Pix) e baixa de R$ 50,00 em 15/07 (cheque nº 000123).
  Soma = R$ 100,00 → título fica **Pago**, saldo **R$ 0,00**.
- **Justificativa de negócio**: sem a baixa não há saldo real, não há fluxo de
  caixa, e o título fica eternamente "Aberto" mesmo depois de pago.

> **Nota de vocabulário.** No código o termo é **settlement** (já consolidado em
> `auto_settlement` e nos comentários do `PayableService`). Na UI convivem
> "baixa" e "pagamento": o **item de menu do grid** se chama **"Pagamentos"**
> (pedido do usuário) e a tela/entidade é a **"baixa"**. Ver
> [brecha 1](#1-pagamentos-vs-baixa-vocabulário).

## Específicos do módulo

- **Tabela**: `payable_settlements`
- **Slug do módulo**: `payable_settlements`
- **Endpoints**: `/api/payables/:payableId/settlements` (aninhado no título)
- **Sem rota de página** — é modal aberto pelo grid de `/payables`.
- **Módulo frontend**: `src/modules/payables/` (junto do pai; não é módulo novo)
- **Ícone (lucide-react)**: `Wallet` / `HandCoins` (ação "Pagamentos")
- **Rótulo do módulo** (`module-labels.ts`): `payable_settlements: 'Baixas do título'`
  — segue a convenção de drill-down (o rótulo nomeia o pai), como
  *"Ativos do produto"*.
- **NÃO entra no `menu.ts`** (é drill-down, como subgrupos/ativos/modelos).

## Campos

| Campo (UI, pt-BR)   | Coluna (DB, en)    | Tipo                | Obrigatório | Observações |
| ------------------- | ------------------ | ------------------- | ----------- | ----------- |
| Data da baixa       | `settlement_date`  | `date`              | sim         | Default: **hoje** (`todayIso`, fuso da aplicação). |
| Tipo de pagamento   | `payment_type_id`  | FK `payment_types`  | sim         | `Select` dos tipos **ativos** da empresa. `RESTRICT` na FK. |
| Número do documento | `document_number`  | `varchar(30)` nullable | não      | `trim`. Disclaimer na UI: *"Apenas para cheque"*. Vazio → `null`. |
| Valor pago          | `amount`           | `decimal(12,2)`     | sim         | `> 0`. Máscara de moeda (R$). Default sugerido: o **saldo restante** do título. |
| Observação          | `notes`            | `text` nullable     | não         | `trim`, máx 1000. Vazio → `null`. |

> **Idioma**: colunas em inglês; labels e mensagens em português.

Colunas de infraestrutura (não editáveis): `id`, `company_id` (multitenant),
`payable_id` (FK pai), `created_at`, `updated_at`. **Sem `deleted_at`** — baixa é
**hard delete** (a remoção é justamente o que "estorna" a baixa e devolve o saldo).

## Como o título reage à baixa

`paid_amount` do título **não é incrementado** a cada baixa — é **recalculado do
zero** como a soma das baixas, dentro da mesma transação:

```txt
paid_amount = Σ (payable_settlements.amount  WHERE payable_id = título)
```

- Recalcular a soma (em vez de somar/subtrair o delta) é o que **elimina a
  deriva**: qualquer create/edit/delete leva o `paid_amount` de volta à verdade.
- Feito isso, chama-se o `recomputeStatus()` **que já existe** — nada de novo no
  lado do título:

  ```txt
  aberto   ⟸ paid_amount = 0
  parcial  ⟸ 0 < paid_amount < total     ← estado que esta spec finalmente produz
  pago     ⟸ paid_amount >= total
  ```

- O `total` do título é `amount - discount + fine + interest` (o mesmo do CRUD).
- **Comparação em centavos** (o `PayableService` já faz): `decimal` volta do
  driver como string e reais em ponto-flutuante tornam `paid == total` não
  confiável na fronteira (`0.1 + 0.2 !== 0.3`).

## Comportamento esperado

### Menu "Ações" no grid de contas a pagar (mudança na tela 001)

A coluna de ações do grid (hoje dois ícones soltos: ✏️ Editar / 🗑️ Excluir)
vira **um único menu** (`DropdownMenu`), com o **cabeçalho da coluna = "Ações"**:

| Item        | Gate (`Can`)               | Ação |
| ----------- | -------------------------- | ---- |
| Editar      | `payables.edit`            | Abre o modal de edição do título (comportamento atual). |
| Pagamentos  | `payable_settlements.view` | Abre o **modal de baixas** deste título. |
| Excluir     | `payables.delete`          | `ConfirmDialog` → hard delete (comportamento atual). |

- O gatilho é um botão discreto (kebab `⋮` ou rótulo "Ações"), `variant="ghost"`.
- Cada item é gated individualmente por `Can`; se o usuário não tem **nenhuma**
  das três permissões, a coluna some (como já acontece hoje).
- **Por que `DropdownMenu` e não um `<select>`**: `<select>` é para **escolher um
  valor** de formulário; disparar **ações** é o papel do `DropdownMenu` do design
  system (já existe em `components/ui/dropdown-menu.tsx`). É o "select de ações"
  pedido, no primitivo correto. Ver [brecha 2](#2-select-vs-dropdownmenu).

### Modal de baixas — fluxo feliz

1. No grid, o usuário com `payable_settlements.view` clica em **Ações →
   Pagamentos**.
2. Abre o **modal de baixas** já na **listagem** (é um mini-CRUD). O cabeçalho
   mostra o contexto do título — **número/ordem, cedente, total, pago e saldo** —
   e um `PayableStatusBadge`. Esses dados já vêm na linha do grid; nada extra a
   buscar para o cabeçalho.
3. O corpo lista as baixas do título (mais recente primeiro), com as colunas:

   | Coluna            | Observação |
   | ----------------- | ---------- |
   | Data              | `dd/MM/yyyy` (`formatIsoDate`). |
   | Tipo de pagamento | Nome do tipo (join). Inativo → sufixo `(inativo)`. |
   | Nº documento      | Ou `—`. |
   | Valor             | `R$ 0,00`. |
   | Observação        | Truncada; `—` quando vazia. |
   | Ações             | Editar / Excluir (gated). |

   **Sem filtros e sem paginação** — a lista de baixas de um título é curta
   (pedido do usuário: a tela não tem filtro).
4. Clica **"Nova baixa"** (gate `payable_settlements.create`) → o modal troca para
   o **formulário** (mesma janela, modo formulário; ver
   [brecha 3](#3-formulário-inline-vs-modal-empilhado)) com os campos da tabela
   de [Campos](#campos): **Data = hoje**, **Valor = saldo restante** (editável),
   tipo de pagamento e demais campos.
5. Submete → dentro de **uma transação**: a baixa é gravada, `paid_amount` é
   recalculado, `recomputeStatus()` roda e o título é salvo. O modal volta para a
   listagem, o cabeçalho (saldo/status) atualiza e um toast confirma.
6. O **grid de contas a pagar por baixo também atualiza** (saldo e status),
   porque a mutação invalida a query `['payables', companyId]`.

### Fluxos alternativos

- **Editar baixa** (`payable_settlements.edit`): mesmo formulário preenchido.
  Ao salvar, **mesma validação de saldo** e **mesmo recálculo** do título (regra
  (e) do usuário). Diminuir o valor de uma baixa pode tirar o título de **Pago**
  para **Parcial**; aumentar pode fechá-lo em **Pago**.
- **Excluir baixa** (`payable_settlements.delete`): `ConfirmDialog` → hard delete.
  Dentro da transação, `paid_amount` é recalculado e o status volta atrás
  (regra (c)): remover a última baixa devolve o título a **Aberto**. **Não há
  validação de saldo na exclusão** — remover só reduz o pago.
- **Excluir o título com baixas** (na tela 001): a FK `RESTRICT` barra e o backend
  devolve **409** *"Não é possível excluir este título porque já possui baixas."*
  (regra 5 do usuário — a mensagem **já existe** em `PayableService.destroy`).

### Regras de negócio

- **(a) Saldo não pode estourar**: a soma das baixas **nunca** pode exceder o
  `total` do título. Depois de recalcular `paid_amount` na transação, se
  `paid_amount > total` → **422** *"O valor da baixa excede o saldo do título.
  Saldo disponível: R$ X,XX."* e a transação faz **rollback**. Isso vale para
  create **e** para edit.
- **Baixa exata fecha o título**: quando a soma **iguala** o total, o título fica
  **Pago** (`paid >= total`, com `paid == total`). Não há troco — o create já é
  barrado antes de passar do total.
- **(b) Sem filtros** na tela de baixas (decisão do usuário).
- **(c) Recalcular a cada create/delete**: `paid_amount` e `status` do título são
  sempre recalculados quando uma baixa é criada, editada ou removida.
- **(d) Várias baixas no mesmo dia** são permitidas — **sem** restrição de
  unicidade por data (decisão do usuário).
- **(e) Editar** segue a mesma validação de total e o mesmo recálculo do saldo.
- **Valor**: `> 0`. Zero ou negativo → 422.
- **Tipo de pagamento**: obrigatório; o backend valida que **existe e pertence ao
  tenant** → senão **422** *"Tipo de pagamento inválido."* (não vaza dado de outra
  empresa). Para **nova** baixa, deve estar **ativo**; uma baixa antiga com tipo
  que ficou inativo continua exibindo o tipo com `(inativo)` — ver
  [brecha 4](#4-tipo-de-pagamento-inativo).
- **Título cancelado não recebe baixa** (nem edição de baixa): saldo é 0 e o
  estado é terminal → **422** *"Não é possível baixar um título cancelado."*
- **Multitenant**: a baixa pertence à empresa ativa; o backend valida que o
  `payableId` da rota **pertence ao tenant** antes de qualquer coisa (senão 404
  do título). Ninguém baixa título de outra empresa (exceto ROOT).
- **"Hoje"** é do backend (`todayIso`, fuso `America/Sao_Paulo`), nunca do cliente.
- **Ordenação da lista**: `settlement_date desc` (a baixa mais recente primeiro).
- **Exclusão**: hard delete.

### Integridade e transação

**Toda** operação aqui é multi-tabela (escreve `payable_settlements` **e**
atualiza `payables`), então roda em `db.transaction`:

```txt
db.transaction(trx):
  1. carrega o título com forUpdate() (lock da linha — serializa baixas concorrentes)
     └─ 404 se não existe / não é do tenant; 422 se cancelado
  2. valida o tipo de pagamento (existe, é do tenant, ativo p/ create)
  3. insere / atualiza / remove a baixa (client: trx)
  4. paid_amount = Σ amount das baixas do título  (recálculo do zero, na trx)
  5. se paid_amount > total  → BusinessException 422 → ROLLBACK
  6. recomputeStatus(título); título.save({ client: trx })
COMMIT
```

- **`forUpdate()` no título** evita a corrida em que duas baixas simultâneas
  passam pela verificação de saldo e juntas estouram o total. Concorrência é
  baixa (~15 usuários), mas o lock é barato e fecha o buraco.
- Se qualquer passo lançar, **nada** é persistido — o título nunca fica com
  `paid_amount` divergente das baixas.

## Fora de escopo

- **Baixa automática por tipo de pagamento** (`auto_settlement`): o campo existe
  em `payment_types`, mas esta spec cobre a baixa **manual**. Automatizar (criar
  a baixa cheia ao lançar o título com um tipo `auto_settlement`) depende de o
  título ganhar um campo de tipo de pagamento, que hoje não tem — é feature
  própria. Ver [brecha 5](#5-auto_settlement).
- **Cancelar título** (`status = 'cancelled'`) — é a outra spec anunciada na 001.
  Aqui só se **respeita** o cancelado (não recebe baixa).
- Multa/juros/desconto **no ato da baixa** — os valores do título são os da tela
  001; a baixa não recalcula encargos por atraso.
- Conciliação bancária, comprovante/anexo, estorno com rastro (a remoção é hard
  delete), rateio por centro de custo.
- Contas a **receber** (espelho, virá depois).

## Decisões técnicas

### Backend

- **Migration** `create_payable_settlements_table`:

  ```ts
  table.increments('id').notNullable()

  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('companies').onDelete('RESTRICT')

  table
    .integer('payable_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('payables').onDelete('RESTRICT')

  table
    .integer('payment_type_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('payment_types').onDelete('RESTRICT')

  table.date('settlement_date').notNullable()
  table.decimal('amount', 12, 2).notNullable()
  table.string('document_number', 30).nullable()
  table.text('notes').nullable()

  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()

  table.index(['company_id', 'payable_id'], 'payable_settlements_company_payable_idx')
  ```

  **Sem `deleted_at`** (hard delete). **`payable_id` com `RESTRICT`**: é o que
  faz o 409 da tela 001 acontecer — não se apaga título com baixa.
  **`payment_type_id` com `RESTRICT`**: não se apaga um tipo de pagamento em uso.

- **Catálogo** (`catalog.ts`): módulo `payable_settlements` com `view`, `create`,
  `edit`, `delete`; `name`/`description` em **pt-BR** (vão para o banco/UI). Ex.:
  `name: 'Visualizar baixas'`, `description: 'Consultar as baixas de um título a pagar.'`

- **Rótulo do módulo** (`module-labels.ts`): `payable_settlements: 'Baixas do
  título'` — obrigatório, senão a tela de Permissões mostra o slug cru.

- **Camadas**: model `PayableSettlement` → `payable_settlement_repository` →
  `payable_settlement_service` → `payable_settlements_controller` → rotas
  aninhadas em `/api/payables/:payableId/settlements` com `middleware.tenant()` e
  `middleware.permission(...)` por ação.
  - O **service** reusa `PayableService.recomputeStatus()` e a lógica de
    `total`/centavos — não duplicar. Considere **expor um método no
    `PayableService`** (ex.: `applySettlementsTotal(payable, paidCents, trx)`)
    para manter o título como dono do próprio status; ou o
    `PayableSettlementService` chama `recomputeStatus` diretamente. **Um só ponto
    escreve `status`** — não recriar a regra.
  - O recálculo do `paid_amount` (Σ das baixas) é uma query
    `sum('amount')` filtrada por `payable_id`, dentro da transação.

- **Validator VineJS** (pt-BR):
  - `settlementDate`: data `YYYY-MM-DD`, obrigatória.
  - `paymentTypeId`: inteiro positivo, obrigatório (existência/tenant/ativo no service).
  - `amount`: número `> 0`, 2 casas.
  - `documentNumber`: string `trim`, máx 30, opcional. Vazio → `null`.
  - `notes`: `trim`, máx 1000, opcional. Vazio → `null`.
  - A regra de saldo (`Σ <= total`) é **do service** (depende do estado do título)
    → `BusinessException` (422).

- **Endpoints**:

  | Verbo + rota | Permissão | Efeito |
  | ------------ | --------- | ------ |
  | `GET /api/payables/:payableId/settlements` | `payable_settlements.view` | Lista as baixas do título (`settlement_date desc`, sem paginação), com `paymentTypeName`. |
  | `POST /api/payables/:payableId/settlements` | `payable_settlements.create` | Cria a baixa (transação). |
  | `PUT /api/payables/:payableId/settlements/:id` | `payable_settlements.edit` | Edita (transação). |
  | `DELETE /api/payables/:payableId/settlements/:id` | `payable_settlements.delete` | Remove (transação). |

  - Todas resolvem o título **do tenant** primeiro (404 se não for). O `:id` da
    baixa é validado como **pertencente àquele `payableId`** (senão 404) — não se
    edita a baixa de um título via outro.
  - A resposta de create/edit/delete pode devolver o **título já atualizado**
    (`total`, `paidAmount`, `balance`, `status`) para o front atualizar o
    cabeçalho sem refetch. Alternativa: o front invalida e refaz — ver Frontend.

- **Erro de FK** (`23503`) na exclusão de **tipo de pagamento** que tenha baixa →
  **409** em pt-BR (a tela de tipos de pagamento passa a poder receber esse erro).

- **Seeder**: apenas as 4 permissões novas.

### Frontend

- **Grid (`payables-page.tsx`)**: trocar a célula de ações (dois `Button` icon)
  por um `DropdownMenu` — cabeçalho da coluna **"Ações"**. Itens gated por `Can`:
  Editar (`payables.edit`), Pagamentos (`payable_settlements.view`), Excluir
  (`payables.delete`). Abrir o modal de baixas com a linha (`Payable`) já em mãos.
- **Modal de baixas** `payable-settlements-dialog.tsx`:
  - Cabeçalho: número/ordem, cedente, **total/pago/saldo** e `PayableStatusBadge`.
  - Corpo: `Table` das baixas (reusa `Table`, `EmptyState`, `Skeleton`,
    `ConfirmDialog`, `Can`). **Sem filtro/paginação.**
  - `"Nova baixa"` no rodapé (gate `create`). Editar/Excluir por linha.
  - Alterna entre **modo lista** e **modo formulário** na mesma janela (ver
    [brecha 3](#3-formulário-inline-vs-modal-empilhado)).
- **Formulário** (RHF + Zod): 
  - **Data**: `<input type="date">`, default **hoje**.
  - **Tipo de pagamento**: `Select` dos tipos **ativos** (`paymentTypesApi.list`
    com `isActive` e `perPage` alto — catálogo pequeno, sem EntityPicker).
  - **Nº documento**: `Input` texto, opcional, com helper *"Apenas para cheque"*.
  - **Valor pago**: padrão de **centavos** do projeto (`maskMoney` /
    `reaisToCents` / `centsToReais`, como no `payable-form-dialog`). Default = o
    **saldo restante** do título (facilita a baixa total num clique).
  - **Observação**: `Textarea`, opcional.
- **API client**: `src/services/payable-settlements-api.ts` (list/create/update/
  remove, todos sob `/payables/:payableId/settlements`).
- **Tipo** `PayableSettlement` em `types/api.ts` (com `paymentTypeName`).
- **QueryKey**: `['payable-settlements', companyId, payableId]`.
- **Invalidação**: toda mutação de baixa invalida **`['payable-settlements',
  companyId, payableId]`** (atualiza a lista) **e** `['payables', companyId]`
  (atualiza saldo/status no grid por baixo). Se o backend devolver o título
  atualizado, o cabeçalho do modal usa isso; senão, refetch da lista de payables.
- **Exibição**: valores via `formatCurrency`; datas via `formatIsoDate` (nunca
  `formatDate` — date-only, defeito de fuso). Erros via `getErrorMessage` + toast.

## Critérios de aceite

- [ ] Migration cria `payable_settlements` com as 3 FKs `RESTRICT` e o índice
      `(company_id, payable_id)`; `up`/`down` rodam limpas.
- [ ] Catálogo traz `payable_settlements.view/create/edit/delete`;
      `module-labels.ts` traz `payable_settlements: 'Baixas do título'`.
- [ ] O grid de contas a pagar mostra o menu **"Ações"** com Editar / Pagamentos /
      Excluir, cada um gated; a coluna some se o usuário não tem nenhuma.
- [ ] Endpoints aninhados existem e são gated; cada um resolve o título do tenant
      (404 fora do tenant) e valida a baixa como filha daquele título.
- [ ] Criar baixa recalcula `paid_amount = Σ baixas` e o `status` do título,
      **em transação**.
- [ ] Baixa parcial deixa o título **Parcial**; baixas que somam o total **exato**
      deixam **Pago** com saldo **R$ 0,00**.
- [ ] Baixa que faria a soma **exceder** o total → **422** com o saldo disponível
      na mensagem; nada é persistido (rollback).
- [ ] Duas baixas no **mesmo dia** são aceitas (sem restrição).
- [ ] Editar uma baixa revalida o total e recalcula o saldo: reduzir o valor de
      um título **Pago** o devolve a **Parcial**; aumentar até fechar o total o
      leva a **Pago**.
- [ ] Excluir uma baixa recalcula `paid_amount` e volta o status atrás; remover a
      última baixa devolve o título a **Aberto**.
- [ ] Excluir um **título** que tenha baixa → **409** *"…já possui baixas."*
- [ ] Excluir um **tipo de pagamento** usado em alguma baixa → **409**.
- [ ] Baixar (ou editar baixa de) um título **cancelado** → **422**.
- [ ] `paymentTypeId` de outra empresa → **422** *"Tipo de pagamento inválido."*
- [ ] `amount <= 0` → 422.
- [ ] Tipo de pagamento **inativo** aparece na lista de baixas antigas com
      `(inativo)`; o `Select` de **nova** baixa só oferece os ativos.
- [ ] Após qualquer baixa, o **grid de contas a pagar** reflete o novo saldo e
      status (invalidação de `['payables']`).
- [ ] "Hoje" da data da baixa vem do backend/fuso da aplicação.
- [ ] Multitenant: trocar de empresa não vaza baixas de outra empresa.
- [ ] `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) passam.

## Brechas e considerações

Pontos que a spec **decidiu de um jeito** mas que merecem sua confirmação antes
da implementação.

### 1. "Pagamentos" vs "baixa" (vocabulário) ✅ *decidido*

**Resolvido pelo usuário:** o item do grid se chama **"Pagamentos"**. O título do
modal fica **"Baixas do título 1234/1"** e a entidade/código segue `settlement`.
Os dois termos convivem: "Pagamentos" na ação, "baixa" na operação.

### 2. `<select>` vs `DropdownMenu`

Você chamou de "select" o campo de ações. Um `<select>` de verdade serve para
**escolher um valor**, não para disparar ações (e teria problemas de acessibilidade
e de gating por permissão). A spec usa o **`DropdownMenu`** do design system, que
é o "menu de ações" que você descreveu, no primitivo certo. Se você quis
literalmente um `<select>`, me diga — mas recomendo o `DropdownMenu`.

### 3. Formulário inline vs modal empilhado

A tela de baixa "abre na listagem, com botão para nova baixa". Para o
create/edit, há duas formas: (a) **trocar o conteúdo do mesmo modal** entre lista
e formulário (sem empilhar janelas) — **recomendado**, mais simples; ou (b) abrir
um **segundo modal** por cima. A spec assume (a). Diga se prefere o modal
empilhado.

### 4. Tipo de pagamento inativo

Para **nova** baixa, a spec só oferece tipos **ativos**. Uma baixa **antiga** cujo
tipo virou inativo continua exibindo o tipo com `(inativo)` na lista, e a
**edição** dessa baixa mantém o tipo inativo se ele não for trocado. Se a regra
for outra (ex.: bloquear editar baixa com tipo inativo), me avise.

### 5. `auto_settlement` ✅ *decidido — fora do escopo*

**Resolvido pelo usuário:** este processo é de **baixa manual** (com interação
humana). O campo *"realiza baixa automática de título"* de `payment_types` **não**
é acionado aqui — a baixa automática é feature própria e futura. Esta spec cobre
apenas a baixa manual.

### 6. Devolver o título atualizado na resposta da baixa

Para o cabeçalho do modal (saldo/status) atualizar sem um segundo request, o
backend pode **devolver o título recalculado** no corpo da resposta de
create/edit/delete. A spec sugere isso, com o front invalidando `['payables']`
como fallback. É uma otimização; se preferir só invalidar e refetchar, também
funciona.
