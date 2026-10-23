# Spec: Entrada de Mercadoria

> **Primeira tela do módulo Mercadoria** (grupo de menu novo, depois de
> Serviços) e **a primeira do sistema que escreve em três módulos ao mesmo
> tempo**: ao ser finalizada, a nota de compra gera os títulos em
> [contas a pagar](../financeiro/001-criar-tela-contas-a-pagar.md), dá entrada
> no **estoque** dos produtos e cadastra os **ativos** dos produtos
> imobilizados.
>
> É irmã da [Entrada de Serviço](../servicos/001-criar-tela-entrada-de-servico.md):
> mesmo ciclo de vida, mesma mecânica de parcelamento e de baixa automática,
> mesmos donos de regra (`PayableService.createFromSource`,
> `PayableSettlementService.settleFullInTransaction`). O que é novo aqui é o
> **efeito no produto** — estoque, custo e ativos — e a **precisão decimal**
> exigida pela NF-e.
>
> Decisões tomadas no brainstorm, com a análise do sistema Delphi (banco e
> código-fonte), em [000-analise-entrada-de-mercadoria.md](000-analise-entrada-de-mercadoria.md).

## Problema

A empresa compra mercadoria (material de consumo, fio, peças, aparelhos de ar
condicionado) e recebe uma NF-e com produtos, impostos destacados, frete e uma
condição de pagamento. Hoje não há onde registrar essa nota: o contas a pagar
seria digitado à mão, o saldo de estoque não se move e cada aparelho comprado
precisaria ser cadastrado como ativo, um a um, na tela de Ativos. Nada liga o
título, o saldo ou o ativo de volta à nota que os originou.

## Solução proposta

Criar a **entrada de mercadoria** — o documento fiscal de compra — com seus
produtos, seus totais e sua condição de pagamento. A entrada nasce **aberta**
(só documento, sem efeito) e, ao ser **finalizada**, na mesma transação:

1. gera os **títulos a pagar**, com vencimentos que o usuário confere e pode
   ajustar no diálogo de finalização;
2. soma o **estoque** dos produtos que controlam estoque e recalcula o **custo
   médio** deles;
3. cria **um ativo por unidade** dos produtos imobilizados;
4. atualiza o **último custo** dos demais produtos.

- Um cabeçalho (`goods_entries`) com N produtos (`goods_entry_items`).
- Três status: **aberta → finalizada**, e **cancelada** por ação explícita.
- **Cancelar** desfaz tudo — títulos, estoque e ativos — e **bloqueia** quando
  não dá para desfazer limpo.
- 6 permissões: `goods_entries.view/create/edit/delete/finalize/cancel`.

## Domínio

- **Entidade**: entrada de mercadoria (`goods_entry`) — a nota fiscal de compra
  recebida de um fornecedor.
- **Filhos**: itens (`goods_entry_item`) — os produtos da nota. Sem tela nem
  permissão próprias; vivem dentro do formulário do pai.
- **Gera**: títulos a pagar (`payable`), um por parcela; ativos
  (`product_asset`), um por unidade de produto imobilizado; movimento de saldo e
  custo em `products`.
- **Exemplo**: DANFE 242424, série 24, do fornecedor FRIGELAR, emitida em 13/10,
  com 1 SPLIT TCL 30K (ativo) a R$ 12.500,00, boleto em 3 parcelas, 1º
  vencimento em 13/11. Finalizada, gera 3 títulos (4.166,66 + 4.166,66 +
  4.166,68) vencendo em 13/11, 13/12 e 13/01, e **1 ativo** "SPLIT TCL HW 30K F"
  disponível. O custo do produto passa a R$ 12.500,00.
- **Justificativa de negócio**: sem a entrada, o contas a pagar não tem lastro,
  o saldo de estoque fica parado e o imobilizado depende de cadastro manual.

## Específicos do módulo

- **Tabelas**: `goods_entries`, `goods_entry_items` (+ colunas novas em
  `payables` e `product_assets`; colunas ampliadas em `products`)
- **Slug do módulo**: `goods_entries`
- **Endpoints**: `/api/goods-entries` (+ `GET /api/products/lookup`)
- **Rotas de página**: `/goods-entries`, `/goods-entries/new`,
  `/goods-entries/:id/edit`, `/goods-entries/:id` (visualizar)
- **Módulo frontend**: `src/modules/goods-entries/`
- **Grupo de menu novo**: **Mercadoria**, ícone `ArrowLeftRight`, **depois de
  Serviços**. Vai abrigar as próximas telas de movimentação de estoque (saída
  avulsa, requisição, inventário).
- **Item de menu**: "Entrada de mercadoria", ícone `PackagePlus`
- **Rótulo do módulo** (`module-labels.ts`): `goods_entries: 'Entradas de mercadoria'`

## Campos

### Cabeçalho — `goods_entries`

| Campo (UI, pt-BR)        | Coluna (DB, en)     | Tipo                        | Obrigatório | Observações |
| ------------------------ | ------------------- | --------------------------- | ----------- | ----------- |
| Tipo de documento        | `document_type_id`  | FK `document_types`         | **sim**     | `Select` dos tipos **ativos**. |
| Número do documento      | `document_number`   | `varchar(20)`               | **sim**     | String — preserva zeros à esquerda. |
| Série                    | `series`            | `varchar(10)` nullable      | não         | `trim`; vazio → `null`. |
| Sub-série                | `sub_series`        | `varchar(10)` nullable      | não         | idem |
| Data de emissão          | `issue_date`        | `date`                      | **sim**     | Default: hoje. |
| Data da operação         | `operation_date`    | `date`                      | automático  | `todayIso()` no create; **não editável**. |
| Fornecedor               | `supplier_id`       | FK `suppliers`              | **sim**     | `EntityPicker` `source="supplier"`. Qualquer fornecedor ativo, sem filtro de `type`. |
| Valor de desconto da NF-e | `discount`         | `decimal(12,2)` default 0   | não         | Desconto **geral da nota**, distinto do desconto por item. |
| Valor ICMS ST            | `icms_st`           | `decimal(12,2)` default 0   | não         | **Soma** ao valor da nota. |
| Valor IPI                | `ipi`               | `decimal(12,2)` default 0   | não         | **Soma**. |
| Valor frete              | `freight`           | `decimal(12,2)` default 0   | não         | **Soma**. |
| Valor seguro             | `insurance`         | `decimal(12,2)` default 0   | não         | **Soma**. |
| Valor outras despesas    | `other_expenses`    | `decimal(12,2)` default 0   | não         | **Soma**. |
| Tipo de pagamento        | `payment_type_id`   | FK `payment_types`          | **sim**     | `Select` dos tipos **ativos**. Carrega o `auto_settlement`. |
| Qtd. parcelas            | `installment_count` | `integer` default 1         | **sim**     | `1..999`. Quantidade, não ordinal (mesma nota de nome da Entrada de Serviço). |
| 1º vencimento            | `first_due_date`    | `date`                      | **sim**     | Default: hoje. Base das datas **sugeridas** na finalização. |

Os campos obrigatórios são exigidos **já ao salvar** (o Delphi só cobrava na
finalização) — mesma decisão da Entrada de Serviço: um segundo ponto de
validação a menos.

Colunas de resultado, **nunca escritas pelo usuário**:

| Coluna | Tipo | Observações |
| ------ | ---- | ----------- |
| `status` | `varchar(20)` default `open` | `open` \| `finalized` \| `cancelled`. Só mudam por Finalizar e Cancelar. |
| `finalized_at` | `timestamp` nullable | Carimbo da finalização. |

Infraestrutura: `id`, `company_id`, `created_at`, `updated_at`. **Sem
`deleted_at`** — hard delete, só com `status = 'open'`.

Índices: `(company_id, operation_date)`, `(company_id, status)`,
`(company_id, supplier_id)`.

**Sem unicidade** de `document_number`.

### Itens — `goods_entry_items`

| Campo (UI, pt-BR) | Coluna (DB, en) | Tipo                        | Obrigatório | Observações |
| ----------------- | --------------- | --------------------------- | ----------- | ----------- |
| Produto           | `product_id`    | FK `products`               | **sim**     | `EntityPicker` `source="product"` (novo). **Único por entrada.** |
| Qtd.              | `quantity`      | `decimal(15,4)`             | **sim**     | `> 0`. Até 4 casas (`qCom` da NF-e: 2,53 m; 0,8334 kg). **Inteira e ≤ 999** quando o produto é `fixed_asset` (cada unidade vira um ativo). |
| Preço             | `unit_price`    | `decimal(20,10)`            | **sim**     | `≥ 0` (zero = bonificação). Até 10 casas (`vUnCom` da NF-e). Pré-preenchido com o `cost_price` do produto, editável. |
| Desconto          | `discount`      | `decimal(12,2)` default 0   | não         | Desconto **do item**. `≤` total bruto da linha. |

Coluna de resultado, **gravada só pela finalização**:

| Coluna | Tipo | Observações |
| ------ | ---- | ----------- |
| `stock_effect` | `varchar(10)` nullable | `stock` \| `none` \| `asset` — o efeito **aplicado** àquele item. `null` enquanto a entrada está aberta. O cancelamento lê daqui, não do estado atual do produto. |

Infraestrutura: `id`, `company_id`, `goods_entry_id`, `created_at`, `updated_at`.

**Unicidade** `(goods_entry_id, product_id)`: o mesmo produto não aparece duas
vezes na entrada (como no Delphi). Se a NF-e trouxer o produto em duas linhas, o
usuário consolida.

O total da linha é **derivado, nunca gravado**:

```txt
totalBruto   = round(quantity × unit_price, 2)        ← vProd da NF-e, em centavos
totalLíquido = totalBruto − discount
```

O arredondamento é **half-up** em centavos, como o `vProd` da NF-e — é o
número que o usuário confere com o DANFE.

### Colunas novas em tabelas existentes

| Tabela | Coluna | Tipo | Observações |
| ------ | ------ | ---- | ----------- |
| `payables` | `goods_entry_id` | `integer` **nullable**, FK `goods_entries` `RESTRICT` | Origem do título. Segunda coluna de origem, ao lado de `service_entry_id` — "uma coluna por origem". |
| `product_assets` | `goods_entry_id` | `integer` **nullable**, FK `goods_entries` `RESTRICT` | Origem do ativo. `null` para ativos cadastrados à mão. É o que permite desfazer os ativos no cancelamento (o Delphi não tinha esse rastro). |

### Colunas ampliadas em `products`

| Coluna | De | Para | Por quê |
| ------ | -- | ---- | ------- |
| `quantity_in_stock` | `decimal(12,3)` | `decimal(15,4)` | Receber a quantidade de 4 casas da entrada sem perder a 4ª. O Delphi tem exatamente esse defeito: o item aceita 5 casas e o saldo guarda 2. |
| `minimum_stock` | `decimal(12,3)` | `decimal(15,4)` | Mesma escala do saldo, que ele compara. |
| `cost_price` | `decimal(12,2)` | `decimal(20,10)` | O custo médio de 1 m de fio pode ser R$ 3,4567…; com 2 casas, cada entrada arredondaria o médio e o erro se acumula. |

Ampliar precisão não altera nenhum valor existente.

## Comportamento esperado

### Listagem (tela inicial)

Espelha a da Entrada de Serviço. Colunas, **todas ordenáveis**:

| Coluna | Observação |
| ------ | ---------- |
| Código | `id`. |
| Nº documento | `document_number`. |
| Fornecedor | Nome (subquery correlacionada em `SORT_EXPRESSIONS`). |
| Tipo de documento | Descrição (idem). |
| Emissão | `formatIsoDate`. |
| Data operação | `formatIsoDate`. |
| Valor da entrada | **Total da nota** (`netAmount`, ver [A conta](#a-conta)) — o valor da NF-e, que inclui ST/IPI/frete. Ordena pela mesma expressão que exibe. |
| Status | `GoodsEntryStatusBadge`: Aberta / Finalizada / Cancelada. Ordena pelo ciclo de vida (`CASE`). |
| Ações | `DropdownMenu`. |

Ordenação default: `operation_date desc, id desc`. Paginação padrão.

**Filtros** (sob demanda, botão Pesquisar; persistidos por `useSearchFilters`):
Código (exato), Número do documento (contém), Fornecedor (`EntityPicker`), Data
da operação (intervalo com checkbox **marcado** no mês corrente), Data de
emissão (intervalo, desmarcado), Status (múltipla escolha, nenhum = todos).
"Limpar filtros" volta ao default.

### Menu "Ações" do grid

| Item | Gate (`Can`) | Aparece quando |
| ---- | ------------ | -------------- |
| Visualizar | `goods_entries.view` | sempre |
| Editar | `goods_entries.edit` | `open` |
| Finalizar entrada | `goods_entries.finalize` | `open` |
| Cancelar entrada | `goods_entries.cancel` | `open` ou `finalized` |
| Excluir | `goods_entries.delete` | `open` |

### Cadastro — fluxo feliz

1. "Nova entrada" (gate `goods_entries.create`) → `/goods-entries/new` (rota
   dedicada).
2. **Seção 1 — Informações do documento**: tipo de documento, número, série,
   sub-série, data de emissão, fornecedor, valor de desconto da NF-e.
3. **Seção 2 — Totais da nota**: ICMS ST, IPI, frete, seguro, outras despesas
   (máscara BRL).
4. **Seção 3 — Informações de pagamento**: tipo de pagamento, qtd. de parcelas,
   1º vencimento.
5. **Seção 4 — Produtos**: linha de entrada (produto via `EntityPicker`, qtd.,
   preço, desconto) com botão **+** e **×**. Ao escolher o produto, o preço vem
   com o `cost_price` dele (editável). Produto já presente na lista → a tela
   **não adiciona** e avisa *"Este produto já está na entrada."*. A tabela
   mostra Código, Descrição, Un., Qtd., Preço, Desconto e Valor total; o rodapé
   traz "Quantidade de produtos: N", **Total dos produtos** e **Total da nota**.
6. Salvar → a entrada nasce **Aberta**, sem efeito em nenhum módulo.

Itens vão **junto** do cabeçalho num payload só; no update, **substituição em
bloco** dentro da transação (mesma decisão da Entrada de Serviço).

### Finalizar entrada

Ação do grid (gate `goods_entries.finalize`), sobre entrada **aberta**.

1. A tela chama `GET /api/goods-entries/:id/finalize-preview`, que devolve o
   resumo calculado **pelo backend** — a mesma conta que a finalização fará:

   ```txt
   Total dos produtos       R$ 12.500,00
   Desconto da NF-e       − R$      0,00
   ICMS ST + IPI          + R$      0,00
   Frete, seguro, outras  + R$      0,00
   ─────────────────────────────────────
   Valor da nota            R$ 12.500,00
   ```

   mais as parcelas sugeridas (ordem, valor, vencimento = 1º vencimento + `i`
   meses) e o efeito em cada produto ("SPLIT TCL HW 30K F — gera 1 ativo";
   "FIO COBRE 2,5mm — +150 m no estoque").

2. O `finalize-entry-dialog` mostra o resumo e a **tabela de parcelas**, com a
   coluna **Vencimento editável** (date picker por linha). Valores **não** são
   editáveis — vêm do rateio.
3. Confirmar → `POST /api/goods-entries/:id/finalize` com
   `{ dueDates: ['2026-11-13', '2026-12-13', '2027-01-13'] }`.

O preview existe para que o rateio e o cálculo de datas (`splitInstallments`,
`installmentDueDates`, com o "31/01 + 1 mês = 28/02" do luxon) tenham **um dono
só**, no backend, em vez de uma cópia no frontend.

#### A conta

Em **centavos inteiros**, com os totais de linha calculados por aritmética
decimal exata (ver [Aritmética decimal](#aritmética-decimal)):

```txt
totalProdutos = Σ (round(quantity × unit_price, 2) − discount)   por item
acréscimos    = icms_st + ipi + freight + insurance + other_expenses

netAmount = totalProdutos − discount(NF-e) + acréscimos
```

Ao contrário da nota de serviço, ST e IPI **somam**: são impostos cobrados do
comprador, não retidos dele. Confere com a NF-e: `vNF = vProd − vDesc + vST +
vIPI + vFrete + vSeg + vOutro`.

#### O rateio e os vencimentos

- `splitInstallments(netAmountCents, N)` — iguais por `floor`, **resíduo na
  última**.
- Vencimentos **sugeridos**: `installmentDueDates(first_due_date, N)`.
- Vencimentos **efetivos**: os `dueDates` do payload, validados (abaixo).

#### Efeito em cada produto

Os produtos dos itens são travados com `forUpdate()` **em ordem crescente de
id** (duas finalizações simultâneas sobre o mesmo produto não perdem soma, e a
ordem fixa evita deadlock). Para cada item, o efeito sai do **estado atual** do
produto no momento da finalização:

| Produto | `stock_effect` | Estoque | Ativos | Custo |
| ------- | -------------- | ------- | ------ | ----- |
| `consumable` + `controls_stock = true` | `stock` | `quantity_in_stock = quantity_in_stock + qtd` | — | **médio ponderado** |
| `consumable` + `controls_stock = false` | `none` | não mexe | — | **último custo** |
| `fixed_asset` | `asset` | não mexe | **1 por unidade** | **último custo** |

**Custo unitário da entrada** (líquido do desconto do item, 10 casas, half-up):

```txt
custoEntrada = totalLíquido ÷ quantity
```

**Custo médio ponderado** (produto com estoque):

```txt
se quantity_in_stock ≤ 0 ou cost_price é null:
    novoCusto = custoEntrada
senão:
    novoCusto = (quantity_in_stock × cost_price + totalLíquido)
              ÷ (quantity_in_stock + quantity)
```

Corrige três defeitos do Delphi: lá as quantidades entravam truncadas
(`AsInteger` — 2,53 m virava 2), o desconto do item era ignorado e o resultado
era arredondado a 2 casas.

**Último custo** (sem estoque e ativo): `cost_price = custoEntrada`.

**Item com custo zero** (bonificação): aplica o efeito de estoque/ativo, mas
**não toca no `cost_price`** — nem como último custo, nem dentro do médio.

**Ativos**: para item `asset`, cria `quantity` registros em `product_assets`:

| Coluna | Valor |
| ------ | ----- |
| `product_id` | o produto |
| `goods_entry_id` | a entrada |
| `description` | `products.description` |
| `asset_code` | `null` — o patrimônio é preenchido depois na tela de Ativos |
| `situation` | `available` |
| `equipment_exists` | `false` |
| demais | `null` |

(O Delphi gravava descrição e código como `ATIVO <id>`; aqui a descrição é a do
produto e o código fica vazio, que é o que o usuário de fato vai preencher.)

O `stock_effect` aplicado é gravado em cada item.

#### Os títulos gerados

Um `payable` por parcela, via `PayableService.createFromSource` (o DTO ganha
`goodsEntryId`):

| Coluna do título | Valor |
| ---------------- | ----- |
| `supplier_id` | `entry.supplier_id` |
| `goods_entry_id` | `entry.id` |
| `document_number` | `entry.document_number` |
| `installment` | `i + 1` |
| `issue_date` | `entry.issue_date` |
| `due_date` | `dueDates[i]` |
| `amount` | valor da parcela |
| `notes` | `Título gerado a partir da entrada de mercadoria: {id} com o tipo de pagamento: {NOME}` |

**Baixa automática**: se o tipo de pagamento tem `auto_settlement = true`,
`PayableSettlementService.settleFullInTransaction` baixa cada título por inteiro
na data do **vencimento daquela parcela** (o Delphi baixava na data da
finalização; o web segue a Entrada de Serviço).

#### Validações da finalização

| Situação | Resposta |
| -------- | -------- |
| Entrada não está `open` | **422** *"Só é possível finalizar uma entrada aberta."* |
| Entrada sem itens | **422** *"A entrada precisa ter ao menos um produto."* |
| `netAmount ≤ 0` | **422** *"O valor da nota é zero ou negativo. Revise os descontos."* |
| `netAmount` (centavos) `< N` | **422** *"O valor da nota não permite dividir em N parcelas."* |
| `dueDates.length ≠ installment_count` | **422** *"Informe o vencimento de todas as N parcelas."* |
| Vencimento anterior à emissão | **422** *"O vencimento da parcela X não pode ser anterior à emissão."* |
| Vencimento anterior ao da parcela anterior | **422** *"O vencimento da parcela X não pode ser anterior ao da parcela X−1."* |
| Item de produto `fixed_asset` com quantidade fracionada | **422** *"O produto {descrição} é um ativo: a quantidade precisa ser inteira."* (o tipo pode ter mudado depois do salvamento) |
| Item de produto `fixed_asset` com quantidade > 999 | **422** *"A quantidade máxima para produto ativo é 999."* |

#### A transação

```txt
db.transaction(trx):
  1. trava a entrada (forUpdate) → 404 fora do tenant; 422 se não estiver aberta
  2. carrega os itens; calcula totalProdutos e netAmount; valida
  3. valida dueDates
  4. trava os produtos (forUpdate, id crescente)
  5. para cada item: aplica estoque / custo / ativos; grava stock_effect
  6. carrega o payment_type (nome + auto_settlement)
  7. splitInstallments → createFromSource por parcela
     └─ auto_settlement: settleFullInTransaction na data do vencimento
  8. entry.status = 'finalized'; finalized_at = now
COMMIT
```

Falhou qualquer passo, **nada** persiste: nem título, nem saldo, nem ativo.

### Cancelar entrada

Ação do grid (gate `goods_entries.cancel`). **Não existe reabertura**. O
`ConfirmDialog` avisa que serão desfeitos os **títulos (com suas baixas)**, o
**estoque** e os **ativos** gerados.
`POST /api/goods-entries/:id/cancel`:

```txt
db.transaction(trx):
  1. trava a entrada → 422 se já cancelada
  2. se finalized:
     a. trava os produtos dos itens (forUpdate, id crescente)
     b. VERIFICA tudo antes de mexer em qualquer coisa:
        - item stock: o produto ainda controla estoque
                      e quantity_in_stock − qtd ≥ 0
        - item asset: todos os ativos com goods_entry_id = entry.id
                      estão em situation = 'available'
     c. APLICA:
        - item stock: quantity_in_stock = quantity_in_stock − qtd
        - item asset: exclui os ativos com goods_entry_id = entry.id
        - títulos com goods_entry_id = entry.id e status ≠ cancelled:
          apaga baixas, zera paid_amount, status = 'cancelled'
  3. entry.status = 'cancelled'
COMMIT
```

O **custo não volta** ao valor anterior: o custo médio é um acumulado, e outras
entradas podem ter passado pelo produto depois desta.

| Bloqueio | Resposta |
| -------- | -------- |
| Ativo gerado não está mais disponível | **422** *"Não é possível cancelar: o ativo {código ou #id} do produto {descrição} está {alocado/vendido}."* |
| Estorno deixaria o estoque negativo | **422** *"Não é possível cancelar: o estoque de {descrição} ficaria negativo ({saldo} − {qtd})."* |
| Produto com efeito `stock` não controla mais estoque | **422** *"Não é possível cancelar: o produto {descrição} não controla mais estoque."* |

Ativo **editado** (código, marca, modelo) mas ainda *Disponível* é excluído
normalmente. Entrada **aberta** pode ser cancelada (fica Cancelada, sem efeito).
Cancelada é **terminal**.

### Regras de negócio

- **Editar/Excluir** só com `status = 'open'` → 422 caso contrário. A exclusão
  apaga itens + entrada na mesma transação.
- **Ao menos um produto** no create e no update.
- **Produto único por entrada** → 422 *"O produto {descrição} aparece mais de
  uma vez na entrada."* (e a unicidade no banco).
- **Quantidade inteira e ≤ 999 para produto `fixed_asset`** — validado no save
  e de novo na finalização. O teto evita que um erro de digitação (5000 em vez
  de 5) crie milhares de ativos.
- **Desconto do item** `≤` total bruto da linha → 422.
- **Desconto da NF-e** `≤` total dos produtos → 422.
- **1º vencimento ≥ emissão** → 422 (na finalização, cada vencimento ≥ emissão).
- **Multitenant**: tipo de documento, fornecedor, tipo de pagamento e cada
  produto validados no tenant → 422 com mensagem neutra.
- **Produto inativo** não aparece na busca; item já lançado com produto que
  ficou inativo ainda finaliza.
- **`quantity_in_stock` continua imutável** no formulário de Produtos; agora é
  movido pela entrada. O `cost_price` continua editável lá.

## Aritmética decimal

Quantidade (4 casas) × preço (10 casas) tem 14 casas e até ~25 dígitos —
além do que um `number` do JavaScript representa com exatidão (`2.53 × 18.9`
já erra em ponto flutuante). Toda conta com quantidade, preço e custo usa
**inteiros escalados em `BigInt`**:

- **Backend** — `#utils/decimal.ts`, funções puras e testáveis:
  - `toScaled(value: string, scale: number): bigint` — `'2.5300'` com escala 4 → `25300n`.
  - `lineGrossCents(quantity: string, unitPrice: string): bigint` — `round(q × p, 2)` half-up.
  - `divideScaled(numerator, denominator, scale): bigint` — divisão com half-up.
  - `fromScaled(value: bigint, scale: number): string` — de volta para string decimal.
- **Frontend** — `lib/decimal.ts` com `lineGrossCents` espelhado, só para exibir
  totais na tela; o backend continua sendo a autoridade.
- **No fio da API**, `quantity`, `unitPrice` e `costPrice` trafegam como
  **string decimal** (`"75.7729000000"`), nos dois sentidos. O `pg` já devolve
  `decimal` como string; converter para `number` no caminho perderia casas. Os
  validators aceitam string com regex (`^\d{1,11}(\.\d{1,4})?$` para quantidade,
  `^\d{1,10}(\.\d{1,10})?$` para preço/custo).
- Valores monetários em `decimal(12,2)` seguem como hoje (`number` + centavos).

### Máscaras

- **Quantidade**: `maskQuantity`/`formatQuantity` passam de 3 para **4 casas**
  (afeta Produtos também — estoque e mínimo).
- **Preço e custo**: máscara nova `maskDecimalPrice` (até 10 casas, vírgula
  pt-BR) e `formatDecimalPrice`, que exibe as **casas significativas com mínimo
  de 2** e um teto de casas por contexto:
  - **Formulário de Produtos**: todas as casas (até 10) — `3,4566666667`.
  - **Preço do item da entrada** — *revisto pelo usuário em 2026-10-23, no
    teste*: **padrão brasileiro de valor**, `maskUnitPrice` — prefixo `R$`,
    **2 casas**, dígitos entram pela direita (`1592237` → `R$ 15.922,37`),
    igual aos demais campos de dinheiro. **Apertar a vírgula** liga o modo
    decimal: o que já foi digitado vira a parte inteira e os dígitos seguintes
    são as casas, **até 4** — o `vUnCom` de fio, cabo e afins
    (`75,7729` → `R$ 75,7729`); apagar a vírgula volta aos centavos. O
    pré-preenchimento pelo custo arredonda para 4 casas e entra no modo que o
    valor exige (`5300,00` → `R$ 5.300,00`; `3,4566666667` → `R$ 3,4567`). O
    banco e a API seguem aceitando até 10 casas (futura importação de XML).
  - **Listagem de Produtos**: até **4** casas significativas, mínimo 2 —
    `3,4567`, `5.300,00`. Só exibição; o banco guarda as 10.

## Fora de escopo

- **Devolução** (no Delphi, entrada com tipo de documento 99 que só soma
  estoque) — fica para as telas de saída avulsa e requisição, vinculada à
  saída de origem. Registrado em `state.md`.
- **Kardex** (histórico de movimentação de estoque) — o rastro desta entrega é
  o item da entrada finalizada (`stock_effect`) e `product_assets.goods_entry_id`.
- **Rateio** de frete/IPI/ST/desconto da NF-e no custo do produto.
- **Importação de XML da NF-e**, escrituração fiscal, impressão.
- **Cadastro de produto pela tela da entrada** (F12 do Delphi).
- **Migração** das entradas do Delphi — projeto à parte.
- **Datas editáveis na Entrada de Serviço** — aprovado, em spec separada.
- **Reabrir entrada finalizada** — não existe.

## Decisões técnicas

### Backend

#### Migrations

`alter_products_precision` — `quantity_in_stock` e `minimum_stock` para
`decimal(15,4)`, `cost_price` para `decimal(20,10)` (`alter().` no Knex;
`down` volta aos tipos antigos).

`create_goods_entries_table`:

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
table.decimal('icms_st', 12, 2).notNullable().defaultTo(0)
table.decimal('ipi', 12, 2).notNullable().defaultTo(0)
table.decimal('freight', 12, 2).notNullable().defaultTo(0)
table.decimal('insurance', 12, 2).notNullable().defaultTo(0)
table.decimal('other_expenses', 12, 2).notNullable().defaultTo(0)

table.integer('installment_count').notNullable().defaultTo(1)
table.date('first_due_date').notNullable()

table.string('status', 20).notNullable().defaultTo('open')
table.timestamp('finalized_at').nullable()

table.timestamp('created_at').notNullable()
table.timestamp('updated_at').notNullable()

table.index(['company_id', 'operation_date'], 'goods_entries_company_operation_idx')
table.index(['company_id', 'status'], 'goods_entries_company_status_idx')
table.index(['company_id', 'supplier_id'], 'goods_entries_company_supplier_idx')
```

`create_goods_entry_items_table`:

```ts
table.increments('id').notNullable()
table.integer('company_id').unsigned().notNullable()
  .references('id').inTable('companies').onDelete('RESTRICT')
table.integer('goods_entry_id').unsigned().notNullable()
  .references('id').inTable('goods_entries').onDelete('RESTRICT')
table.integer('product_id').unsigned().notNullable()
  .references('id').inTable('products').onDelete('RESTRICT')

table.decimal('quantity', 15, 4).notNullable()
table.decimal('unit_price', 20, 10).notNullable()
table.decimal('discount', 12, 2).notNullable().defaultTo(0)
table.string('stock_effect', 10).nullable()

table.timestamp('created_at').notNullable()
table.timestamp('updated_at').notNullable()

table.unique(['goods_entry_id', 'product_id'], 'goods_entry_items_entry_product_uq')
table.index(['company_id', 'goods_entry_id'], 'goods_entry_items_company_entry_idx')
```

`add_goods_entry_id_to_payables` e `add_goods_entry_id_to_product_assets`:

```ts
table.integer('goods_entry_id').unsigned().nullable()
  .references('id').inTable('goods_entries').onDelete('RESTRICT')
table.index(['goods_entry_id'], '<tabela>_goods_entry_idx')
```

#### Catálogo e rótulo

`catalog.ts` — módulo `goods_entries`, 6 ações, `name`/`description` em pt-BR:

| Slug | `name` |
| ---- | ------ |
| `goods_entries.view` | Visualizar entradas de mercadoria |
| `goods_entries.create` | Criar entrada de mercadoria |
| `goods_entries.edit` | Editar entrada de mercadoria |
| `goods_entries.delete` | Excluir entrada de mercadoria |
| `goods_entries.finalize` | Finalizar entrada de mercadoria |
| `goods_entries.cancel` | Cancelar entrada de mercadoria |

`module-labels.ts` — `goods_entries: 'Entradas de mercadoria'`.

`finalize` e `cancel` são permissões **próprias**, independentes de `edit`.

#### Camadas

```txt
goods_entry.ts + goods_entry_item.ts   (models)
goods_entry_repository.ts
goods_entry_service.ts                 (CRUD + preview + finalize + cancel)
goods_entry_stock.ts                   (efeito em produto: aplicar e estornar —
                                        estoque, custo, ativos; recebe o trx)
goods_entries_controller.ts
goods_entry_validators.ts
#utils/decimal.ts                      (aritmética BigInt — funções puras)
```

O efeito em produto fica **fora** do `goods_entry_service`, num módulo próprio
(`goods_entry_stock.ts`): é a parte com mais regra (médio, último custo,
bonificação, ativos, estorno, bloqueios) e é a que a futura saída/devolução vai
querer olhar. A criação dos ativos usa o model `ProductAsset` direto, dentro do
`trx` — não passa pelo `ProductAssetService.create`, que valida payload de
usuário e abre a própria transação.

Reusos sem alteração de regra: `splitInstallments`, `installmentDueDates`,
`todayIso`, `PayableService.createFromSource` (DTO ganha `goodsEntryId`),
`PayableSettlementService.settleFullInTransaction`. O cancelamento em lote dos
títulos segue a mesma mecânica que `ServiceEntryService.cancel` já aplica.

`ProductService` / `product_validators.ts`: `costPrice`, `quantityInStock` e
`minimumStock` passam a aceitar a nova precisão (custo como string decimal); a
serialização devolve `costPrice` como string.

#### Lookup de produto

`GET /api/products/lookup` — **auth + tenant, sem gate de permissão** (quem
lança entrada precisa achar produto sem ter `products.view`), registrado
**antes** de `/products/:id`. Mesmo contrato de `/suppliers/lookup`:

- `?q=` — busca em `description` (contém, case-insensitive) e `id` exato quando
  o termo é numérico (`lookupCodeId`); **só ativos**.
- `?ids=` — hidratação, traz inativos.
- Payload mínimo: `id`, `description`, `type`, `controlsStock`,
  `unitOfMeasure` (descrição, nullable), `costPrice` (string, nullable),
  `isActive`.
- **`costPrice` só para quem pode ver custo**: vem preenchido quando o usuário
  tem `products.view`, `goods_entries.create` ou `goods_entries.edit` (ROOT
  sempre); para os demais vem `null`. A busca vai servir a telas futuras
  (venda, ordem de serviço), e um vendedor não deve enxergar a margem pela
  busca de produto.

#### Validators (VineJS, mensagens em pt-BR)

- Cabeçalho: como na Entrada de Serviço, trocando os 6 impostos por
  `icmsSt`, `ipi`, `freight`, `insurance`, `otherExpenses` (número `≥ 0`, 2
  casas, default 0).
- `items`: array, **mínimo 1**; cada `{ productId, quantity: string > 0 (4
  casas), unitPrice: string ≥ 0 (10 casas), discount ≥ 0 }`.
- `finalize`: `{ dueDates: array de data YYYY-MM-DD, mínimo 1 }`.
- `status`, `finalizedAt`, `operationDate` e `stockEffect` **não existem** no
  validator.

#### Endpoints

| Verbo + rota | Permissão | Efeito |
| ------------ | --------- | ------ |
| `GET /api/goods-entries` | `goods_entries.view` | Lista paginada com filtros e `netAmount`. |
| `POST /api/goods-entries` | `goods_entries.create` | Cria cabeçalho + itens (transação). |
| `GET /api/goods-entries/:id` | `goods_entries.view` | Cabeçalho **com os itens** (`productDescription`, `unitOfMeasure`, `lineTotal`, `stockEffect`). |
| `PUT /api/goods-entries/:id` | `goods_entries.edit` | Atualiza; itens em bloco. Só `open`. |
| `DELETE /api/goods-entries/:id` | `goods_entries.delete` | Apaga itens + entrada. Só `open`. |
| `GET /api/goods-entries/:id/finalize-preview` | `goods_entries.finalize` | Resumo, parcelas sugeridas e efeitos por produto. Só `open`. Não grava nada. |
| `POST /api/goods-entries/:id/finalize` | `goods_entries.finalize` | `{ dueDates }` → títulos + estoque + custo + ativos (transação). |
| `POST /api/goods-entries/:id/cancel` | `goods_entries.cancel` | Desfaz tudo (transação) ou 422. |
| `GET /api/products/lookup` | — (auth + tenant) | Busca de produto do `EntityPicker`. |

Serialização do cabeçalho: colunas + `itemsTotal`, `additions`, `netAmount`,
`supplierName`, `documentTypeName`, `paymentTypeName`.

#### Erro de FK

Excluir **produto**, tipo de documento, tipo de pagamento ou fornecedor usado
por uma entrada → `23503` → **409** em pt-BR. Excluir um **ativo** gerado por
entrada pela tela de Ativos continua permitido (o FK é do ativo para a
entrada, não o contrário).

#### Seeder

As 6 permissões novas.

### Frontend

`src/modules/goods-entries/`:

| Arquivo | Responsabilidade |
| ------- | ---------------- |
| `goods-entries-page.tsx` | Listagem, filtros, menu Ações, diálogos. |
| `goods-entry-form-page.tsx` | Rota dedicada — new / edit / view (`readOnly`). |
| `goods-entry-items-section.tsx` | Sub-form + tabela de produtos. |
| `goods-entry-status-badge.tsx` | Aberta / Finalizada / Cancelada. |
| `finalize-goods-entry-dialog.tsx` | Resumo do preview + tabela de parcelas com vencimento editável. |

- **API client**: `src/services/goods-entries-api.ts`; `productLookupApi` em
  `lookup-api.ts`.
- **EntityPicker**: `productSource` em `entity-sources.ts` (sublabel
  `#id · Ativo/Consumo · Un.`) + linha em `ENTITY_SOURCES`.
- **QueryKeys**: `['goods-entries', companyId, filtros]`,
  `['goods-entry', companyId, id]`,
  `['goods-entry-finalize-preview', companyId, id]`.
- **Invalidação**: finalizar e cancelar invalidam `goods-entries`, `payables`,
  `products` e `product-assets` da empresa.
- **Itens** em `useFieldArray`, enviados no submit.
- **Componentes reusados**: `PageHeader` (ícone `PackagePlus`), `ConfirmDialog`,
  `EmptyState`, `MaskedInput`, `EntityPicker`, `useSearchFilters`.
- **Datas**: `formatIsoDate`.
- **Menu** (`permissions/menu.ts`): grupo **Mercadoria** (`ArrowLeftRight`)
  depois de **Serviços**, folha "Entrada de mercadoria". Manter a invariante de
  scroll da sidebar (`min-h-0`).
- **Router**: `/goods-entries`, `/goods-entries/new`, `/goods-entries/:id/edit`,
  `/goods-entries/:id`, em `PermissionRoute`.
- **Produtos**: "Preço de custo" com `maskDecimalPrice`/`formatDecimalPrice`;
  estoque e mínimo com 4 casas.

## Critérios de aceite

- [ ] Migrations rodam `up`/`down` limpas: `goods_entries`, `goods_entry_items`
      (com a unicidade `(goods_entry_id, product_id)`), `goods_entry_id`
      nullable em `payables` e `product_assets`, e a ampliação de `products`
      sem alterar valores existentes.
- [ ] Catálogo com as 6 permissões `goods_entries.*`; `module-labels.ts` com
      `goods_entries: 'Entradas de mercadoria'`.
- [ ] Menu com o grupo **Mercadoria** depois de **Serviços**; só aparece com
      `goods_entries.view`.
- [ ] Listagem com filtro de data da operação no mês corrente por default;
      todas as colunas ordenam; "Valor da entrada" exibe e ordena pelo
      `netAmount`.
- [ ] Formulário em rota dedicada com 4 seções; `/goods-entries/:id` tudo
      desabilitado.
- [ ] O `EntityPicker` de produto acha por descrição e por código, só ativos;
      escolher o produto preenche o preço com o `cost_price`.
- [ ] Adicionar o mesmo produto duas vezes: a tela avisa e não adiciona; o
      backend responde 422.
- [ ] Item com quantidade **2,53** e preço **3,4567** grava exatamente esses
      valores e exibe total **R$ 8,75** (`round(8.745451, 2)`).
- [ ] Item de produto `fixed_asset` com quantidade **1,5** → 422; com **1000** → 422.
- [ ] Salvar sem produtos → 422; desconto do item maior que o total da linha →
      422; desconto da NF-e maior que o total dos produtos → 422.
- [ ] O preview devolve `netAmount = totalProdutos − desconto + ST + IPI +
      frete + seguro + outras` e as parcelas sugeridas mês a mês.
- [ ] Finalizar com vencimentos editados (13/11, 20/12, 13/01) gera os títulos
      com **essas** datas; vencimento anterior à emissão ou à parcela anterior →
      422; quantidade de datas diferente de `installment_count` → 422.
- [ ] Rateio: R$ 12.500,00 em 3 → 4.166,66 / 4.166,66 / **4.166,68**; soma
      exata.
- [ ] Títulos com `goods_entry_id`, `installment` ordinal e `notes` *"Título
      gerado a partir da entrada de mercadoria: {id} com o tipo de pagamento:
      {NOME}"*; com `auto_settlement`, nascem **Pagos** com baixa na data do
      vencimento.
- [ ] Produto com estoque 10 a custo 3,00 recebendo 10 a 4,00 → estoque **20**,
      custo **3,50**. Com estoque 0 (ou negativo), o custo vira o da entrada.
- [ ] Custo da entrada é líquido do desconto do item: 10 un. a 4,00 com R$ 5,00
      de desconto → custo de entrada **3,50** (`(40,00 − 5,00) ÷ 10`).
- [ ] Produto sem controle de estoque: saldo segue `null`; custo = último custo.
- [ ] Produto ativo com quantidade 3: cria **3** `product_assets` disponíveis,
      com a descrição do produto, código vazio e `goods_entry_id`; saldo não
      muda; custo = último custo.
- [ ] Item com preço zero: estoque/ativos aplicados; `cost_price` inalterado.
- [ ] Cada item finalizado tem `stock_effect` gravado.
- [ ] Qualquer erro na finalização → **nada** persiste (títulos, saldo, custo,
      ativos, status).
- [ ] Cancelar entrada finalizada: títulos cancelados com baixas excluídas,
      estoque estornado, ativos gerados excluídos, entrada **Cancelada**; custo
      não volta.
- [ ] Cancelar com ativo gerado **alocado** → 422 nomeando ativo e produto;
      com estorno que deixaria saldo negativo → 422 nomeando o produto; com
      produto `stock` que deixou de controlar estoque → 422. Em todos, **nada**
      muda.
- [ ] Cancelada é terminal: editar / finalizar / re-cancelar / excluir → 422.
- [ ] Excluir produto, tipo de documento, tipo de pagamento ou fornecedor em uso
      → 409 em pt-BR.
- [ ] Perfil sem `goods_entries.finalize` não vê a ação e recebe 403 no
      endpoint (e no preview); idem `cancel`.
- [ ] `GET /products/lookup` funciona para perfil **sem** `products.view`; o
      `costPrice` vem preenchido só com `products.view` ou
      `goods_entries.create`/`edit`, e `null` sem elas.
- [ ] Tela de Produtos: estoque/mínimo com 4 casas; preço de custo com até 10
      casas no formulário e até 4 casas significativas na listagem; nenhum
      valor existente muda.
- [ ] `#utils/decimal.ts` com testes unitários (escala, half-up, divisão).
- [ ] Multitenant: nada de outra empresa aparece ou é aceito.
- [ ] `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) passam.

## Brechas e considerações — resolvidas

Confirmadas pelo usuário em 2026-10-23, já incorporadas ao corpo da spec:

| # | Ponto | Decisão |
| - | ----- | ------- |
| 1 | Quantidade de ativo sem teto | **Teto de 999** por item de produto ativo (422 acima disso). |
| 2 | Custo exposto no lookup sem gate | `costPrice` **só** para quem tem `products.view` ou `goods_entries.create`/`edit`; `null` para os demais. |
| 3 | "Valor da entrada" na listagem | **Total da nota** (com frete, ST, IPI, outras, menos descontos) — como o Delphi já mostra. Diferente da Entrada de Serviço, de propósito. |
| 4 | Custo editável em Produtos | **Continua editável** — válvula de correção, como no Delphi. Entra no próximo médio como custo vigente. |
| 5 | Escala do custo na tela | Banco e formulário com **10 casas**; listagem de Produtos com **até 4 casas significativas** (mín. 2). |
