# Spec: Pagamento em lote de títulos a pagar

> **Continuação direta da [baixa de título](002-baixa-de-titulo.md).**
> A baixa individual já deixou tudo pronto: `PayableService.applySettlement()`
> (validação de saldo + recálculo de status em centavos), o
> `PayableSettlementService` transacional com `forUpdate()` no título, e o
> catálogo `payable_settlements.*`. Esta spec **não cria entidade nova** — ela
> aplica a **mesma baixa**, para **vários títulos de uma vez**, dentro de **uma
> única transação**. Acrescenta **uma permissão** (`payable_settlements.batch`)
> e **nenhuma tabela**.
>
> **Não é uma tela nova.** É um **modo** da tela de [contas a pagar](001-criar-tela-contas-a-pagar.md):
> um botão que liga a multisseleção do grid, e um modal enxuto que escolhe a
> forma de pagamento e dispara a baixa em lote.

## Problema

Hoje, para dar baixa em 15 títulos abertos, o usuário abre o menu **Ações →
Pagamentos** de cada linha, clica em **Nova baixa**, confirma o valor e salva —
15 vezes. Quando vários títulos são pagos juntos (mesma forma de pagamento, no
mesmo dia, cada um pelo valor cheio), esse trabalho repetitivo é puro atrito.

## Solução proposta

Um **modo pagamento em lote** na tela de contas a pagar:

1. Um botão **"Pagamento em lote"** liga a **multisseleção** do grid. Só os
   títulos que **ainda devem** (Abertos **ou** Parcialmente pagos) ficam
   selecionáveis (com feedback visual). O botão fica **desabilitado** se a página
   atual não tem nenhum título que ainda deve.
2. Ao selecionar títulos, surge um botão **"Pagar N em lote"**. Ele abre um
   **modal** com um `Select` de **forma de pagamento** e, em destaque, o aviso:
   > *"Atenção: esta opção irá pagar todos os títulos selecionados com a mesma
   > forma de pagamento e na data de hoje. Deseja continuar?"*
3. Confirmando, o backend cria, **numa única transação**, uma **baixa por
   título** — mesma forma de pagamento, **data = hoje**, cada uma **pelo saldo
   restante** do título. Todos os selecionados ficam **Pagos**.
4. O lote opera **apenas sobre a página atual do filtro**. Trocar de página
   **avisa** o usuário e **desliga** o modo lote (item 4 do usuário).
5. O modo lote pode ser **cancelado** a qualquer momento, com feedback visual
   claro de que está ativo.

**Reúso, não reinvenção:** cada baixa do lote passa pelo **mesmo**
`applySettlement()` e gera a **mesma** linha em `payable_settlements` da spec
002. A diferença é só o **empacotamento**: N baixas numa transação, disparadas
por uma tela em modo de seleção.

## Escopo do que muda

- **Backend**: 1 endpoint novo (`POST /api/payables/batch-settlements`), 1
  validator, 1 método de service transacional, **1 permissão nova**
  (`payable_settlements.batch`) no `catalog.ts` + seed. **Sem migration** (a
  tabela `payable_settlements` já existe).
- **Frontend**: modo de seleção no grid de `payables-page.tsx` + modal novo
  (`batch-payment-dialog.tsx`) + 1 método no `payables-api.ts`. **Sem
  `module-labels` novo** — o módulo `payable_settlements` já tem rótulo
  (*"Baixas do título"*); só entra uma ação a mais.

## Domínio e regras

- **O que é pago em cada título**: o **saldo restante** (`balance = total −
  paid_amount`). Para um título **Aberto** o saldo é o total; para um
  **Parcialmente pago** é o que ainda falta. Uma baixa por título, no valor do
  saldo → o título fecha em **Pago** (saldo R$ 0,00).
- **Elegíveis**: títulos que **ainda devem** — `status ∈ {open, partially_paid}`
  (os `OWING_STATUSES` que o backend já define). **Pago** e **Cancelado** não
  entram (saldo 0 / estado terminal). O backend **reforça**: se algum id enviado
  não estiver nesses status, o lote inteiro falha (ver
  [Atomicidade](#atomicidade)).
- **Forma de pagamento**: **uma só** para todo o lote. Deve **existir, pertencer
  ao tenant e estar ativa** — mesma regra (e mesma mensagem *"Tipo de pagamento
  inválido."*) da baixa individual.
- **Data da baixa**: **hoje**, resolvido no **backend** (`todayIso`, fuso da
  aplicação) — nunca do cliente, como em toda a spec 002.
- **Sem nº de documento e sem observação** no lote: o modal só tem a forma de
  pagamento (o campo "apenas para cheque" não faz sentido em massa). As baixas
  nascem com `document_number = null` e `notes = null`.
- <a id="atomicidade"></a>**Atomicidade — tudo ou nada**: o lote roda numa
  **única transação**. Se **qualquer** título falhar (não é do tenant, deixou de
  ser elegível, forma de pagamento inválida), **nada** é persistido — rollback
  total, com mensagem identificando o problema.
- **Concorrência**: cada título é travado com `forUpdate()` (ordem crescente de
  id, para não dar deadlock). Se, entre carregar a tela e confirmar o lote,
  outra pessoa pagou/cancelou um dos títulos, o lock relê o estado atual e a
  transação falha limpa. Concorrência é baixa (~15 usuários), mas o lock fecha o
  buraco de sobre-baixa, como já faz a baixa individual.
- **`auto_settlement` fora**: é baixa **manual** em massa; o campo de baixa
  automática de `payment_types` não é acionado aqui (mesma decisão da 002).
- **Multitenant**: todo id é resolvido **dentro da empresa ativa**; ninguém
  baixa título de outra empresa (exceto ROOT).

## Comportamento na tela (contas a pagar)

### Modo pagamento em lote

Um botão **"Pagamento em lote"** (ícone `ListChecks`, `variant="outline"`) entra
na barra de ações do cabeçalho, gated por `payable_settlements.batch`:

- **Desabilitado** quando a página atual **não tem nenhum título que ainda deve**
  (Aberto ou Parcial) — com `title`/tooltip explicando.
- **Ligado** → o grid entra em **modo seleção**:
  - Surge uma **coluna de checkbox** à esquerda. Só as linhas que **ainda devem**
    (Aberto/Parcial) têm checkbox habilitado; as demais ficam sem checkbox (ou
    desabilitado esmaecido).
  - O cabeçalho da coluna tem um **checkbox "selecionar todos"** que marca/desmarca
    **todos os elegíveis da página** (não afeta outras páginas).
  - **Feedback visual**: linha selecionada recebe destaque (`bg-primary/5` +
    borda/acento por token, nunca cor fixa). O botão "Pagamento em lote" passa a
    indicar o estado ativo (vira **"Sair do modo lote"**, `variant="secondary"`),
    deixando claro que dá para **cancelar** o modo.
  - O menu **"Ações"** por linha fica **oculto/desabilitado** enquanto o modo lote
    está ativo (o foco é selecionar, não agir linha a linha).
- **Cancelar o modo** ("Sair do modo lote"): limpa a seleção, remove a coluna de
  checkbox e volta o grid ao normal.

### Barra de seleção + botão "Pagar em lote"

Quando há **≥ 1 título selecionado**, aparece um **botão de ação**
**"Pagar N título(s) em lote"** (`N` = quantidade selecionada; ícone `Wallet`).
Pode ficar numa faixa acima/abaixo do grid ou na barra de ações — mostrando a
contagem viva. Clicar abre o **modal de pagamento em lote**.

### Modal de pagamento em lote (`batch-payment-dialog.tsx`)

- **Título**: "Pagar títulos em lote".
- Um `Select` de **forma de pagamento** — só os tipos **ativos** da empresa
  (mesma fonte do form de baixa: `paymentTypesApi.list` com `perPage` alto,
  filtrando `isActive`).
- **Destaque** (bloco `bg-warning/10` ou `Alert`): o aviso do item 2 do usuário,
  **exatamente**:
  > *Atenção: esta opção irá pagar todos os títulos selecionados com a mesma
  > forma de pagamento e na data de hoje. Deseja continuar?*
- Resumo curto: **N títulos** e o **total a pagar** (soma dos **saldos restantes**
  selecionados, `formatCurrency`) — para o usuário conferir antes de confirmar.
- Botões: **Cancelar** e **"Sim, pagar em lote"** (desabilitado enquanto não há
  forma de pagamento escolhida; `Loader2` enquanto envia).
- Confirmar → `POST /api/payables/batch-settlements` com
  `{ payableIds, paymentTypeId }`. Sucesso → toast *"N títulos pagos em lote."*,
  fecha o modal, **sai do modo lote**, limpa a seleção e **invalida**
  `['payables']` + `['payable-settlements']`.

### Interação com paginação, busca e ordenação (item 4)

O lote é **escopado à página/consulta atual**. Ações que **trocam o conjunto de
linhas** encerram o modo lote:

- **Trocar de página** com **seleção ativa** → `ConfirmDialog`:
  *"O pagamento em lote funciona apenas na página atual. Mudar de página vai
  desativar o modo lote e limpar a seleção. Deseja continuar?"* — confirmando,
  desliga o modo, limpa a seleção e navega. **Sem** seleção, muda de página
  direto e desliga o modo (com um toast leve), sem incomodar com diálogo
  (ver [brecha 5](#5-confirmar-só-quando-há-seleção)).
- **Pesquisar, ordenar, limpar filtros, trocar de empresa** → desligam o modo
  lote e limpam a seleção (silenciosamente, com toast), porque **substituem as
  linhas visíveis** e a seleção deixaria de corresponder ao que está na tela
  (ver [brecha 4](#4-o-que-mais-desliga-o-modo-lote)).

> **Nota**: escolher quantas linhas por página é **feature futura** (dito pelo
> usuário). Por ora, `PER_PAGE = 20` — o lote cobre no máximo 20 títulos.

## Backend

### Catálogo (`catalog.ts`) + seed

Uma ação nova no módulo **existente** `payable_settlements`:

```ts
{ slug: 'payable_settlements.batch', name: 'Pagar em lote', module: 'payable_settlements',
  action: 'batch', description: 'Pagar vários títulos de uma vez, com a mesma forma de pagamento.' }
```

Rodar o seed (idempotente). **Não** precisa de `module-labels` novo — o rótulo
*"Baixas do título"* do módulo já existe.

### Endpoint

| Verbo + rota | Permissão | Efeito |
| ------------ | --------- | ------ |
| `POST /api/payables/batch-settlements` | `payable_settlements.batch` | Cria uma baixa por título selecionado, na mesma transação. |

- **Ordem de registro importa**: registrar **antes** de `/payables/:id/*` e de
  `/payables/:payableId/settlements`, senão o router casaria `batch-settlements`
  como `:id`/`:payableId` — o mesmo cuidado das rotas `lookup` (ver `state.md`).
- **Corpo**: `{ payableIds: number[], paymentTypeId: number }`. O cliente **não
  envia valores nem datas** — o backend deriva `amount = saldo` de cada título e
  `settlement_date = hoje`. Não há como o cliente forjar o valor da baixa.

### Validator (`batchPayableSettlementValidator`, VineJS, pt-BR)

- `payableIds`: array de inteiros positivos, **mín. 1**, **únicos** (dedupe).
  Vazio → 422 *"Selecione ao menos um título."*
- `paymentTypeId`: inteiro positivo obrigatório (existência/tenant/ativo ficam no
  service, como na baixa individual).

### Service — `PayableSettlementService.batchCreate(tenant, payableIds, paymentTypeId)`

Reusa **tudo** da baixa individual — só muda o laço e a transação única:

```txt
db.transaction(trx):
  1. assertPaymentType(tenant, paymentTypeId)      // existe + tenant + ATIVO
  2. para cada id (ordenado asc, para lock determinístico):
       a. lockPayable(tenant, id, trx)             // forUpdate; 404 se não é do tenant
       b. se status ∉ {open, partially_paid} → BusinessException 422
          "O título {documentNumber}/{installment} não pode ser pago em lote."
                                                     // identifica o título → rollback
       c. paid    = sumSettlements(tenant, id, trx) // baixas já existentes (0 se Aberto)
          balance = total(payable) − paid           // saldo restante, em centavos
          se balance <= 0 → 422 (guarda de borda; um saldo 0 já seria 'paid')
       d. applySettlement(payable, paid, balance)   // othersPaid = paid; fecha em total
       e. PayableSettlement.create({ ..., settlementDate: hoje,
             paymentTypeId, amount: balance, documentNumber: null, notes: null }, {trx})
       f. payable.save({ client: trx })             // status → 'paid'
  3. retorna { settledCount, totalPaid }
COMMIT
```

- **Qualquer** passo que lançar aborta a transação inteira — **rollback total**
  (tudo ou nada). Nenhum título fica meio-pago.
- **`hoje`** vem de `todayIso()` (fuso da aplicação), uma vez, aplicado a todas.
- **Não duplicar regra de status**: continua sendo `recomputeStatus()` (via
  `applySettlement`) o único dono do status; aqui só o chamamos em laço.
- **Parcial baixa o saldo restante**: `othersPaid = sumSettlements` (o que já foi
  pago) e `thisAmount = balance` → soma fecha exatamente o total, e o título vira
  **Pago**. Para um Aberto, `sumSettlements = 0` e `balance = total` (mesmo
  resultado). O valor é **derivado do título travado**, nunca do cliente.

### Controller

Fino, no `PayableSettlementsController` (ou no `PayablesController` — decisão de
organização): valida com o `batchPayableSettlementValidator`, chama
`payableSettlementService.batchCreate(...)`, devolve `{ settledCount, totalPaid }`.

## Frontend

- **`payables-api.ts`**: método
  `batchSettle(payableIds: number[], paymentTypeId: number)` →
  `POST /payables/batch-settlements`.
- **`payables-page.tsx`** — novo estado local:
  - `batchMode: boolean`, `selectedIds: Set<number>`.
  - Coluna de checkbox condicional a `batchMode`; header "selecionar todos os
    elegíveis da página".
  - **Elegibilidade da linha**: `status === 'open' || status === 'partially_paid'`
    (equivalente a `balance > 0`). Um helper `isOwing(row)` centraliza a regra.
  - Botão "Pagamento em lote" gated por `payable_settlements.batch`, desabilitado
    se `!rows.some(isOwing)`.
  - Highlight das linhas selecionadas por **token** (nunca cor fixa).
  - Reset de `batchMode`/`selectedIds` em: sucesso do lote, sair do modo, trocar
    de página (com o confirm descrito), pesquisar, ordenar, limpar filtros e
    `useEffect` na mudança de `companyId`.
- **`batch-payment-dialog.tsx`** — modal com o `Select` de forma de pagamento, o
  aviso em destaque, o resumo (N títulos + total) e a mutação. Invalida
  `['payables']` e `['payable-settlements']` no sucesso.
- **Exibição**: valores com `formatCurrency`; erros via `getErrorMessage` + toast
  (a mensagem de título-não-aberto do backend aparece direto ao usuário).

## Fora de escopo

- **Valor parcial em lote** (baixar cada título por um valor **menor** que o
  saldo): o lote sempre quita o **saldo restante** inteiro. Baixa parcial de
  valor escolhido continua sendo a individual.
- **Formas de pagamento diferentes por título** no mesmo lote: é sempre **uma**.
- **Escolher a data** da baixa em lote: é sempre **hoje**.
- **Escolher linhas por página** / selecionar entre páginas: feature futura
  declarada pelo usuário. O lote é só da página atual.
- **Baixa automática** (`auto_settlement`), conciliação, comprovante/anexo,
  contas a receber — como na spec 002.

## Critérios de aceite

- [ ] Catálogo traz `payable_settlements.batch` (*"Pagar em lote"*); seed roda.
- [ ] Botão **"Pagamento em lote"** aparece gated por `payable_settlements.batch`
      e fica **desabilitado** quando a página não tem título que ainda deve.
- [ ] Ligado o modo, só linhas **Abertas/Parciais** são selecionáveis; seleção tem
      **feedback visual** por token; há **"selecionar todos"** da página.
- [ ] O modo lote pode ser **cancelado** (botão vira "Sair do modo lote"), com
      feedback visual claro do estado ativo.
- [ ] Com ≥ 1 selecionado surge **"Pagar N em lote"**; o modal traz o `Select` de
      forma de pagamento e o **aviso em destaque** com o texto exato do usuário.
- [ ] Confirmar cria **uma baixa por título**, **mesma forma de pagamento**,
      **data = hoje**, cada uma pelo **saldo restante** → todos ficam **Pagos**,
      tudo numa **única transação**.
- [ ] Um título **Parcial** no lote fecha em **Pago** baixando só o que faltava
      (não re-baixa o total).
- [ ] Se **qualquer** título selecionado não for elegível no momento do submit
      → **422** nomeando o título e **rollback total** (nenhuma baixa gravada).
- [ ] Forma de pagamento inativa/de outro tenant → **422** *"Tipo de pagamento
      inválido."*; lista vazia de ids → **422**.
- [ ] `settlement_date` das baixas do lote = **hoje** do backend (fuso da app).
- [ ] Trocar de página **com seleção** avisa e, confirmando, **desliga** o modo e
      limpa a seleção; pesquisar/ordenar/limpar filtros/trocar de empresa também
      desligam o modo.
- [ ] Após o lote, o **grid** reflete os novos status/saldos (invalidação de
      `['payables']` e `['payable-settlements']`) e o modo lote sai.
- [ ] Multitenant: nenhum id de outra empresa é pago (404 dentro da transação).
- [ ] `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) passam.

## Brechas e considerações

Pontos que a spec **decidiu de um jeito** mas que merecem sua confirmação.

### 1. Permissão: reusar vs nova ✅ *decidido*

**Resolvido pelo usuário:** permissão **dedicada** `payable_settlements.batch`
(*"Pagar em lote"*) — o admin pode liberar a baixa individual e **não** a em
massa. Entra no `catalog.ts` (ação `batch` do módulo existente) + seed.

### 2. Elegíveis: Abertos + Parciais ✅ *decidido*

**Resolvido pelo usuário:** o lote aceita **Abertos e Parcialmente pagos** — todo
título que ainda deve. Cada um é baixado pelo **saldo restante** (`balance`), não
pelo total; ambos fecham em **Pago**. Pago/Cancelado continuam de fora.

### 3. Atomicidade: tudo ou nada ✅ *decidido*

**Resolvido pelo usuário:** o lote é **atômico** — se qualquer título deixou de
ser elegível no momento do submit, **nada** é pago e a mensagem nomeia o título.
Rollback total, previsível (pagou todos ou nenhum).

### 4. O que mais desliga o modo lote

Você citou **paginação**. A spec estende para **pesquisar, ordenar, limpar
filtros e trocar de empresa** — todas trocam as linhas visíveis, e a seleção
(por id) deixaria de bater com a tela. Recomendo desligar o modo nesses casos
também (silenciosamente). Se quiser preservar a seleção ao **ordenar** (mesmos
ids, só reordenados), dá para abrir exceção — me avise.

### 5. Confirmar só quando há seleção

Ao trocar de página, a spec só mostra o `ConfirmDialog` se **houver** títulos
selecionados (senão, muda de página e sai do modo sem diálogo, para não
incomodar). Se você quiser o aviso **sempre** que o modo estiver ligado (mesmo
sem seleção), é um ajuste de uma linha.

### 6. Onde mora o método no backend

`batchCreate` cabe no `PayableSettlementService` (é quem já sabe criar baixa e
recalcular título) e o endpoint pode ficar no `PayableSettlementsController` ou
no `PayablesController` (a rota é de nível `/payables`, não aninhada). Recomendo
o método no `PayableSettlementService` e a rota registrada junto às de
`/payables`, **antes** de `/:id`. É organização interna, sem efeito no contrato.
