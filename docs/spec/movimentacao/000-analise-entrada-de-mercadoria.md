# Análise: Entrada de Mercadoria (brainstorm)

> **Status**: brainstorm **concluído** — a spec é
> [001-criar-tela-entrada-de-mercadoria.md](001-criar-tela-entrada-de-mercadoria.md).
> Este arquivo **não é a spec**. Registra as decisões já tomadas
> com o usuário e a análise do sistema Delphi legado (banco e código-fonte). A
> spec de implementação (`001-criar-tela-entrada-de-mercadoria.md`) será escrita
> a partir daqui quando o brainstorm terminar.
>
> **Iniciado em**: 2026-10-13. **Atualizado em**: 2026-10-14.

## Contexto

Port da tela **Entrada de Mercadoria** do sistema Delphi (MPM System) para o
MPM Web. O usuário lança a nota fiscal de compra de um fornecedor — cabeçalho,
totais da nota, condição de pagamento e produtos — e a entrada nasce **aberta**.
Uma ação separada, **Finalizar Entrada**, produz os efeitos:

1. gera os títulos em **contas a pagar**;
2. dá **entrada no estoque** dos produtos que controlam estoque;
3. **cadastra os ativos** dos produtos do tipo ativo imobilizado.

Campos do cabeçalho (tela Delphi): tipo de documento, número, série, sub-série,
data de emissão, fornecedor, valor de desconto da NF-e; totais da nota (ICMS
ST, IPI, frete, seguro, outras despesas); pagamento (tipo de pagamento,
quantidade de parcelas, 1º vencimento). Itens: produto, quantidade, preço,
desconto. Filtros da listagem Delphi: número do documento, fornecedor, código
da entrada, intervalo de data da operação, status (todos/abertos/finalizados).

## Decisões tomadas

### 1. Irmã da Entrada de Serviço

Segue o modelo de [Entrada de Serviço](../servicos/001-criar-tela-entrada-de-servico.md):

- Ciclo **aberta → finalizada → cancelada**, sem reabertura; só `open` edita/exclui.
- Reaproveita `splitInstallments`, `installmentDueDates`,
  `PayableService.createFromSource`, `auto_settlement` e a transação única.
- `payables` ganha a coluna de origem `goods_entry_id` (nullable, `RESTRICT`),
  seguindo "uma coluna por origem".
- Listagem espelha a da Entrada de Serviço (código, número, fornecedor, data da
  operação marcada no mês corrente, status — com *Cancelada* além de
  Aberta/Finalizada).

### 2. Valor dos títulos

```txt
valor = Σ itens − desconto da NF-e + ICMS ST + IPI + frete + seguro + outras despesas
```

Na nota de mercadoria, ST e IPI **somam** (não são retenção, como na de
serviço). Confere com o exemplo do Delphi: R$ 12.500,00 em 3 parcelas → 1ª de
R$ 4.166,67.

### 3. Vencimentos editáveis na finalização

O diálogo de finalizar mostra a **tabela de parcelas já preenchida** pelo cálculo
mensal (1º vencimento + `i` meses) — ordem, valor, vencimento — e cada **data é
editável** antes de confirmar (como a "Confirmação de Entrada" do Delphi). O
backend recebe as datas e valida quantidade e ordem crescente.

**Replicar na Entrada de Serviço** — aprovado pelo usuário, em spec separada.

### 4. Efeito por tipo de produto

Na finalização, cada item cai em um de três casos, conforme `type` e
`controls_stock` do produto:

| Produto | Estoque | Ativos | Custo |
| --- | --- | --- | --- |
| `consumable` + `controls_stock = true` | `quantity_in_stock += qtd` | — | **custo médio ponderado** |
| `consumable` + `controls_stock = false` | não mexe (segue `null`) | — | **último custo** |
| `fixed_asset` | não mexe | **1 ativo por unidade** | **último custo** |

- **Ativo** (opção A): cria um `product_assets` por unidade, com a descrição do
  produto, situação *Disponível*, código de patrimônio em branco (preenchido
  depois na tela de Ativos) e `goods_entry_id` apontando a entrada de origem
  (coluna nova, nullable). Respeita a regra existente "ativo ⇒ não controla
  estoque". Quantidade de item de produto ativo deve ser **inteira** (422).
  (O Delphi grava descrição **e** código de patrimônio como `ATIVO <id>` — o
  web prefere a descrição do produto e o código vazio, que é o que o usuário
  vai preencher de verdade.)
- **Custo** (decisão 14, opção A): **médio ponderado** para quem controla
  estoque — `((estoque × custo atual) + (qtd × custo unitário da entrada)) ÷
  (estoque + qtd)`, com quantidades decimais, custo unitário **líquido do
  desconto do item** e sem arredondar a 2 casas; se o estoque atual for ≤ 0, o
  custo passa a ser o da entrada. **Último custo** para consumo sem estoque e
  ativo (não há saldo para ponderar). Frete, IPI e ST **não** são rateados; o
  custo **não volta** no cancelamento. Corrige três defeitos do Delphi
  (`AsInteger` nas quantidades, desconto ignorado, arredondamento a 2 casas).
- Saldo ajustado com `quantity_in_stock + X` no SQL, nunca ler-somar-gravar.
- `forUpdate()` nos produtos em **ordem crescente de id**, na mesma transação
  dos títulos.
- `quantity_in_stock` continua **imutável** no formulário de Produtos — passa a
  ser movido pelas entradas (e futuramente saídas).
- **Sem kardex** (tabela de movimentação de estoque) nesta spec: o rastro fica
  nos itens das entradas finalizadas. Kardex fica para quando vier a saída.

### 5. Cancelamento (opção A — bloqueia quando não dá para desfazer limpo)

"Desfaz tudo": cancela os títulos (mesma mecânica da Entrada de Serviço —
apaga baixas, zera `paid_amount`, `status = 'cancelled'`), estorna o estoque e
exclui os ativos gerados. **Bloqueia com 422** e mensagem nomeando o
produto/ativo quando:

- algum ativo gerado (`goods_entry_id = entry.id`) não está mais *Disponível*;
- o estorno deixaria algum produto com estoque negativo.

Ativo apenas editado (código, marca), mas ainda *Disponível*, pode ser excluído.
(O Delphi não tem cancelamento: entrada finalizada simplesmente não pode ser
excluída.)

### 6. Precisão numérica (opção A — alinhada à NF-e)

Referência NF-e 4.00 por item: `qCom` até 4 casas, `vUnCom` até 10 casas,
`vProd` e `vDesc` em centavos (`vProd = round(qCom × vUnCom, 2)`).

| Campo | Tipo proposto |
| --- | --- |
| Quantidade do item | `decimal(15,4)` |
| Preço unitário do item | `decimal(20,10)` — UI mostra casas significativas, mín. 2 |
| Desconto do item / campos monetários do cabeçalho | `decimal(12,2)` |
| Total da linha | **derivado, nunca gravado**: `round(qtd × preço, 2) − desconto` |
| `products.quantity_in_stock` / `minimum_stock` | ampliar `decimal(12,3)` → `decimal(15,4)` |
| `products.cost_price` | ampliar `decimal(12,2)` → `decimal(20,10)` |

Cálculos com **aritmética decimal exata** (inteiros escalados), nunca `number`
de JavaScript. As ampliações em Produtos exigem migration e ajuste da máscara
de quantidade/custo na tela de Produtos.

### 7. Produto único por entrada (opção A — como o Delphi)

O mesmo produto **não** pode aparecer duas vezes na entrada. A tela impede
adicionar de novo; o backend responde 422; unicidade `(goods_entry_id,
product_id)` no banco. Se a NF-e trouxer o produto em duas linhas, o usuário
consolida (soma quantidades, preço = total ÷ quantidade). Mantém coerência com
o legado e simplifica custo e estorno (um efeito por produto).

### 8. Menu: grupo novo **Mercadoria** (decidido B "Movimentação", renomeado pelo usuário em 2026-10-23)

Grupo de menu **Mercadoria**, item "Entrada de mercadoria". Vai abrigar as
demais telas `MOV_*` do Delphi (saída avulsa, requisições, inventário…). Specs
em `docs/spec/movimentacao/`. Permissões
`goods_entries.view/create/edit/delete/finalize/cancel`; rótulo
`goods_entries: 'Entradas de mercadoria'`.

### 9. Produto via `EntityPicker` (opção A)

Busca no servidor como as demais pesquisas de grande volume do sistema: fonte
nova `product` no registry do `EntityPicker` e endpoint `GET /products/lookup`
(descrição ou código; só ativos na busca; hidratação traz inativo com sufixo).
Sublabel com código, tipo e unidade.

### 10. Preço pré-preenchido com o custo (opção A)

Ao escolher o produto, o preço unitário vem com o `cost_price`, editável.

### 11. Item com custo zero não mexe no custo (opção A)

Bonificação/brinde: entra no estoque / gera ativo, mas **não** atualiza o
`cost_price` (nem entra no cálculo do custo médio, se a dúvida 14 for por ele).

### 12. Efeito gravado no item (opção A)

A finalização grava no item o efeito aplicado — `stock_effect`: `stock` /
`none` / `asset`. O cancelamento usa esse registro, não o estado atual do
produto. Se o item teve efeito `stock` e o produto hoje não controla estoque,
o cancelamento é **bloqueado** (422) nomeando o produto.

### 13. Dados legados fora de escopo (opção A)

A migração das entradas do Delphi (e dos demais dados) será um projeto à parte.

## Decisões herdadas por padrão (confirmar só se discordar)

Vêm da [Entrada de Serviço](../servicos/001-criar-tela-entrada-de-servico.md)
e da análise acima; seguem assim, salvo objeção:

- **Data da operação** gravada com `todayIso()` no create, **não editável**.
- **Cancelar entrada aberta** é permitido (fica Cancelada, sem efeitos).
- **1º vencimento anterior à emissão** bloqueia (422) — e, com as datas
  editáveis da decisão 3, **cada** vencimento ≥ emissão.
- **Sem unicidade** de número de nota — lançar duas vezes gera títulos em dobro.
- **`auto_settlement`** do tipo de pagamento baixa os títulos na finalização,
  na data de **vencimento** de cada parcela (como a Entrada de Serviço; o
  Delphi baixa na data da finalização).
- **Dependência de permissões**: `goods_entries.*` exige `document_types.view`
  e `payment_types.view` (Selects do form); fornecedor e produto via lookup
  sem gate.
- **Fornecedor**: qualquer fornecedor ativo, sem filtrar por `type`
  (`goods`/`service`) — um mesmo fornecedor pode vender os dois.
- **Produto inativo** não aparece na busca; item já lançado com produto que
  ficou inativo ainda finaliza (a compra aconteceu).
- **Kardex** (histórico de movimentação de estoque) fora de escopo.
- **Rateio** de frete/IPI/ST no custo fora de escopo.
- **Importação de XML da NF-e** e **impressão** fora de escopo.
- **Parcelas**: `splitInstallments` — iguais por `floor`, resíduo na última
  (o Delphi arredonda e joga a diferença na última; mesmo efeito prático).

## Dúvidas resolvidas depois da leitura do código-fonte (14 e 15)

> Ambas decididas: 14 → **A** (registrada na decisão 4); 15 → **A** (devolução
> fora desta spec, ver abaixo).

Surgiram da leitura de `UFrmEntradaMercadoria.pas` (rotina
`acFinalizarExecute`) e `clsAtivo.pas` (`IncluirAtivoEntrada`).

### 14. Custo do produto na finalização ✅ *decidido: A*

O que o Delphi faz de fato:

| Produto | Custo no Delphi |
| --- | --- |
| Consumo + controla estoque | **custo médio ponderado**: `((estoque × custo atual) + (qtd entrada × preço)) ÷ (estoque + qtd entrada)`, arredondado a 2 casas |
| Consumo sem controle de estoque | não mexe |
| Ativo | não mexe |

Defeitos do cálculo no Delphi: usa `AsInteger` nas quantidades (2,53 m vira 2
na conta do médio), ignora o desconto do item, e arredonda o custo a 2 casas.

- **A (recomendado)** — **médio ponderado** para produto que controla
  estoque (corrigido: quantidades decimais, preço líquido do desconto do item,
  sem arredondar a 2 casas; se o estoque atual for ≤ 0, o custo vira o da
  entrada) e **último custo** para os demais (consumo sem estoque e ativo),
  que não têm saldo para ponderar.
- **B** — fiel ao Delphi: médio ponderado só para quem controla estoque;
  consumo sem estoque e ativo **não mexem** no custo.
- **C** — último custo para todos (decisão original, tomada com base na
  leitura errada de um print — o produto do print era um ativo, que o Delphi
  não atualiza).

### 15. Entrada de devolução ✅ *decidido: A — fora desta spec*

O Delphi tem um segundo tipo de entrada: quando o **tipo de documento tem
código 99**, a tela entra em modo **devolução** (`TPDevolucao`) — desabilita
série, sub-série, fornecedor, desconto, impostos, frete, seguro, outras e
pagamento. Na finalização, a devolução **só soma o estoque** (sem custo médio,
sem ativos, sem títulos).

O web não tem "código" em tipo de documento (`document_types` é só descrição +
status), então o gatilho do Delphi não se traduz diretamente.

- **A** — **fora desta spec**: a primeira entrega cobre só a entrada de
  compra; devolução vira spec própria quando houver a tela de saída (é a volta
  do que saiu).
- **B** — incluir agora, como um campo **tipo de entrada** no cabeçalho
  (*Compra* / *Devolução*), em vez de depender de um código mágico no tipo de
  documento.

**Decisão (A)**: fora desta spec. Dados do Delphi: o tipo 99 "DEVOLUÇÃO"
existe, mas **nenhuma** das 31 entradas o usou, e saída avulsa
(`MOV_SAIDA_MERCA_AVULSA_SMA`) e requisições (`RPS_REQUISICOES_REQ`) têm **zero**
registros — o estoque hoje só entra. A devolução é "o material que saiu e
voltou sem ser consumido" (ex.: técnico leva 20 m de fio, usa 15, devolve 5).

**⚠️ Retomar quando chegarem as telas de saída avulsa e requisição** (grupo
Mercadoria): lá a devolução deve nascer **vinculada à saída de origem**
("devolver itens desta saída"), não como entrada solta. Efeito esperado, como
no Delphi: só soma estoque — sem custo médio, sem ativos, sem títulos.

Achado lateral para a futura migração: 4 entradas de mercadoria do Delphi têm
tipo de documento NFSE (nota de serviço) — provável lançamento na tela errada.

## Análise do banco Delphi (`MARCA_CONST.FDB`, Firebird 2.5)

O arquivo fica em `database_erp/` (ignorado pelo git). Metadados extraídos com
`isql -x` do Firebird 2.5 instalado no Windows, sobre uma **cópia** do arquivo.

### Tabelas da entrada

`MOV_ENTRADA_MERCADORIA_EME` (cabeçalho):

```sql
EME_COD INTEGER NOT NULL, EME_NUM_DOC VARCHAR(20), TPD_COD INTEGER,
EME_DTA_EMISSAO DATE, EME_DTA_OPERACAO DATE, FOR_COD INTEGER, TPG_COD INTEGER,
EME_FLG_STATUS VARCHAR(1) DEFAULT 'A', EME_PRIMEIRO_VENCTO DATE,
EME_SERIE VARCHAR(20), EME_SUB_SERIE VARCHAR(20), EME_QTD_PARC INTEGER,
EME_VLR_IPI NUMERIC(15,2), EME_VLR_FRETE NUMERIC(15,2), EME_VLR_SEGURO NUMERIC(15,2),
EME_VLR_OUTRAS NUMERIC(15,2), EME_VLR_ICMS_ST NUMERIC(15,2), EME_VLR_DESCONTO_NF NUMERIC(15,2)
```

`MOV_ENTRADA_ITENS_EIT` (itens), PK `(EME_COD, PRD_COD)`:

```sql
EME_COD INTEGER NOT NULL, PRD_COD INTEGER NOT NULL,
EIT_VALOR_UNITARIO_COMPRA NUMERIC(14,5), EIT_VALOR_DESCONTO NUMERIC(15,2),
EIT_VALOR_TOTAL NUMERIC(15,2), EIT_QTD_ENTRADA NUMERIC(14,5)
```

### Tabelas relacionadas (só estrutura)

- `CAD_PRODUTOS_PRD`: `PRD_QTD NUMERIC(15,2)`, `PRD_ESTOQUE_MIN INTEGER`,
  `PRD_PRECO_CUSTO NUMERIC(15,2)`.
- `CAD_PRODUTOS_ATIVOS_PAT`: **sem** coluna de entrada de origem.
- `MOV_CONTAS_PAGAR_CPG`: tem `EME_COD` (FK para a entrada) — mesma ideia do
  nosso `goods_entry_id`.

### Dados reais (consulta em `MOV_ENTRADA_ITENS_EIT`)

- 62 itens em 31 entradas (1 aberta, 30 finalizadas).
- **11 itens com quantidade fracionada**, incluindo `0,8334` (4 casas).
- **3 preços com mais de 2 casas**, incluindo `75,7729` (4 casas).
- Maior preço unitário: R$ 29.040,00.

### Achados

1. **Bug de precisão no Delphi**: o item aceita 5 casas na quantidade, mas
   `PRD_QTD` guarda só 2 — entrada de 0,8334 vira 0,83 no saldo. O web não deve
   repetir isso (decisão 6).
2. **Produto único por entrada** no Delphi (PK do item) — ver decisão 7.
3. **Ativo sem rastro da origem** no Delphi — o cancelamento lá não tinha como
   desfazer ativos. Resolvido no web por `product_assets.goods_entry_id`.
4. No Delphi, os ativos são **gerados no ato da finalização** (confirmado pelo
   usuário).
5. **Código-fonte** (`C:\Projetos Extras\MPMSystem\Source\src`): a finalização
   fica em `UFrmEntradaMercadoria.pas` (`acFinalizarExecute`), numa transação
   única. Custo médio ponderado só para consumo com estoque; ativos criados
   por `IncluirAtivoEntrada` (`clsAtivo.pas`), um por unidade, com descrição e
   código `ATIVO <id>`; títulos com emissão = data da finalização e, com baixa
   automática, baixa na data da finalização. Modo **devolução** quando o tipo
   de documento tem código 99 (dúvida 15).
6. **Dados de produto** no Delphi: 44 produtos de consumo (todos controlam
   estoque) e 1 ativo; 1 ativo cadastrado, gerado pela finalização.
