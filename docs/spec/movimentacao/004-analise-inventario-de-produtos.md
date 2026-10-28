# Análise: Inventário de Produtos (levantamento)

> Levantamento de 2026-10-27, feito sobre o código-fonte e o banco do Delphi
> (MPM System). Traça o paralelo entre o que existe no legado e o que se propõe
> no MPM Web. A spec de implementação sai daqui, com as **decisões tomadas**
> registradas no fim do documento.

## Contexto

O inventário serve para **acertar o estoque físico com o do sistema**. O usuário
abre um inventário, que tira uma foto do saldo dos produtos que controlam
estoque. Depois ele conta as prateleiras e lança as quantidades, confere as
divergências e, ao **fechar**, as contagens passam a ser o saldo dos produtos.
A tela fica no grupo de menu **Mercadoria**, depois da Entrada e da Saída de
mercadoria.

## Como funciona no Delphi

Fontes:

- `UFrmInventario.pas`: listagem, abertura, exclusão e fechamento.
- `UFrmInventarioContagem.pas`: tela de contagem.
- `clsInventario.pas`: regras.
- `UFrmRelContagemInventario.pas`: relatório de contagem.
- `UFrmRelInventario.pas`: listagem impressa dos inventários.

### Tabelas

`MOV_INVENTARIO_INV` (cabeçalho):

```sql
INV_COD INTEGER NOT NULL,          -- PK, sequence
INV_DTA_ABERTURA DATE,             -- informada pelo usuário (default hoje)
INV_DTA_FINALIZACAO DATE,          -- data do fechamento
INV_FLG_STATUS VARCHAR(1)          -- A aberto, F finalizado
```

`MOV_INVENTARIO_DETALHE_IND` (um registro por produto):

```sql
IND_COD INTEGER NOT NULL,          -- PK, sequence
INV_COD INTEGER,                   -- FK MOV_INVENTARIO_INV
PRD_COD INTEGER,                   -- FK CAD_PRODUTOS_PRD
IND_QTD_EST INTEGER,               -- foto do saldo na abertura
IND_QTD_CONT INTEGER               -- quantidade contada (nasce 0)
```

Os grupos escolhidos na abertura **não são gravados**. Eles só filtram os
produtos que entram no detalhe.

### Tela principal: Inventário de Produtos

- **Filtros**: período da data de abertura ("De" e "Até", marcados no mês
  corrente) e status (Abertos, Fechados ou Todos). Ordenação pela data de
  abertura, decrescente.
- **Grid**: Código do inventário, Data de abertura, Data de finalização e
  Status.
- **Incluir**: só se **não existir nenhum inventário aberto**. Caso exista, a
  mensagem é *"Já existe um inventário em aberto."*. O formulário tem:
  - Código (automático).
  - Data de abertura (default hoje, editável).
  - Combo Grupo de produto. "-- TODOS --" é o default; os demais itens são
    os grupos **ativos**.
  - Botões +/− para montar a lista **Grupos escolhidos**.

  Com "Todos", entram todos os produtos com `PRD_FLG_MOVIMENTA_ESTOQUE = 'S'`.
  Com grupos, entram só os desses grupos; escolher grupo e não adicionar
  nenhum gera o aviso *"Você não informou nenhum grupo…"*. Tudo roda em uma
  transação: cria o cabeçalho e insere um detalhe por produto, com
  `IND_QTD_EST = PRD_QTD` e `IND_QTD_CONT = 0`.
- **Excluir**: bloqueado se finalizado (*"Inventário já finalizado."*). Confirma
  com *"Deseja realmente excluir o inventário e toda a sua contagem?"* e apaga
  o detalhe e o cabeçalho na mesma transação.
- **Contagem (F6)**: abre a tela de contagem. É bloqueado se finalizado, ou
  seja, **um inventário fechado não pode mais ser consultado**.
- **Fechar Inventário (F7)**: bloqueado se já finalizado. Confirma com
  *"Deseja realmente finalizar o ajuste de inventário? Atenção para os
  produtos com contagem zerada."*. Em uma transação:
  1. Para cada item, `PRD_QTD = IND_QTD_CONT`, um valor **absoluto**.
  2. O status vira `F` e `INV_DTA_FINALIZACAO` recebe a data de hoje.
- **Imprimir**: "Listagem dos Inventários", com o conteúdo do grid.
- **Não existe** edição do cabeçalho, cancelamento nem reabertura.

### Tela de contagem: Inventário Contagem

- **Cabeçalho**: código e data de abertura. Abaixo, Produto (código e
  descrição da linha selecionada) e o campo **Qtd. Cont.**.
- **Grid**: Código, Descrição e Qtd. contada, ordenado pela descrição. A coluna
  **Qtd. Estoque fica oculta**, ou seja, a contagem é **cega**: quem conta não
  vê o saldo do sistema.
- **Lançar contagem (F2)**: o foco vai para *Qtd. Cont.*, que aceita **só
  dígitos**. **Enter grava a linha e desce para a próxima**, então o usuário
  digita a contagem em sequência sem tirar a mão do teclado.
- **Zerar contagem (F3)**: confirma com *"Deseja realmente zerar toda a
  contagem?"* e põe `IND_QTD_CONT = 0` em todos os itens.
- **Verificar divergência (F4)**: recarrega o grid, **mostra a coluna Qtd.
  Estoque** e pinta de **vermelho** as linhas em que estoque ≠ contado.
- **Imprimir contagem (Ctrl+P)**: "Relatório de Contagem", com Código,
  Descrição, Qtd. estoque e Qtd. contada, e as divergentes destacadas. Imprime
  o que está carregado no grid. A ação se chama "Imprimir Divergências" e o
  botão "Imprimir Contagem": é o mesmo relatório.

### Dados reais (`database_erp/MARCA_CONST.FDB`, 2026-10-27)

- **1 inventário**, código 1, **aberto desde 2026-06-04 e sem nenhum item**
  (0 linhas no detalhe). Ele também bloqueia a abertura de outro.
- **Produtos**: 44 movimentam estoque e 1 não.
  - **8 têm saldo fracionado**, como TUBO COBREFLEX 5/8 com 5,20, GÁS R410A
    com 37,02 e ARRUELA LISA 1/4 com 0,83.
- **Grupos de produto**: 12.

### Achados

1. **O Delphi trunca tudo para inteiro.** As colunas são `INTEGER`, o código usa
   `AsInteger` e a contagem aceita só dígitos. Ao abrir, o saldo de 5,20 m de
   tubo vira foto 5. Ao fechar, o saldo vira o contado inteiro, e **os
   decimais se perdem**. Com 8 produtos fracionados na base real, isso é
   perda de dado. O MPM Web já usa `decimal(15,4)` no estoque.
2. **O fechamento sobrescreve o saldo.** O saldo vira o contado, não "saldo +
   diferença". Se houver entrada ou saída de mercadoria entre a abertura e o
   fechamento, esse movimento é apagado pelo ajuste. Nada impede movimentar
   estoque com inventário aberto.
3. **"Não contado" e "contado zero" são iguais.** A contagem nasce 0. Fechar
   sem contar um produto zera o estoque dele, e a única proteção é o texto
   "Atenção para os produtos com contagem zerada" na confirmação.
4. **Um inventário aberto por vez**, global. O Delphi é monoempresa.
5. **Entram produtos inativos.** O SQL filtra só `PRD_FLG_MOVIMENTA_ESTOQUE`,
   sem `PRD_FLG_ATIVO` e sem filtro por tipo.
6. **Inventário fechado não é consultável.** O botão Contagem é bloqueado
   depois de finalizar, e não sobra registro visível do que foi ajustado.
7. **O custo não é tocado.** O inventário mexe só na quantidade.
8. **Os grupos escolhidos não ficam gravados.** Depois de aberto, não dá para
   saber se o inventário foi total ou parcial.

## Paralelo: Delphi × MPM Web (proposta)

Onde a proposta muda o Delphi, está marcado **(muda)** e há um motivo.

| Aspecto | Delphi | MPM Web (proposta) |
| --- | --- | --- |
| Menu | Inventário de Produtos | **Mercadoria → Inventário de produtos** (`/inventories`) |
| Tabelas | `MOV_INVENTARIO_INV`, `MOV_INVENTARIO_DETALHE_IND` | `inventories` e `inventory_items`, multitenant (`company_id`), hard delete |
| Status | `A` aberto, `F` finalizado | `open` e `closed` (rótulos "Aberto" e "Fechado"); `closed` é terminal |
| Um aberto por vez | Global | **Por empresa**, garantido por índice parcial único `(company_id) WHERE status = 'open'` mais 422 com a mesma mensagem |
| Data de abertura | Editável, default hoje | `opening_date`, editável e default hoje (igual) |
| Data de fechamento | Hoje, no fechamento | `closed_at`, gravada no fechamento (igual) |
| Quem abriu | Não grava | `opened_by_user_id` **(muda)**, para rastro, como `requested_by_user_id` na saída |
| Produtos que entram | `MOVIMENTA_ESTOQUE = 'S'`, todos ou dos grupos escolhidos | `controls_stock = true`, todos ou dos grupos escolhidos (só grupos **ativos** no seletor). Ver decisão D |
| Grupos escolhidos | Não grava | Gravados em `inventory_product_groups` **(muda)** e exibidos no cabeçalho e no PDF ("Todos os grupos" ou a lista). Ver decisão F |
| Quantidades | `INTEGER` (trunca) | `decimal(15,4)` **(muda)**, igual a `products.quantity_in_stock`; entrada pt-BR (`5,2`) |
| Foto do saldo | `IND_QTD_EST` na abertura | `stock_quantity`, tirada na abertura (igual) |
| Contagem | `IND_QTD_CONT`, nasce 0 | `counted_quantity`. Ver decisão B |
| Editar cabeçalho | Não existe | Não existe (igual) |
| Excluir | Só se aberto, apaga contagem | Igual: só `open`, itens apagados na transação |
| Cancelar / reabrir | Não existe | Não existe (igual) |
| Contagem cega | Qtd. Estoque oculta até "Verificar divergência" | Igual. Ver decisão C |
| Lançar contagem | Campo único, Enter grava e desce | Coluna editável na tabela; **Enter grava a linha e vai para a próxima** (igual ao Delphi) |
| Zerar contagem | Põe 0 em tudo | Igual, com `ConfirmDialog` |
| Verificar divergência | Mostra estoque e pinta de vermelho | Botão que liga a coluna Estoque, a coluna **Diferença** e o destaque das divergentes, mais um filtro "só divergentes" **(muda, pequeno)** |
| Imprimir contagem | Relatório RL em preview | **PDF em nova aba** (regra do sistema), com cabeçalho da empresa e a mesma tabela (código, descrição, estoque, contado e divergência destacada) |
| Imprimir listagem | "Listagem dos Inventários" | Ver decisão F |
| Fechar | `PRD_QTD = contado` (absoluto), em transação | Transação com `forUpdate()` no inventário e nos produtos em ordem crescente de id. Regra do saldo: decisão A |
| Consultar fechado | Bloqueado | **Liberado em somente leitura** **(muda)**, com estoque, contado e diferença |
| Custo | Não toca | Não toca (igual) |
| Atalhos F2/F3/F4/F6/F7 | Sim | Não. O web não usa atalhos de função em nenhuma tela |

### Permissões propostas (`catalog.ts` + `module-labels.ts`)

Módulo `inventories`, rótulo pt-BR **"Inventários de produtos"**:

| Slug | Nome | Cobre |
| --- | --- | --- |
| `inventories.view` | Visualizar inventários | Listagem, contagem em leitura, PDF |
| `inventories.create` | Abrir inventário | Abertura, com a foto do saldo |
| `inventories.delete` | Excluir inventário | Excluir aberto |
| `inventories.count` | Lançar contagem | Lançar e zerar contagem |
| `inventories.close` | Fechar inventário | Aplicar as contagens no estoque |

`count` fica separado de `close` pelo mesmo motivo de `finalize` nas entradas:
quem conta a prateleira não é necessariamente quem ajusta o estoque.

### Endpoints propostos

- `GET|POST /inventories`, `GET|DELETE /inventories/:id`
- `GET /inventories/:id/items`: itens com produto. `stockQuantity` só vem
  com `?reveal=1`, para manter a contagem cega também na API.
- `PUT /inventories/:id/items/:itemId`: grava uma contagem (a do Enter)
- `POST /inventories/:id/reset-count`: zerar contagem
- `GET /inventories/:id/close-preview`: totais para o diálogo de fechamento
- `POST /inventories/:id/close`
- `GET /inventories/:id/count-sheet`: PDF da contagem

### Vínculos com o que já existe

- **Produto usado em inventário**: excluir o produto devolve 409 (FK
  `RESTRICT`), como nas entradas e saídas.
- **Grupo de produto**: a FK em `inventory_product_groups` também com
  `RESTRICT`.
- **Bloqueio de estoque**: reaproveita `lockProducts` e o padrão de
  `goods_exit_stock.ts`.
- **PDF**: reaproveita `pdf_service.ts` (`companyHeader`,
  `formatQuantityPtBr`).

## Ações da tela × permissão

Cada botão aparece só para quem tem a permissão (componente `Can`), e o endpoint
repete o mesmo gate. A UI nunca é a única barreira. Além da permissão, o
**status** também esconde a ação: o que muda dado só existe com `open`.

| Ação (tela) | Permissão | Status em que aparece | Endpoint (gate) |
| --- | --- | --- | --- |
| Menu Mercadoria → Inventário de produtos | `inventories.view` | — | `GET /inventories` |
| Novo inventário | `inventories.create` | Só sem outro aberto na empresa (o backend devolve 422 se houver) | `POST /inventories` |
| Excluir | `inventories.delete` | `open` | `DELETE /inventories/:id` |
| Contagem: abrir a tela | `inventories.view` | Qualquer; é somente leitura sem `count` ou com `closed` | `GET /inventories/:id/items` |
| Lançar contagem (Enter na linha) | `inventories.count` | `open` | `PUT /inventories/:id/items/:itemId` |
| Zerar contagem | `inventories.count` | `open` | `POST /inventories/:id/reset-count` |
| Verificar divergência | `inventories.view` | Qualquer (em `closed` já abre revelado) | `GET /inventories/:id/items?reveal=1` |
| Imprimir contagem (PDF) | `inventories.view` | Qualquer | `GET /inventories/:id/count-sheet` |
| Fechar inventário | `inventories.close` | `open` | `GET /inventories/:id/close-preview` e `POST /inventories/:id/close` (ambos em `close`) |

A ação **Verificar divergência** fica em `view`. Com isso, a contagem cega é
uma disciplina de tela, não um segredo: quem pode ver estoque pode ver o saldo
na tela de Produtos de qualquer forma. Se no futuro for preciso esconder o
saldo de quem só conta, basta criar uma permissão `inventories.reveal`.

## Decisões tomadas (usuário, 2026-10-27)

- **A. Fechamento: saldo = contado**, igual ao Delphi. O `close-preview` lista
  os produtos cujo saldo **atual** difere da foto da abertura, porque se
  movimentaram com o inventário aberto. O diálogo mostra essa lista para o
  usuário decidir se reconta antes de fechar. O fechamento grava
  `quantity_in_stock = counted_quantity` com os produtos travados.
- **B. Não contado nasce vazio.** `counted_quantity` é nullable, e `null`
  significa "não contado". No fechamento, os não contados viram **0**, e o
  diálogo avisa *"N produtos não foram contados e terão o estoque zerado"*.
  **Zerar contagem** volta todos os itens a vazio.
- **C. Contagem cega mantida.** A coluna Estoque fica oculta até "Verificar
  divergência". A API só devolve `stockQuantity` com `?reveal=1`. No
  inventário fechado, a tela já abre revelada.
- **D. Entram só os ativos que controlam estoque**: `is_active = true` e
  `controls_stock = true`, de todos os grupos ou dos grupos escolhidos.
- **E. Fecha mesmo com divergência.** O diálogo mostra o número de divergentes
  e o de não contados. Ele informa, mas não bloqueia.
- **F. Só o PDF da contagem.** Não há listagem impressa dos inventários. Os
  grupos escolhidos são gravados (`inventory_product_groups`) e saem no
  cabeçalho do PDF ("Todos os grupos" ou a lista).
- **G. O inventário 1 do legado** (aberto e vazio) não migra.
- **H. Cancelar entrada já inventariada é bloqueado.** Veio da revisão da
  spec. Cancelar uma entrada de mercadoria finalizada antes do fechamento de
  um inventário que ajustou um dos produtos dela devolve 422 e não muda
  nada. Sem o bloqueio, o estorno tiraria do saldo uma quantidade que a
  contagem já absorveu. Não há prazo: o fechamento é a linha de corte de
  cada produto.
- **I. Ferramentas: conta-se só a prateleira.** As emprestadas (saída de
  ferramentas entregue) já saíram do saldo e voltam na devolução. A tela de
  contagem e o PDF avisam para não contá-las, e o diálogo de fechamento as
  lista. O fechamento não as desconta.
