# Análise: Saída de Mercadoria (brainstorm)

> Registro do brainstorm de 2026-10-27, feito sobre o código-fonte e o banco do
> Delphi (MPM System). A spec que sai daqui é
> [003-criar-tela-saida-de-mercadoria.md](003-criar-tela-saida-de-mercadoria.md).
> A análise foi pausada no meio para criar o pré-requisito
> [Funcionários](../cadastros/019-criar-tela-funcionarios.md) e retomada no
> mesmo dia.

## Contexto

A saída de mercadoria controla o **almoxarifado**: quem levou quais produtos de
uso e consumo, e quais ferramentas saíram com qual funcionário e voltaram no
fim do expediente. Fica no grupo de menu **Mercadoria**, junto da Entrada de
Mercadoria.

## Como funciona no Delphi

Fontes: `UFrmSaidaMercadoria.pas` (tela), `UFrmFinalizarSaida.pas` (diálogo de
finalização), `clsSaidaMercadoria.pas` (entrega, devolução, checagens),
`UFrmRelSaidaMercadoria.pas` (protocolo).

### Tabelas

`RPS_REQUISICOES_REQ` (cabeçalho):

```sql
REQ_COD INTEGER NOT NULL, USU_LOGIN VARCHAR(30), RPS_DT_REGISTRO DATE,
FUN_COD INTEGER,  -- FK CAD_FUNCIONARIO_FUN
PAT_COD INTEGER,  -- FK CAD_PRODUTOS_ATIVOS_PAT
REQ_OBSERVACAO VARCHAR(100),
REQ_FLG_STATUS VARCHAR(1),  -- A aberto, F finalizado, E entregue, D devolvido
REQ_TIPO_SAIDA VARCHAR(1)   -- N normal, F ferramenta
```

`RPS_REQUISICOES_ITENS_RQI` (itens), PK `(REQ_COD, PRD_COD)`:

```sql
RQI_VALOR_REQUISICAO NUMERIC(15,2), RQI_VALOR_CONSUMO NUMERIC(15,2),
RQI_QTD_REQUISICAO NUMERIC(15,2), RQI_QTD_CONSUMO NUMERIC(15,2)
```

### Fluxos

| Tipo | Status | Efeito no estoque |
| --- | --- | --- |
| Normal (`N`) | Aberto → Finalizado | Na finalização, `PRD_QTD -= qtd consumida`. O requisitado e não consumido nunca sai do estoque. |
| Ferramenta (`F`) | Aberto → Entregue → Devolvido | Entregar: `PRD_QTD -= qtd requisitada` (bloqueia se algum item tem requisitado > estoque). Devolver: `PRD_QTD += qtd requisitada`. Sem devolução parcial. |

- **Consumidor**: ativo (`PAT_COD`) **ou** funcionário (`FUN_COD`), escolhido
  por um combo "Tipo de consumidor". A lista de ativos mostra
  `produto - ativo - patrimônio` (ou "FALTA DEFINIR PATRIMONIO").
- **Produtos**: a saída normal só aceita produtos tipo `U` (uso e consumo); a
  de ferramenta só tipo `F`. Ferramenta com custo zero é recusada.
- **Valores**: requisitado = qtd × custo do produto ao incluir o item;
  consumido = qtd consumida × custo na finalização.
- **Finalizar**: diálogo com estoque, qtd requisitada e campo de consumo
  lançado item a item (começa em 0); consumo ≤ requisitado e ≤ estoque;
  transação única; abre o protocolo ao terminar.
- **Excluir**: só se não finalizada. **Não existe cancelamento.**
- **Protocolo**: relatório com cabeçalho da empresa, código de barras do nº da
  saída, data/hora, consumidor e itens (qtd requisitada e consumida). Só para
  saídas entregues, devolvidas ou finalizadas.

### Dados reais (`Dados/MARCA_CONST.FDB`, 2026-10-27)

- 1 saída (normal, finalizada, consumidor funcionário) — a dos prints do
  usuário.
- Produtos: 44 `U` (todos controlam estoque), 1 `A`, **0 `F`**.
- 1 funcionário.

### Achados

1. **Precisão**: quantidades `NUMERIC(15,2)` no Delphi; o web usa
   `decimal(15,4)` no estoque desde a Entrada de Mercadoria.
2. **Tipo Ferramenta** não existe no web (`products.type` só tem `consumable`
   e `fixed_asset`).
3. **Saída Avulsa** (`UFrmSaidaAvulsaMercadoria`, com motivo de saída) é outra
   tela do Delphi — fora deste escopo.
4. O sub-cadastro **Ferramentas do funcionário** (`CAD_FERRAMENTAS_FUNC_FFU`)
   ficou de fora do cadastro de Funcionários: a saída de Ferramenta é quem
   controla isso agora.

## Decisões tomadas

1. **Funcionário** — cadastro próprio, criado antes desta tela
   ([spec 019](../cadastros/019-criar-tela-funcionarios.md)).
2. **Ferramenta** — novo valor `tool` em `products.type` (como o Delphi). Na
   Entrada de Mercadoria, ferramenta soma estoque e recalcula custo médio como
   o consumo.
3. **Sem cancelamento** — igual ao Delphi. Finalizada e devolvida são
   terminais; só a aberta se exclui.
4. **Ativo consumidor** — qualquer ativo, menos os **vendidos**.
5. **Saída de Ferramenta** — consumidor **só funcionário**.
6. **Só produtos que controlam estoque** entram na saída; ferramenta sempre
   controla estoque.
7. **Impressão = PDF em nova aba** — regra para o sistema inteiro, definida
   pelo usuário. O protocolo é o primeiro PDF do sistema.
8. **Entidade única** `goods_exits` com `exit_type` (`normal` | `tool`).
9. **PDF no backend** com pdfmake, com um helper de cabeçalho reaproveitável.
10. **Consumo pré-preenchido** com o requisitado (limitado ao estoque) no
    diálogo de finalização, em vez de começar em 0.
11. **Custo zero na ferramenta** continua recusado, como no Delphi.
12. **Sem código de barras** no protocolo — ninguém lê o código com leitor.
13. A pendência **"Devolução de material"** do `state.md` fica resolvida: na
    saída normal o não consumido nunca sai do estoque; na de ferramenta a
    devolução é a ação Devolver.
