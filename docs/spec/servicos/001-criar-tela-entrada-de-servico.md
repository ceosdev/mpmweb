# Spec: Entrada de Serviço

> **Primeira tela do módulo Serviços** (grupo de menu novo, depois de Financeiro)
> e **a primeira do sistema que escreve em outro módulo**: ao ser finalizada, ela
> gera os títulos em [contas a pagar](../financeiro/001-criar-tela-contas-a-pagar.md),
> já parcelados e — quando o tipo de pagamento pedir — já baixados.
>
> Até aqui o financeiro só recebia lançamento manual. Esta spec inverte isso: a
> nota fiscal de serviço vira a **origem** do título. Por isso `payables` ganha
> uma coluna de origem (`service_entry_id`), preparada para conviver com o
> *lançamento direto financeiro* que virá depois.

## Problema

Quando a empresa contrata um serviço, recebe uma nota fiscal (NFSE, recibo, …)
com serviços discriminados, impostos possivelmente retidos e uma condição de
pagamento. Hoje não há onde registrar essa nota: o usuário precisa abrir contas a
pagar e digitar cada parcela à mão, calculando de cabeça o desconto, as retenções
e o rateio. Nada liga o título de volta à nota que o originou.

## Solução proposta

Criar a **entrada de serviço** — o documento fiscal de entrada — com seus
serviços, seus impostos e sua condição de pagamento. A entrada nasce **aberta**
(só documento, sem efeito financeiro) e, ao ser **finalizada**, gera os títulos a
pagar correspondentes.

- Um cabeçalho (`service_entries`) com N serviços (`service_entry_items`).
- Três status: **aberta → finalizada**, e **cancelada** por ação explícita.
- **Finalizar** calcula o valor líquido da nota, divide nas parcelas e cria os
  títulos, tudo em **uma transação**.
- **Cancelar** cancela a entrada **e** todos os títulos que ela gerou.
- 6 permissões: `service_entries.view/create/edit/delete/finalize/cancel`.

## Domínio

- **Entidade**: entrada de serviço (`service_entry`) — a nota fiscal de serviço
  recebida de um fornecedor.
- **Filhos**: itens (`service_entry_item`) — os serviços descritos na nota.
  Não têm tela nem permissão própria; vivem dentro do formulário do pai.
- **Gera**: títulos a pagar (`payable`), um por parcela.
- **Exemplo**: NFSE 242424, série 41, do fornecedor ADERICO, emitida em 16/08,
  com um serviço "Instalação de câmeras" de R$ 9.000,00, retenção pelo
  destinatário (ISS/PIS/COFINS/INSS/IRRF/CSLL de R$ 5,00 cada), pagamento em
  cartão, 4 parcelas, 1º vencimento em 05/09. Finalizada, gera 4 títulos de
  R$ 2.242,50 vencendo em 05/09, 05/10, 05/11 e 05/12.
- **Justificativa de negócio**: sem a entrada, o contas a pagar não tem lastro
  documental e a conta de retenção é feita à mão, com erro garantido.

## Específicos do módulo

- **Tabelas**: `service_entries`, `service_entry_items` (+ coluna nova em `payables`)
- **Slug do módulo**: `service_entries`
- **Endpoints**: `/api/service-entries`
- **Rotas de página**: `/service-entries`, `/service-entries/new`,
  `/service-entries/:id/edit`, `/service-entries/:id` (visualizar)
- **Módulo frontend**: `src/modules/service-entries/`
- **Grupo de menu novo**: **Serviços**, ícone `Briefcase`, **depois de Financeiro**
- **Item de menu**: "Entrada de serviço", ícone `FileInput`
- **Rótulo do módulo** (`module-labels.ts`): `service_entries: 'Entradas de serviço'`

## Campos

### Cabeçalho — `service_entries`

| Campo (UI, pt-BR)        | Coluna (DB, en)     | Tipo                        | Obrigatório | Observações |
| ------------------------ | ------------------- | --------------------------- | ----------- | ----------- |
| Tipo de documento        | `document_type_id`  | FK `document_types`         | **sim**     | `Select` dos tipos **ativos** da empresa. |
| Número do documento      | `document_number`   | `varchar(20)`               | **sim**     | String, não número — preserva zeros à esquerda (mesma decisão de `payables`). |
| Série                    | `series`            | `varchar(10)` nullable      | não         | `trim`. Vazio → `null`. |
| Sub-série                | `sub_series`        | `varchar(10)` nullable      | não         | `trim`. Vazio → `null`. |
| Data de emissão          | `issue_date`        | `date`                      | **sim**     | Data do documento. Default: hoje. |
| Data da operação         | `operation_date`    | `date`                      | automático  | Data do **lançamento no sistema**. Gravada com `todayIso()` no create; **não editável**. Ver [brecha 1](#1-data-da-operação-não-editável). |
| Fornecedor               | `supplier_id`       | FK `suppliers`              | **sim**     | `EntityPicker` `source="supplier"`. |
| Valor de desconto da NFe | `discount`          | `decimal(12,2)` default 0   | não         | Desconto **geral da nota**, distinto do desconto por serviço. Máscara BRL. |
| Retenção do imposto      | `tax_withholding`   | `varchar(20)` default `issuer` | sim      | `issuer` (emissor) \| `recipient` (destinatário). `RadioGroup`. |
| ISS                      | `iss`               | `decimal(12,2)` default 0   | não         | Só editável quando `recipient`. Máscara BRL. |
| PIS                      | `pis`               | `decimal(12,2)` default 0   | não         | idem |
| COFINS                   | `cofins`            | `decimal(12,2)` default 0   | não         | idem |
| INSS                     | `inss`              | `decimal(12,2)` default 0   | não         | idem |
| IRRF                     | `irrf`              | `decimal(12,2)` default 0   | não         | idem |
| CSLL                     | `csll`              | `decimal(12,2)` default 0   | não         | idem |
| Tipo de pagamento        | `payment_type_id`   | FK `payment_types`          | **sim**     | `Select` dos tipos **ativos**. É ele que carrega o `auto_settlement`. |
| Qtd. parcelas            | `installment_count` | `integer` default 1         | **sim**     | `≥ 1`. Ver nota de nome abaixo. |
| 1º vencimento            | `first_due_date`    | `date`                      | **sim**     | Default: hoje. |

> **`installment_count`, não `installments`.** Em `payables`, `installment` é o
> **ordinal** da parcela ("1 de 3"). Aqui o campo é a **quantidade**. Nomes
> distintos para as duas coisas evitam a leitura errada na hora de gerar.

Colunas de resultado, **nunca escritas pelo usuário**:

| Coluna | Tipo | Observações |
| ------ | ---- | ----------- |
| `status` | `varchar(20)` default `open` | `open` \| `finalized` \| `cancelled`. Muda só pelas ações Finalizar e Cancelar. O validator **não aceita** o campo. |
| `finalized_at` | `timestamp` nullable | Carimbo da finalização. |

Infraestrutura: `id`, `company_id` (multitenant), `created_at`, `updated_at`.
**Sem `deleted_at`** — hard delete, e **só quando `status = 'open'`**.

Índices: `(company_id, operation_date)`, `(company_id, status)`,
`(company_id, supplier_id)`.

**Sem unicidade** de `document_number` — duplicar nota é permitido, mesma decisão
explícita de `payables`.

### Itens — `service_entry_items`

| Campo (UI, pt-BR) | Coluna (DB, en) | Tipo                      | Obrigatório | Observações |
| ----------------- | --------------- | ------------------------- | ----------- | ----------- |
| Serviço           | `service_id`    | FK `services`             | **sim**     | `Select` dos serviços **ativos**. |
| Qtd.              | `quantity`      | `integer`                 | **sim**     | `≥ 1`. **Inteiro** (decisão do usuário) — serviço se conta por unidade. |
| Valor             | `unit_price`    | `decimal(12,2)`           | **sim**     | `> 0`. Máscara BRL. Sugerido pelo `suggested_value` do serviço ([brecha 6](#6-valor-sugerido-do-serviço)). |
| Desconto          | `discount`      | `decimal(12,2)` default 0 | não         | Desconto **daquele serviço**. Máscara BRL. `≤ quantity × unit_price`. |

Infraestrutura: `id`, `company_id`, `service_entry_id`, `created_at`, `updated_at`.

O **Valor Total** da linha é **derivado**, nunca gravado:

```txt
valorTotalItem = quantity × unit_price − discount
```

Mesma política do `total` do título: valor calculável não vira coluna, senão
passa a existir duas verdades.

> **Idioma**: colunas em inglês; labels e mensagens em português.

### Coluna nova em `payables`

| Coluna | Tipo | Observações |
| ------ | ---- | ----------- |
| `service_entry_id` | `integer` **nullable**, FK `service_entries` `RESTRICT` | Origem do título. |

**Nullable de propósito**: um título pode nascer solto (botão "Novo" em contas a
pagar, com a devida permissão) ou, no futuro, do **lançamento direto
financeiro** — que entrará como *sua própria* coluna nullable. Sem polimorfismo:
uma coluna por origem, cada uma opcional, é mais simples de ler, de indexar e de
consultar do que um par `origin_type`/`origin_id`.

**`RESTRICT` de propósito**: é o banco, e não uma regra de aplicação, que impede
excluir uma entrada que já gerou título.

## Comportamento esperado

### Listagem (tela inicial)

A tela **abre na listagem**. Colunas:

| Coluna | Observação |
| ------ | ---------- |
| Código | `id`. |
| Nº documento | `document_number`. |
| Fornecedor | Nome do fornecedor (join). |
| Tipo de documento | Descrição do tipo (join). |
| Emissão | `dd/MM/yyyy` (`formatIsoDate`). |
| Data operação | `dd/MM/yyyy`. |
| Valor da entrada | Σ dos itens (bruto), `R$ 0,00`. **Não ordenável** — ver [brecha 7](#7-coluna-valor-não-ordenável). |
| Status | `ServiceEntryStatusBadge`: Aberta (`secondary`) / Finalizada (`success`) / Cancelada (`destructive`). |
| Ações | `DropdownMenu` — ver abaixo. |

Ordenação default: `operation_date desc, id desc` (o lançamento mais recente
primeiro). Paginação padrão do projeto.

**Filtros** (mesma mecânica de contas a pagar — filtro sob demanda, com botão
Pesquisar):

| Filtro | Comportamento |
| ------ | ------------- |
| Número do documento | `contém`, case-insensitive. |
| Fornecedor | `EntityPicker` `source="supplier"`. |
| Data da operação | Intervalo com checkbox, **marcado por default**: 1º ao último dia do mês corrente. |
| Data de emissão | Intervalo com checkbox, **desmarcado** por default. |
| Status | Múltipla escolha (Aberta / Finalizada / Cancelada). Nenhum = **todos**; os marcados combinam em **OR**. |

"Limpar filtros" volta ao **default** (operação no mês corrente), não ao vazio —
mesma decisão de contas a pagar.

### Menu "Ações" do grid

| Item | Gate (`Can`) | Habilitado quando |
| ---- | ------------ | ----------------- |
| Visualizar | `service_entries.view` | sempre |
| Editar | `service_entries.edit` | `status = 'open'` |
| Finalizar entrada | `service_entries.finalize` | `status = 'open'` |
| Cancelar entrada | `service_entries.cancel` | `status ∈ {open, finalized}` |
| Excluir | `service_entries.delete` | `status = 'open'` |

Itens indisponíveis pelo status **não aparecem** (não ficam desabilitados) — uma
entrada finalizada mostra só Visualizar e Cancelar.

### Cadastro — fluxo feliz

1. "Nova entrada" (gate `service_entries.create`) → navega para
   `/service-entries/new`. **Rota dedicada, não modal**: são ~16 campos em 4
   seções mais uma grade editável de itens; é o mesmo motivo pelo qual Empresas e
   Perfis usam rota própria.
2. **Seção 1 — Informações do documento**: tipo de documento, número, série,
   sub-série, data de emissão, fornecedor, valor de desconto da NFe.
3. **Seção 2 — Impostos da nota**: um `RadioGroup` com duas opções.
   - **Retenção por parte do emissor** (default): os 6 campos de imposto ficam
     **desabilitados** e são **zerados**.
   - **Retenção por parte do destinatário**: os 6 campos habilitam, todos com
     máscara monetária (são valores em reais destacados na nota, não alíquotas).
4. **Seção 3 — Informações de pagamento**: tipo de pagamento, qtd. de parcelas,
   1º vencimento. Os três **obrigatórios** — a finalização depende deles, e
   exigi-los aqui elimina um segundo ponto de validação.
5. **Seção 4 — Serviços**: uma linha de entrada (serviço, qtd., valor, desconto)
   com botão **+** que empurra o item para a tabela abaixo, e um **×** que remove
   a linha selecionada. A tabela mostra Cód. serviço, Descrição, Qtd. lançada,
   Preço, Desconto e Valor total, com o rodapé "Quantidade de serviços: N" e o
   **total da nota**.
6. Salvar → a entrada nasce **Aberta**, sem nenhum efeito no financeiro.

Os itens são enviados **junto** do cabeçalho, num único payload. No update, é
**substituição em bloco**: dentro da transação, apaga todos os itens da entrada e
insere os do payload. Simples, e evita ter que diferenciar item novo/alterado/
removido no cliente.

### Finalizar entrada — a razão de existir da tela

Ação do grid (gate `service_entries.finalize`), sobre uma entrada **aberta**.
Abre um `ConfirmDialog` com o **resumo do que será gerado** antes de confirmar:

```txt
Total dos serviços      R$ 9.000,00
Desconto da NFe        − R$     0,00
Impostos retidos       − R$    30,00
─────────────────────────────────────
Valor a pagar            R$ 8.970,00

4 parcelas de R$ 2.242,50, a partir de 05/09/2026.
```

Confirmando, `POST /api/service-entries/:id/finalize`.

#### A conta

Tudo em **centavos inteiros** (`decimal` volta do driver como string, e reais em
ponto flutuante tornam as comparações de fronteira não confiáveis — o
`PayableService` já trabalha assim):

```txt
totalServiços   = Σ (quantity × unit_price − discount)        por item
impostosRetidos = tax_withholding = 'recipient'
                    ? iss + pis + cofins + inss + irrf + csll
                    : 0                                        ← emissor não abate nada

base = totalServiços − discount(NFe) − impostosRetidos
```

O desconto da NFe **abate na origem**, junto com os impostos, e não viaja para a
coluna `discount` do título — ratear um desconto entre N parcelas misturaria dois
conceitos e tornaria o total de cada título uma conta indireta.

#### O rateio

```txt
valorParcela = floor(base / N)
resíduo      = base − valorParcela × N
parcelas     = [valorParcela] × (N − 1)  ++  [valorParcela + resíduo]
```

As primeiras parcelas ficam iguais e o **resíduo vai para a última**. Ex.:
R$ 1.000,00 em 3 → R$ 333,33 + R$ 333,33 + R$ 333,34.

Isso vive numa **função pura** `splitInstallments(baseCents, count): number[]`
(`#utils/installments`), testável isolada, sem tocar em banco.

#### Os vencimentos

`first_due_date` mais `i` **meses** (`DateTime.plus({ months: i })`), `i = 0..N−1`:
05/09 → 05/10 → 05/11 → 05/12. **Mesmo dia do mês seguinte**, não "+30 dias
corridos" — 30 dias faria o vencimento andar para trás no calendário (05/10 +
30 = 04/11). Quando o dia não existe no mês de destino, o luxon já resolve para o
último dia (31/01 + 1 mês = 28/02).

#### Os títulos gerados

Um `payable` por parcela:

| Coluna do título | Valor |
| ---------------- | ----- |
| `company_id` | tenant |
| `supplier_id` | `entry.supplier_id` |
| `service_entry_id` | `entry.id` |
| `document_number` | `entry.document_number` |
| `installment` | `i + 1` (o ordinal) |
| `issue_date` | `entry.issue_date` |
| `due_date` | `first_due_date + i meses` |
| `amount` | valor da parcela |
| `discount` / `fine` / `interest` | `0` |
| `notes` | `Título gerado a partir da entrada de serviço: {id} com o tipo de pagamento: {NOME}` |
| `paid_amount` / `status` | `0` / `open` — salvo o caso de baixa automática abaixo |

O texto em `notes` é o rastro legível para o usuário; a FK é o rastro que o banco
usa. Os dois existem de propósito: um serve à leitura, o outro à integridade.

#### Baixa automática (`auto_settlement`)

`payment_types` tem o campo **"realiza baixa automática de título"** desde antes
do módulo de baixa, e nunca foi acionado — a [spec da baixa](../financeiro/002-baixa-de-titulo.md)
adiou porque o título não tinha tipo de pagamento. **A entrada tem.**

Se o tipo de pagamento escolhido tem `auto_settlement = true` (PIX, dinheiro), a
finalização, **na mesma transação**, cria também uma baixa cheia para cada título:

| Coluna da baixa | Valor |
| --------------- | ----- |
| `payable_id` | o título gerado |
| `payment_type_id` | `entry.payment_type_id` |
| `settlement_date` | o **vencimento daquela parcela** |
| `amount` | o valor da parcela |
| `document_number` | `null` |
| `notes` | `Baixa automática (tipo de pagamento com baixa automática).` |

O título vai a **Pago** pelo caminho normal: `applySettlement()` +
`recomputeStatus()`, os mesmos donos de sempre. A data é o vencimento da parcela,
não a data da finalização — uma parcela que vence em novembro não deve aparecer
baixada em agosto.

#### Validações da finalização

| Situação | Resposta |
| -------- | -------- |
| Entrada não está `open` | **422** *"Só é possível finalizar uma entrada aberta."* |
| Entrada sem itens | **422** *"A entrada precisa ter ao menos um serviço."* |
| `base ≤ 0` | **422** *"O valor a pagar da nota é zero ou negativo. Revise o desconto e os impostos retidos."* |
| `base` (em centavos) `< installment_count` | **422** *"O valor da nota não permite dividir em N parcelas."* (evita parcela de R$ 0,00) |
| Tipo de pagamento ou fornecedor fora do tenant | **422** com a mensagem neutra do respectivo service |

#### A transação

```txt
db.transaction(trx):
  1. carrega a entrada com forUpdate()  → 404 fora do tenant; 422 se não estiver aberta
  2. carrega os itens; calcula totalServiços, impostosRetidos, base
  3. valida base (> 0, >= N centavos)
  4. carrega o payment_type do tenant (para o nome no notes e o auto_settlement)
  5. splitInstallments(base, N) → N valores
  6. para cada i: PayableService.createFromSource(tenant, dto, trx)
     └─ se auto_settlement: cria a baixa e aplica applySettlement/recomputeStatus
  7. entry.status = 'finalized'; entry.finalized_at = now; save({ client: trx })
COMMIT
```

Falhou qualquer passo, **nada** persiste: não existe entrada finalizada sem
títulos, nem títulos sem a entrada finalizada.

### Cancelar entrada

Ação do grid (gate `service_entries.cancel`). **Não existe reabertura** — uma
entrada finalizada não volta a ser editável. O que existe é o cancelamento, que
desfaz o efeito financeiro sem apagar o histórico documental.

`ConfirmDialog` avisando que **os títulos gerados serão cancelados e suas baixas
excluídas**; confirmando, `POST /api/service-entries/:id/cancel`:

```txt
db.transaction(trx):
  1. carrega a entrada com forUpdate()  → 422 se já cancelada
  2. para cada payable com service_entry_id = entry.id e status != 'cancelled':
       apaga suas payable_settlements, zera paid_amount, status = 'cancelled'
       (a mesma mecânica do PayableService.cancel, aplicada em lote)
  3. entry.status = 'cancelled'; save({ client: trx })
COMMIT
```

- Títulos **já cancelados** manualmente são pulados, não são erro.
- **Cancelada é terminal**: não edita, não finaliza, não re-cancela, não exclui.
- Uma entrada **aberta** também pode ser cancelada (fica cancelada sem títulos) —
  ver [brecha 2](#2-cancelar-entrada-aberta).

### Regras de negócio

- **Editar** só com `status = 'open'`. Finalizada ou cancelada → **422**
  *"Não é possível editar uma entrada finalizada ou cancelada."*
- **Excluir** só com `status = 'open'` → **422** caso contrário. A exclusão apaga
  os itens e a entrada na mesma transação. Ainda que a regra falhasse, o
  `RESTRICT` de `payables.service_entry_id` barraria no banco.
- **Ao menos um serviço** é exigido no create e no update (não só na finalização).
- **Retenção pelo emissor zera os impostos no backend** — a UI desabilita os
  campos, mas quem garante o zero é o service, que não confia no payload.
- **Desconto do item** `≤ quantity × unit_price` → senão 422.
- **Desconto da NFe** `≤ Σ itens` → senão 422 (espelha o `assertConsistent` do título).
- **1º vencimento ≥ data de emissão** → senão 422 *"O 1º vencimento não pode ser
  anterior à emissão."* Ver [brecha 3](#3-1º-vencimento-anterior-à-emissão).
- **Multitenant**: `document_type_id`, `supplier_id`, `payment_type_id` e cada
  `service_id` são validados como **pertencentes ao tenant** → 422 com mensagem
  neutra (não vaza a existência de dado de outra empresa).
- **Ativos no create**: os `Select` oferecem só registros ativos. Um vínculo
  antigo que ficou inativo continua sendo exibido com sufixo `(inativo)`.
- **"Hoje"** vem do backend (`todayIso`, fuso `America/Sao_Paulo`), nunca do cliente.
- **Exclusão**: hard delete (entrada + itens).

## Fora de escopo

- **Lançamento direto financeiro** — a outra origem de título, já antecipada pela
  coluna nullable, mas com spec própria.
- **Entrada de produto / nota de mercadoria** — esta spec é só de serviço.
- **Reabrir entrada finalizada** — decisão explícita: não existe.
- **Cálculo automático de imposto por alíquota** — os campos recebem o **valor em
  reais** destacado na nota, não o percentual.
- Importação de XML da NFSE, escrituração fiscal, retenção previdenciária
  calculada, centro de custo, rateio contábil, anexo do PDF da nota.
- **Contas a receber** — a entrada é sempre de fornecedor (gera a pagar).

## Decisões técnicas

### Backend

#### Migrations

`create_service_entries_table`:

```ts
table.increments('id').notNullable()

table.integer('company_id').unsigned().notNullable()
  .references('id').inTable('companies').onDelete('RESTRICT')
table.integer('document_type_id').unsigned().notNullable()
  .references('id').inTable('document_types').onDelete('RESTRICT')
table.integer('supplier_id').unsigned().notNullable()
  .references('id').inTable('suppliers').onDelete('RESTRICT')
table.integer('payment_type_id').unsigned().notNullable()
  .references('id').inTable('payment_types').onDelete('RESTRICT')

table.string('document_number', 20).notNullable()
table.string('series', 10).nullable()
table.string('sub_series', 10).nullable()
table.date('issue_date').notNullable()
table.date('operation_date').notNullable()

table.decimal('discount', 12, 2).notNullable().defaultTo(0)
table.string('tax_withholding', 20).notNullable().defaultTo('issuer')
table.decimal('iss', 12, 2).notNullable().defaultTo(0)
table.decimal('pis', 12, 2).notNullable().defaultTo(0)
table.decimal('cofins', 12, 2).notNullable().defaultTo(0)
table.decimal('inss', 12, 2).notNullable().defaultTo(0)
table.decimal('irrf', 12, 2).notNullable().defaultTo(0)
table.decimal('csll', 12, 2).notNullable().defaultTo(0)

table.integer('installment_count').notNullable().defaultTo(1)
table.date('first_due_date').notNullable()

table.string('status', 20).notNullable().defaultTo('open')
table.timestamp('finalized_at').nullable()

table.timestamp('created_at').notNullable()
table.timestamp('updated_at').notNullable()

table.index(['company_id', 'operation_date'], 'service_entries_company_operation_idx')
table.index(['company_id', 'status'], 'service_entries_company_status_idx')
table.index(['company_id', 'supplier_id'], 'service_entries_company_supplier_idx')
```

`create_service_entry_items_table`:

```ts
table.increments('id').notNullable()
table.integer('company_id').unsigned().notNullable()
  .references('id').inTable('companies').onDelete('RESTRICT')
table.integer('service_entry_id').unsigned().notNullable()
  .references('id').inTable('service_entries').onDelete('RESTRICT')
table.integer('service_id').unsigned().notNullable()
  .references('id').inTable('services').onDelete('RESTRICT')

table.integer('quantity').notNullable()
table.decimal('unit_price', 12, 2).notNullable()
table.decimal('discount', 12, 2).notNullable().defaultTo(0)

table.timestamp('created_at').notNullable()
table.timestamp('updated_at').notNullable()

table.index(['company_id', 'service_entry_id'], 'service_entry_items_company_entry_idx')
```

`service_entry_id` fica **`RESTRICT`, não `CASCADE`** — o projeto inteiro é
`RESTRICT`, e o service já apaga os filhos explicitamente dentro da transação
(como `PayableService.cancel` faz com as baixas). Consistência vale mais do que a
linha de código economizada.

`add_service_entry_id_to_payables`:

```ts
table.integer('service_entry_id').unsigned().nullable()
  .references('id').inTable('service_entries').onDelete('RESTRICT')
table.index(['service_entry_id'], 'payables_service_entry_idx')
```

#### Catálogo e rótulo

`catalog.ts` — módulo `service_entries` com **6** ações; `name`/`description` em
pt-BR (vão para o banco e para a UI):

| Slug | `name` |
| ---- | ------ |
| `service_entries.view` | Visualizar entradas de serviço |
| `service_entries.create` | Criar entrada de serviço |
| `service_entries.edit` | Editar entrada de serviço |
| `service_entries.delete` | Excluir entrada de serviço |
| `service_entries.finalize` | Finalizar entrada de serviço |
| `service_entries.cancel` | Cancelar entrada de serviço |

`module-labels.ts` — `service_entries: 'Entradas de serviço'`. **Obrigatório**,
senão as telas de Permissões/Perfis/Usuários mostram o slug cru em inglês.

Os itens **não têm módulo de permissão próprio**: não têm tela, são parte
indivisível do formulário do pai. Quem pode editar a entrada pode editar os itens.

#### Camadas

```txt
service_entry.ts + service_entry_item.ts   (models)
service_entry_repository.ts
service_entry_service.ts                   (CRUD + finalize + cancel)
service_entries_controller.ts
service_entry_validators.ts
#utils/installments.ts                     (splitInstallments — função pura)
```

**`PayableService` ganha `createFromSource`** (decisão B1):

```ts
export interface CreatePayableFromSourceDTO {
  supplierId: number
  documentNumber: string
  installment: number
  issueDate: DateTime
  dueDate: DateTime
  amount: number
  notes?: string | null
  serviceEntryId?: number | null
}

async createFromSource(
  tenant: TenantContext,
  dto: CreatePayableFromSourceDTO,
  trx: TransactionClientContract
): Promise<Payable>
```

Valida o fornecedor no tenant, roda o `assertConsistent`, chama o
`recomputeStatus` e salva com o `trx` do chamador. **O título continua com um
dono só** — quando o *lançamento direto financeiro* chegar, ele chama o mesmo
método em vez de montar um terceiro `new Payable()`.

Para a baixa automática, **`PayableSettlementService` ganha um
`settleFullInTransaction(trx, payable, paymentTypeId, date, notes)`** — cria a
baixa cheia e aplica `applySettlement`/`recomputeStatus`. Mesmo princípio: nada
de recriar a regra de baixa dentro do módulo de serviços.

#### Validators (VineJS, mensagens em pt-BR)

- `documentTypeId`, `supplierId`, `paymentTypeId`: inteiro positivo, obrigatórios
  (existência/tenant/ativo ficam no service).
- `documentNumber`: `trim`, 1–20, obrigatório.
- `series`, `subSeries`: `trim`, máx 10, opcionais. Vazio → `null`.
- `issueDate`, `firstDueDate`: data `YYYY-MM-DD`, obrigatórias.
- `discount`, `iss`, `pis`, `cofins`, `inss`, `irrf`, `csll`: número `≥ 0`,
  2 casas, opcionais (default 0).
- `taxWithholding`: `enum(['issuer', 'recipient'])`.
- `installmentCount`: inteiro `≥ 1` (teto de 999, como o `installment` do título).
- `items`: array com **mínimo 1**; cada item `{ serviceId, quantity ≥ 1,
  unitPrice > 0, discount ≥ 0 }`.
- **`status`, `finalizedAt` e `operationDate` não existem no validator** — payload
  que os traga é descartado, como já acontece com o `status` do título.
- As regras que dependem de estado (base > 0, entrada aberta, desconto ≤ total)
  são do **service** → `BusinessException` (422).

#### Endpoints

| Verbo + rota | Permissão | Efeito |
| ------------ | --------- | ------ |
| `GET /api/service-entries` | `service_entries.view` | Lista paginada com filtros, join de fornecedor/tipo de documento e `itemsTotal` por subquery. |
| `POST /api/service-entries` | `service_entries.create` | Cria cabeçalho + itens (transação). |
| `GET /api/service-entries/:id` | `service_entries.view` | Traz o cabeçalho **com os itens** (para o formulário). |
| `PUT /api/service-entries/:id` | `service_entries.edit` | Atualiza; substitui os itens em bloco (transação). Só `open`. |
| `DELETE /api/service-entries/:id` | `service_entries.delete` | Apaga itens + entrada (transação). Só `open`. |
| `POST /api/service-entries/:id/finalize` | `service_entries.finalize` | Gera os títulos (transação). |
| `POST /api/service-entries/:id/cancel` | `service_entries.cancel` | Cancela entrada + títulos (transação). |

Não há aqui o problema de ordem que `payables` teve com `/lookup` e
`/batch-settlements`: `finalize` e `cancel` vêm **depois** do `:id` no path
(`/:id/finalize`), então nenhuma delas é capturada por `/:id`. A ordem de
registro é livre.

A serialização devolve, além das colunas: `itemsTotal`, `withheldTaxes`,
`netAmount` (a base do contas a pagar), `supplierName`, `documentTypeName`,
`paymentTypeName` e, no `show`, o array `items` com `serviceDescription` e
`lineTotal`.

#### Erro de FK

Excluir um **serviço**, **tipo de documento**, **tipo de pagamento** ou
**fornecedor** usado por uma entrada → `23503` → **409** em pt-BR nas respectivas
telas (as mensagens já seguem esse padrão nos outros módulos).

#### Seeder

Apenas as 6 permissões novas.

### Frontend

`src/modules/service-entries/`:

| Arquivo | Responsabilidade |
| ------- | ---------------- |
| `service-entries-page.tsx` | Listagem, filtros, menu Ações, diálogos de confirmação. |
| `service-entry-form-page.tsx` | Rota dedicada — new / edit / view (`readOnly`). |
| `service-entry-items-section.tsx` | Sub-form + tabela dos serviços da nota. |
| `service-entry-status-badge.tsx` | Aberta / Finalizada / Cancelada. |
| `finalize-entry-dialog.tsx` | Confirmação com o resumo do parcelamento. |

- **API client**: `src/services/service-entries-api.ts`.
- **Tipos**: `ServiceEntry`, `ServiceEntryItem` em `types/api.ts`.
- **QueryKeys**: `['service-entries', companyId, filtros]` e
  `['service-entry', companyId, id]`.
- **Invalidação**: finalizar/cancelar invalidam `['service-entries', companyId]`
  **e** `['payables', companyId]` — a tela de contas a pagar por baixo passa a ter
  títulos novos.
- **Itens em estado local** (`useFieldArray` do RHF), enviados junto no submit.
  Não são entidade de servidor separada; não têm query própria.
- **Primitivo novo**: `ui/radio-group.tsx` (shadcn/ui, dep
  `@radix-ui/react-radio-group`) — o projeto ainda não tem radio. É o controle do
  "Retenção por parte do emissor / destinatário": duas opções mutuamente
  exclusivas, sempre visíveis, é exatamente o caso do radio (um `Switch` mentiria
  sobre a simetria das opções e um `Select` esconderia metade da escolha).
- **Moeda**: `maskMoney` e `formatCurrency` já vivem em `lib/masks.ts`, mas
  **`reaisToCents`/`centsToReais` estão duplicados** em cada formulário
  (`payable-form-dialog`, `receivable-form-dialog`, `service-form-dialog`,
  `product-form-dialog`, os dois `*-settlements-dialog`). Esta tela tem **8
  campos monetários no cabeçalho** mais os do sub-form de itens; seria a sétima
  cópia. **Promover os dois helpers para `lib/masks.ts`** e apontar os chamadores
  existentes para lá, como parte desta spec — é código que estamos usando de
  qualquer forma, e a conta de centavos é justamente onde uma cópia divergente
  faria estrago silencioso.
- **Componentes compartilhados reusados**: `components/page-header.tsx`,
  `components/confirm-dialog.tsx`, `components/empty-state.tsx`,
  `components/form/masked-input.tsx`, `components/common/entity-picker/`.
- **Datas**: `formatIsoDate` — **nunca** `formatDate` (date-only, defeito de fuso).
- **Totais na tela** calculados em **centavos**, com a mesma fórmula do backend, e
  exibidos com `formatCurrency`. O backend continua sendo a autoridade.
- **`PageHeader`** com o ícone `FileInput`, o mesmo do item de menu.
- **Menu** (`permissions/menu.ts`): grupo **Serviços** (ícone `Briefcase`),
  inserido **depois de Financeiro**, com a folha "Entrada de serviço".
- **Router**: `/service-entries`, `/service-entries/new`,
  `/service-entries/:id/edit`, `/service-entries/:id`, todas em `PermissionRoute`.

## Critérios de aceite

- [ ] Migrations criam `service_entries` e `service_entry_items` com todas as FKs
      `RESTRICT` e os índices listados; `add_service_entry_id_to_payables` adiciona
      a coluna **nullable**; `up`/`down` rodam limpas.
- [ ] Catálogo traz as 6 permissões `service_entries.*`; `module-labels.ts` traz
      `service_entries: 'Entradas de serviço'`.
- [ ] Menu tem o grupo **Serviços** depois de **Financeiro**, com "Entrada de
      serviço"; o grupo só aparece para quem tem `service_entries.view`.
- [ ] A tela abre na **listagem**, com o filtro de **data da operação** marcado no
      mês corrente por default; "Limpar filtros" volta a esse default.
- [ ] Formulário em **rota dedicada** com as 4 seções; `/service-entries/:id`
      abre tudo desabilitado, sem submit.
- [ ] Escolher **retenção pelo emissor** desabilita e zera os 6 campos de imposto;
      o backend grava `0` mesmo se o payload trouxer valor.
- [ ] Salvar sem nenhum serviço → **422** *"A entrada precisa ter ao menos um
      serviço."*
- [ ] Editar uma entrada substitui os itens em bloco, dentro de uma transação.
- [ ] Entrada nasce **Aberta**; o validator ignora `status` vindo no payload.
- [ ] **Finalizar** com retenção pelo **emissor**: título(s) somando
      `Σ itens − desconto da NFe`.
- [ ] **Finalizar** com retenção pelo **destinatário**: título(s) somando
      `Σ itens − desconto da NFe − (ISS+PIS+COFINS+INSS+IRRF+CSLL)`.
- [ ] Rateio: R$ 1.000,00 em 3 parcelas → 333,33 / 333,33 / **333,34**; a soma das
      parcelas é **exatamente** a base.
- [ ] Vencimentos: 1º em 05/09 com 4 parcelas → 05/09, 05/10, 05/11, 05/12;
      1º em 31/01 com 2 parcelas → 31/01 e 28/02.
- [ ] Cada título gerado tem `service_entry_id` preenchido, `installment` = ordinal
      e `notes` = *"Título gerado a partir da entrada de serviço: {id} com o tipo
      de pagamento: {NOME}"*.
- [ ] Tipo de pagamento com `auto_settlement = true` → cada título nasce **Pago**,
      com uma baixa na data do **vencimento da parcela**; com `false` → **Aberto**.
- [ ] Finalizar uma entrada **não aberta** → 422; `base ≤ 0` → 422; base menor que
      o número de parcelas (em centavos) → 422. Em todos, **nada** é persistido.
- [ ] Após finalizar, a entrada fica **Finalizada** com `finalized_at`, e some das
      ações Editar / Finalizar / Excluir.
- [ ] **Cancelar** uma entrada finalizada marca a entrada como Cancelada, cancela
      **todos** os títulos gerados e **exclui as baixas** deles; título já
      cancelado é pulado sem erro.
- [ ] Cancelada é terminal: editar / finalizar / re-cancelar / excluir → 422.
- [ ] Excluir uma entrada **aberta** apaga os itens junto; excluir finalizada ou
      cancelada → 422 (e o `RESTRICT` barraria de qualquer forma).
- [ ] FKs de outra empresa (documento, fornecedor, pagamento, serviço) → 422 com
      mensagem neutra.
- [ ] Excluir um serviço / tipo de documento / tipo de pagamento / fornecedor em
      uso por uma entrada → **409** em pt-BR.
- [ ] Após finalizar, a tela de **contas a pagar** mostra os títulos novos
      (invalidação de `['payables']`).
- [ ] Multitenant: trocar de empresa não vaza entradas nem itens de outra empresa.
- [ ] **`finalize` e `cancel` são poderes independentes de `edit`**: um perfil com
      `service_entries.view/create/edit/delete` e **sem** `finalize` não vê a ação
      "Finalizar entrada" no grid **e** recebe **403** ao chamar o endpoint direto;
      o mesmo vale para `cancel`. Um perfil só com `view` + `finalize` consegue
      finalizar sem conseguir editar.
- [ ] `ui/radio-group.tsx` existe e o `RadioGroup` alterna os campos de imposto.
- [ ] `reaisToCents`/`centsToReais` vivem em `lib/masks.ts` e os formulários que
      tinham cópia local passam a importar de lá (sem mudança de comportamento).
- [ ] `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) passam.

## Brechas e considerações

Pontos que a spec **decidiu de um jeito** mas que merecem confirmação antes da
implementação.

### 1. Data da operação não editável

A spec grava `operation_date` com `todayIso()` no create e **não** oferece o campo
no formulário — é literalmente "quando a nota foi lançada no sistema". A tela
legada também mostra emissão e operação iguais nos registros criados no dia.
Se você quiser **corrigir** um lançamento feito no dia errado (ou lançar uma nota
antiga com a data de operação retroativa), basta expor o campo com default hoje.

### 2. Cancelar entrada aberta

A spec permite cancelar uma entrada **aberta** (fica Cancelada, sem títulos, e
preserva o registro documental). A alternativa é restringir o cancelamento a
entradas **finalizadas** — aberta só se exclui. Diga se prefere a versão restrita.

### 3. 1º vencimento anterior à emissão

A spec **bloqueia** (422), espelhando o `assertConsistent` que o título já aplica
(`due_date >= issue_date`) — sem isso, a finalização quebraria lá na frente com
uma mensagem menos clara. Se existir caso real de nota emitida depois do
vencimento acordado, é só remover a regra aqui e afrouxar no título.

### 4. Dependência de permissões

Quem tiver `service_entries.*` precisa também de **`document_types.view`**,
**`payment_types.view`** e **`services.view`**, porque os `Select` do formulário
consomem as listagens desses cadastros. É a mesma decisão "C" já tomada em
Produtos (que exige `product_subgroups.view`). O fornecedor **não** entra nessa
lista: usa o `lookup` do `EntityPicker`, que é auth + tenant sem gate.
A alternativa seria criar endpoints `lookup` sem gate para os três — mais código,
e foge do precedente.

### 5. Duplicidade de nota

**Sem unicidade** de `document_number` (nem combinado com fornecedor/série) —
mesma decisão explícita de contas a pagar. Lançar a mesma nota duas vezes é
permitido; a consequência é gerar títulos em dobro. Se quiser um alerta (não um
bloqueio) de "já existe entrada com esse número para este fornecedor", é feature
pequena e vale como spec própria.

### 6. Valor sugerido do serviço

Ao escolher o serviço no sub-form, a spec **preenche** o campo Valor com o
`suggested_value` do serviço (quando houver), **editável**. É conveniência pura;
diga se prefere o campo sempre vazio.

### 7. Coluna "Valor" não ordenável

O valor da entrada é `Σ` dos filhos, então ordenar por ele exige ordenar pela
mesma subquery que o exibe. É factível, mas a listagem já ordena por data da
operação e o ganho é pequeno. A coluna fica **exibida e não ordenável**, como a
coluna "Grupo" na tela de Serviços. Se quiser ordenável, o custo é uma
`orderByRaw` sobre a subquery.

### 8. Valor exibido no grid é o bruto

A coluna "Valor da entrada" mostra `Σ itens` (o valor da nota), não o líquido a
pagar — é o que a tela legada faz e é o número que o usuário compara com o papel.
O líquido (`netAmount`) vai no payload e aparece no resumo da finalização. Se
preferir uma segunda coluna "Valor a pagar" no grid, é só somar.
