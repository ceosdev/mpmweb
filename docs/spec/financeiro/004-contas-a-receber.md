# Spec: Contas a receber (título, baixa, cancelamento, recebimento em lote)

> **Espelho do módulo de [contas a pagar](001-criar-tela-contas-a-pagar.md)** —
> mesma arquitetura, mesmas regras, mesmas telas. A **única** diferença de
> domínio: onde contas a pagar aponta para um **fornecedor** (`supplier_id`,
> "cedente"), contas a receber aponta para um **cliente** (`customer_id`).
>
> Consolida numa só spec o que na pagar veio em quatro (001 tela, 002 baixa,
> cancelamento e 003 recebimento em lote), porque aqui é reimplementação do mesmo
> desenho já validado — não há decisão nova a tomar, só a troca do vínculo e do
> vocabulário de tela (*pagar → receber*, *Pago → Recebido*).

## Problema

A empresa lança o que tem **a receber** de seus clientes (vendas, serviços,
mensalidades) e precisa acompanhar o recebimento: quando caiu, por qual meio,
quanto, e com qual documento. É o espelho de contas a pagar, do outro lado do
caixa.

## Solução proposta

Replicar contas a pagar por inteiro, trocando fornecedor por cliente:

- **Título a receber** (`receivable`) — cliente (via EntityPicker), número,
  ordem/parcela, emissão/vencimento, valor + desconto + multa + juros,
  observação. `status` é **resultado** (`open`/`partially_paid`/`paid`/
  `cancelled`), derivado de `paid_amount` — nunca escolha.
- **Baixa** (`receivable_settlement`) — o recebimento (total ou parcial) de um
  título; move `paid_amount` e leva o título de *Aberto* → *Recebido parcial* →
  *Recebido*. Aberta pelo menu **Ações → Recebimentos**.
- **Cancelar título** — exclui todas as baixas e marca `cancelled` (terminal).
- **Recebimento em lote** — modo de seleção no grid: baixa vários títulos que
  ainda devem, com a mesma forma de pagamento, na data de hoje, cada um pelo
  saldo restante.
- **Visualizar** — abre o mesmo modal do formulário em modo somente-leitura.
- **Editar / Excluir** — idênticos à pagar.

## Domínio

| Contas a pagar | Contas a receber |
| --- | --- |
| `payables` / `Payable` | `receivables` / `Receivable` |
| `payable_settlements` / `PayableSettlement` | `receivable_settlements` / `ReceivableSettlement` |
| FK `supplier_id` → `suppliers` (cedente) | FK `customer_id` → `customers` (cliente) |
| `supplierName` no payload | `customerName` no payload |
| slugs `payables.*`, `payable_settlements.*` | slugs `receivables.*`, `receivable_settlements.*` |
| rota `/payables`, `/api/payables` | rota `/receivables`, `/api/receivables` |
| menu "Contas a pagar" | menu "Contas a receber" |

- **Nome do cliente** exibido: `trade_name` (nome fantasia) quando houver, senão
  `legal_name` — o cliente pode ser PF (só `legal_name`) ou PJ (com fantasia).
- Todo o resto (campos, tipos, índices, transações, comparação em centavos,
  "vencido" virtual no fuso da aplicação, hard delete, multitenant) é **idêntico**
  a contas a pagar. Ver as specs 001/002/003 para o detalhamento de cada regra —
  esta spec não as repete, apenas afirma a paridade.

## Específicos

- **Tabelas**: `receivables`, `receivable_settlements`.
- **Migrations**: espelham as de payables; `customer_id` no lugar de
  `supplier_id` (FK `customers`, `RESTRICT`); índices `(company_id, due_date)`,
  `(company_id, status)`, `(company_id, customer_id)`; settlements com índice
  `(company_id, receivable_id)` e as 3 FKs `RESTRICT`.
- **Endpoints** (gate por permissão, mesma pipeline `auth + tenant + permission`):

  | Verbo + rota | Permissão |
  | --- | --- |
  | `GET /api/receivables` | `receivables.view` |
  | `POST /api/receivables` | `receivables.create` |
  | `POST /api/receivables/batch-settlements` *(antes de `/:id`)* | `receivable_settlements.batch` |
  | `GET /api/receivables/:id` | `receivables.view` |
  | `PUT /api/receivables/:id` | `receivables.edit` |
  | `DELETE /api/receivables/:id` | `receivables.delete` |
  | `POST /api/receivables/:id/cancel` | `receivables.cancel` |
  | `GET /api/receivables/:receivableId/settlements` | `receivable_settlements.view` |
  | `POST /api/receivables/:receivableId/settlements` | `receivable_settlements.create` |
  | `PUT /api/receivables/:receivableId/settlements/:id` | `receivable_settlements.edit` |
  | `DELETE /api/receivables/:receivableId/settlements/:id` | `receivable_settlements.delete` |

- **Catálogo** (`catalog.ts`) — 10 permissões novas, `name`/`description` em
  pt-BR:
  - `receivables.view/create/edit/delete/cancel`
  - `receivable_settlements.view/create/edit/delete/batch`
- **Rótulos** (`module-labels.ts`): `receivables: 'Contas a receber'`,
  `receivable_settlements: 'Baixas do título'`.
- **Menu**: grupo **Financeiro** → *"Contas a receber"* (`/receivables`, ícone
  `HandCoins`, gate `receivables.view`).
- **Módulo frontend**: `src/modules/receivables/` (espelha `payables/`):
  `receivables-page.tsx`, `receivable-form-dialog.tsx`,
  `receivable-settlements-dialog.tsx`, `batch-receipt-dialog.tsx`,
  `receivable-status-badge.tsx`.

## Vocabulário de tela (pt-BR)

Código em inglês idêntico ao de pagar; só os textos visíveis mudam de "pagar"
para "receber":

| Contas a pagar (UI) | Contas a receber (UI) |
| --- | --- |
| Cedente | **Cliente** |
| Status *Pago* / *Pago parcial* | *Recebido* / *Recebido parcial* |
| Ação "Pagamentos" | **"Recebimentos"** |
| "Pagamento em lote" / "Pagar N em lote" | **"Recebimento em lote"** / **"Receber N em lote"** |
| Aviso do lote: "…irá pagar todos os títulos…" | "…irá **receber** todos os títulos selecionados com a mesma forma de pagamento e na data de hoje. Deseja continuar?" |
| "título pago" / "títulos pagos em lote" | "título recebido" / "títulos recebidos em lote" |

O termo **"baixa"** (do título) é neutro e permanece — vale para os dois lados.
Os slugs de status no código continuam `open/partially_paid/paid/cancelled`; só o
**rótulo** de `paid`/`partially_paid` muda para *Recebido*/*Recebido parcial* no
`ReceivableStatusBadge`.

## Regras (idênticas a contas a pagar)

- `status`/`paid_amount` são resultado; `ReceivableService.recomputeStatus()` é o
  **único** ponto que deriva o status (exceto `cancelled`, terminal).
- Baixa: soma nunca excede o total; recálculo do zero a cada create/edit/delete;
  toda escrita transacional com `forUpdate()` no título; título cancelado não
  recebe baixa; excluir título com baixa → **409**.
- Recebimento em lote: **atômico** (tudo ou nada) numa transação; elegíveis =
  `open`/`partially_paid`; baixa cada um pelo **saldo restante**; forma de
  pagamento única, ativa, do tenant; data = hoje (backend); cliente envia só
  `receivableIds` + `paymentTypeId`. Desliga ao paginar (com aviso se há
  seleção), pesquisar, ordenar, limpar filtros ou trocar de empresa.
- Cancelar: exclui as baixas, zera `paid_amount`, seta `cancelled` (transação,
  `forUpdate`).
- Visualizar: reusa `ReceivableFormDialog` com `readOnly` (todos os campos
  desabilitados, rodapé só "Fechar").
- Filtros: número (contém), cliente (EntityPicker `source="customer"`), 2
  intervalos de data (vencimento marcado por default = mês corrente; emissão
  desmarcado), status múltipla escolha (inclui *Vencido* virtual). Ordenação por
  `total` usa a mesma expressão que exibe. Paginação 20/pág.
- Multitenant, hard delete, datas date-only (`formatIsoDate`), "hoje" do backend
  (`todayIso`, fuso da aplicação).

## Critérios de aceite

- [ ] Migrations criam `receivables` e `receivable_settlements` espelhando
      payables, com `customer_id` (FK `customers`, `RESTRICT`) e os índices;
      `up`/`down` limpas.
- [ ] Catálogo traz `receivables.*` (5) e `receivable_settlements.*` (5);
      `module-labels.ts` traz os dois rótulos; seed roda.
- [ ] Menu **Financeiro → Contas a receber** aparece com `receivables.view`.
- [ ] CRUD do título funciona (criar/editar/excluir/visualizar), com cliente via
      EntityPicker e status derivado.
- [ ] Baixa (Recebimentos) cria/edita/exclui, recalcula `paid_amount`/status em
      transação; soma não excede o total (422 com saldo); título cancelado não
      recebe baixa; excluir título com baixa → 409.
- [ ] Cancelar título exclui baixas, zera pago, marca `cancelled`.
- [ ] Recebimento em lote baixa os selecionados (Aberto/Parcial) pelo saldo, na
      data de hoje, mesma forma de pagamento, atômico; nomeia o título e faz
      rollback se algum deixou de ser elegível.
- [ ] Status *Recebido*/*Recebido parcial* nos rótulos; "Cliente" no lugar de
      "Cedente".
- [ ] Multitenant: não vaza dado de outra empresa (cliente de outro tenant → 422
      *"Cliente inválido."*).
- [ ] `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) passam.

## Fora de escopo

- Baixa automática por tipo de pagamento (`auto_settlement`) — manual, como na
  pagar.
- Conciliação bancária, comprovante/anexo, rateio por centro de custo.
- Escolher a data do recebimento em lote (sempre hoje) e valor parcial em lote
  (sempre o saldo restante).
