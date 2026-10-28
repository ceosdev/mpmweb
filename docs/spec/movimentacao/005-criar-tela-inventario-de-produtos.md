# Spec: Inventário de Produtos

> Terceira tela do grupo **Mercadoria**, depois da
> [Entrada](001-criar-tela-entrada-de-mercadoria.md) e da
> [Saída de mercadoria](003-criar-tela-saida-de-mercadoria.md). A entrada soma
> o estoque, a saída baixa, e o inventário **acerta o saldo do sistema com o
> físico**.
>
> Porta a tela `UFrmInventario` / `UFrmInventarioContagem` do Delphi sem fugir
> do fluxo dela. Análise, paralelo com o legado e decisões do usuário em
> [004-analise-inventario-de-produtos.md](004-analise-inventario-de-produtos.md).
> Itens marcados *(decisão da spec)* não foram pedidos pelo usuário e podem ser
> revistos na leitura.

## Problema

O saldo de estoque só se move por entrada e saída de mercadoria. Perda, quebra,
erro de lançamento e produto sem registro deixam o saldo do sistema diferente
do que há na prateleira. Hoje não existe forma de contar o estoque e corrigir o
saldo, e a tela de Produtos não deixa editar `quantity_in_stock` depois do
cadastro.

## Solução proposta

Criar o **inventário de produtos**:

1. O usuário **abre** um inventário com todos os grupos de produto ou só com
   grupos escolhidos. O sistema tira uma **foto** do saldo de cada produto
   ativo que controla estoque. Só existe **um inventário aberto por empresa**.
2. Na **tela de contagem**, ele lança a quantidade contada de cada produto. A
   contagem é **cega**: o saldo do sistema fica oculto até ele pedir para
   **verificar divergências**. Pode também **zerar a contagem** e **imprimir a
   contagem** em PDF.
3. Ao **fechar**, a quantidade contada passa a ser o saldo de cada produto. Um
   produto não contado fica com saldo zero. O inventário fechado é terminal e
   fica disponível para consulta.

## Domínio

- **Entidade**: inventário de produtos (contagem física do estoque).
- **Exemplo**: *Inventário 3, aberto em 27/10/2026, grupos "Tubos" e "Gases".
  O sistema tinha 5,2 m de TUBO COBREFLEX 5/8 e foram contados 4,8 m. Ao
  fechar, o saldo vira 4,8.*

## Específicos do módulo

- **Tabelas**: `inventories`, `inventory_product_groups`, `inventory_items`
- **Slug do módulo**: `inventories`
- **Endpoints**: `/api/inventories`
- **Rotas frontend**: `/inventories` (listagem) e `/inventories/:id` (contagem)
- **Módulo frontend**: `src/modules/inventories/`
- **Ícone (lucide-react)**: `ClipboardList`
- **Menu**: grupo **"Mercadoria"**, item "Inventário de produtos", depois de
  "Saída de mercadoria"
- **Rótulo do módulo** (`module-labels.ts`): `inventories: 'Inventários de produtos'`

## Campos

### Cabeçalho: `inventories`

| Campo (UI, pt-BR) | Coluna | Tipo | Obrigatório | Observações |
| --- | --- | --- | --- | --- |
| Código | `id` | `increments` | auto | No PDF aparece como `nº 0000000001`, igual ao protocolo da saída. |
| Data de abertura | `opening_date` | `date` | sim | Default é hoje. É editável só na abertura e **não pode ser futura** *(decisão da spec)*. |
| Aberto por | `opened_by_user_id` | FK `users`, `RESTRICT` | auto | É o usuário logado na abertura. |
| Status | `status` | `varchar(10)` default `open` | auto | `open` ou `closed`, com rótulos "Aberto" e "Fechado". É um **resultado** e nunca vem do payload. |
| Data de fechamento | `closed_at` | `timestamp` nullable | auto | Gravada no fechamento. A UI mostra só a data, como o Delphi. |
| Fechado por | `closed_by_user_id` | FK `users`, `RESTRICT`, nullable | auto | Usuário que fechou *(decisão da spec, simétrico a `opened_by_user_id`)*. |

- **Um aberto por empresa**: índice parcial único
  `inventories_company_open_uq` em `(company_id) WHERE status = 'open'`. O
  service também checa antes e devolve 422 com mensagem legível. O índice
  garante a regra numa corrida entre duas aberturas; nesse caso, a violação
  do unique devolve a mesma mensagem.
- FK `company_id` com `RESTRICT`. Não tem `deleted_at`: é hard delete, e só
  com `status = 'open'`.
- Índices: `(company_id, opening_date)` e `(company_id, status)`.
- O cabeçalho **não tem edição**, igual ao Delphi. Errou a data ou os grupos,
  exclui e abre outro.

### Grupos escolhidos: `inventory_product_groups`

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `inventory_id` | FK `inventories`, `RESTRICT` | |
| `product_group_id` | FK `product_groups`, `RESTRICT` | Unicidade `(inventory_id, product_group_id)`. |
| `company_id` | FK `companies`, `RESTRICT` | Denormalizado, como nas demais filhas. |

**Nenhuma linha** significa "Todos os grupos". O Delphi não grava os grupos; o
web grava para o cabeçalho da tela e do PDF dizer se o inventário foi total ou
parcial (decisão F).

### Itens: `inventory_items`

| Campo (UI) | Coluna | Tipo | Observações |
| --- | --- | --- | --- |
| Produto | `product_id` | FK `products`, `RESTRICT` | Unicidade `(inventory_id, product_id)` (`inventory_items_inventory_product_uq`). |
| Qtd. estoque | `stock_quantity` | `decimal(15,4)` NOT NULL | **Foto** do saldo na abertura. Um `quantity_in_stock` `null` vira `0`. |
| Qtd. contada | `counted_quantity` | `decimal(15,4)` nullable | `null` significa **não contado** (decisão B). Aceita 0. |
| — | `stock_at_close` | `decimal(15,4)` nullable | Saldo do produto **no instante do fechamento**, antes de ser sobrescrito. É o rastro do ajuste que o fechamento fez de fato *(decisão da spec)*. Fica `null` enquanto o inventário está aberto e quando o item não foi ajustado. |

- FKs `company_id`, `inventory_id` e `product_id`, todas com `RESTRICT`. O
  service apaga os itens explicitamente na transação, como nas entradas e
  saídas.
- Índice `(inventory_id, product_id)`, que é o próprio unique.
- **Situação do item** (derivada, nunca gravada):
  - `uncounted`: `counted_quantity` é `null`.
  - `match`: o contado é igual a `stock_quantity`.
  - `divergent`: o contado é diferente de `stock_quantity`.
- **Diferença** (derivada) = `counted_quantity − stock_quantity`. Não existe
  enquanto o item não foi contado.
- Quantidades trafegam como **string** na API (`#utils/decimal`,
  `lib/decimal.ts`), com até 4 casas, como no resto do estoque.

## Comportamento esperado

### Listagem (`/inventories`)

- Filtros, que disparam no "Pesquisar" (`useSearchFilters`) e persistem ao
  voltar:
  - **Data de abertura**: intervalo com checkbox, marcado por default do 1º ao
    último dia do mês corrente, como o Delphi.
  - **Status**: `Select` com *Todos*, *Abertos* e *Fechados*. O default é
    *Todos*.
- Colunas:
  - Código, Data de abertura, Data de fechamento e Status (badge): ordenáveis.
    Status ordena pelo ciclo (`CASE`: aberto → fechado).
  - Grupos: "Todos os grupos" ou os nomes separados por vírgula, truncados com
    `title`.
  - Itens: `contados / total`.
  - O default de ordenação é data de abertura desc e código desc, como o
    Delphi.
- Botão **"Novo inventário"** (gated `inventories.create`). Fica
  **desabilitado com tooltip** quando já existe um aberto na empresa. A API
  da listagem devolve `meta.hasOpen` para isso *(decisão da spec)*. O backend
  barra de qualquer forma.
- Menu **Ações** de cada linha:

| Ação | Status | Permissão |
| --- | --- | --- |
| Contagem (abre `/inventories/:id`) | todos | `inventories.view` |
| Imprimir contagem | todos | `inventories.view` |
| Fechar inventário | aberto | `inventories.close` |
| Excluir | aberto | `inventories.delete` |

### Abrir inventário (modal "Novo inventário")

Modal `max-w-lg` *(decisão da spec: o cabeçalho tem só dois campos e não pede
rota própria)*:

1. **Data de abertura** (`DatePicker`, default hoje, não futura).
2. **Abrangência** (`RadioGroup`): *Todos os grupos* (default) ou *Grupos
   escolhidos*. Com *Grupos escolhidos*, aparece uma lista de checkboxes com
   os grupos de produto **ativos**, ordenada pela descrição e com um campo de
   busca. Isso faz o papel do combo com os botões +/− do Delphi.
3. **Abrir inventário**: chama `POST /inventories` com
   `{ openingDate, productGroupIds: number[] | [] }`. A lista vazia significa
   "Todos os grupos".
4. Em caso de sucesso, mostra o toast *"Inventário aberto com N produtos."* e
   **navega para a tela de contagem** *(decisão da spec)*.

Validação, local e no backend:

- *Grupos escolhidos* sem nenhum grupo → *"Você não informou nenhum grupo para
  realizar o inventário."*, a mensagem do Delphi.
- Grupo que não é da empresa ou está inativo → 422 *"Grupo de produto
  inválido."*.
- Já existe um aberto → 422 *"Já existe um inventário em aberto."*.
- **Nenhum produto elegível** → 422 *"Nenhum produto ativo com controle de
  estoque nos grupos escolhidos."* *(decisão da spec: evita o inventário
  aberto e vazio que existe hoje na base do Delphi)*.

**Produtos que entram** (decisão D): `company_id` da empresa,
`is_active = true` e `controls_stock = true`, mais
`product_group_id in (...)` quando há grupos escolhidos. Produto **sem grupo**
entra só em *Todos os grupos*. Não há filtro de tipo: `fixed_asset` nunca
controla estoque, e `tool` sempre controla. Um produto criado depois da
abertura não entra no inventário, igual ao Delphi.

**A transação** (`db.transaction`):

1. Checa se já há um aberto e insere o cabeçalho (`opened_by_user_id` =
   usuário logado).
2. Insere os grupos escolhidos.
3. Insere os itens num único
   `INSERT INTO inventory_items (...) SELECT ... FROM products WHERE ...`,
   com `stock_quantity = coalesce(quantity_in_stock, 0)` e
   `counted_quantity = null`. É uma foto consistente, sem um insert por
   produto.
4. Se zero itens foram inseridos → 422 e rollback.

### Tela de contagem (`/inventories/:id`)

Rota dedicada, gated `inventories.view`.

**Cabeçalho**: Código, Data de abertura, Status (badge), Aberto por,
Abrangência ("Todos os grupos" ou a lista) e, se fechado, Data de fechamento e
Fechado por.

**Contadores** (cards ou linha de resumo): Itens, Contados e Não contados.
Com a divergência revelada, mais **Divergentes**.

**Barra de ações**, cada uma por permissão e status:

| Ação | Permissão | Status |
| --- | --- | --- |
| Verificar divergências (alterna: "Ocultar estoque") | `inventories.view` | aberto. No fechado, a tela já abre revelada e o botão não aparece. |
| Zerar contagem | `inventories.count` | aberto |
| Imprimir contagem | `inventories.view` | todos |
| Fechar inventário | `inventories.close` | aberto |

**Aviso de ferramentas** (decisão I): quando o inventário tem algum item de
produto `tool` e está aberto, a tela mostra um `Alert` informativo acima da
tabela: *"Conte só as ferramentas que estão na prateleira. As emprestadas a
funcionários já saíram do estoque e voltam a somar quando forem
devolvidas."*

**Busca local** por código ou descrição. Com a divergência revelada, há também
um filtro *Todos / Só divergentes / Só não contados*.

**Tabela** de todos os itens, **sem paginação** *(decisão da spec: a contagem
percorre a lista inteira em sequência. A base real tem 44 produtos, e
algumas centenas ainda cabem numa tabela)*, ordenada pela **descrição**, igual
ao Delphi:

| Coluna | Visível |
| --- | --- |
| Código | sempre |
| Descrição | sempre |
| Un. (descrição da unidade de medida) | sempre |
| Qtd. estoque | só revelado |
| Qtd. contada (input) | sempre; input com `inventories.count` e aberto, texto nos demais casos |
| Diferença (com sinal) | só revelado |

Com a divergência revelada, a linha **divergente** ganha fundo vermelho suave
(`bg-destructive/10`), que é o vermelho do Delphi no tema atual, e a não
contada aparece com "—" em cinza.

**Lançar contagem**, que é o fluxo do Delphi:

- O input aceita número pt-BR com até 4 casas (`5,2`, `1.234,5`). Vazio
  significa "não contado".
- **Enter** grava a linha (`PUT /inventories/:id/items/:itemId`) e **leva o
  foco ao input da próxima linha visível**. Na última, o foco fica nela.
- **Sair do campo (blur)** com valor alterado também grava *(decisão da spec:
  no web o clique fora é comum, e perder a digitação seria pior que o Delphi)*.
- **Esc** desfaz a edição da linha.
- Cada linha mostra o estado de gravação, com spinner discreto e erro em
  vermelho com a mensagem da API. A gravação de uma linha não bloqueia a
  digitação da próxima.
- Valor inválido (negativo, mais de 4 casas, texto) → erro na linha, sem
  chamar a API.

**Zerar contagem**: `ConfirmDialog` *"Deseja realmente zerar toda a
contagem?"* → `POST /inventories/:id/reset-count`. Todos os itens voltam a
**não contado** (`null`). Toast *"Contagem zerada."*.

**Contagem cega na API** (decisão C): `GET /inventories/:id` devolve os itens
**sem** `stockQuantity`, `difference` e situação `match`/`divergent`, que
vira só `counted`/`uncounted`. Com `?reveal=1`, devolve tudo. Inventário
fechado devolve tudo sempre. É disciplina de tela: quem tem `view` pode
revelar.

### Fechar inventário (aberto)

Diálogo **"Fechar inventário"**, alimentado por
`GET /inventories/:id/close-preview`:

- Resumo: **Itens**, **Contados**, **Não contados** e **Vão mudar de
  estoque**. Este último conta os itens cujo saldo final
  (`coalesce(contado, 0)`) difere da foto, inclusive o não contado com foto
  ≠ 0. É um rótulo diferente do "Divergentes" da tela de contagem, onde o não
  contado tem situação própria *(decisão da spec)*. Um produto que se
  movimentou e voltou ao valor da foto não aparece em "movimentados". É um
  limite aceito de comparar com a foto.
- Se houver não contados, um alerta: *"N produtos não foram contados e terão o
  estoque zerado."* (decisão B).
- **Movimentados desde a abertura** (decisão A), mostrado quando não está
  vazio: tabela com Produto, Estoque na abertura, Estoque atual e Contado.
  São os itens cujo `quantity_in_stock` atual (`coalesce` 0) difere de
  `stock_quantity`. Texto: *"Estes produtos tiveram entrada ou saída depois da
  abertura. Ao fechar, o estoque deles passa a ser a quantidade contada."*
- **Ferramentas emprestadas**, mostrado quando não está vazio (decisão I):
  itens de saídas de ferramentas com `status = 'delivered'` cujo produto está
  no inventário. A tabela tem Saída (código), Funcionário, Ferramenta e
  Quantidade. Texto: *"Estas ferramentas estão com funcionários e não devem
  estar na contagem. Ao serem devolvidas, voltam a somar no estoque."* É só
  informativo e não muda a conta do fechamento.
- **Não ajustados**, mostrado quando não está vazio: itens cujo produto
  **deixou de controlar estoque** depois da abertura. Texto: *"Estes produtos
  não controlam mais estoque e não serão ajustados."*
- Texto de confirmação do Delphi: *"Deseja realmente finalizar o ajuste de
  inventário?"*, com o botão **Fechar inventário** (destrutivo).
- A divergência **não bloqueia** o fechamento (decisão E).

`POST /inventories/:id/close`. Sucesso: toast *"Inventário fechado."*. A tela
recarrega em somente leitura e revelada, e invalida `inventories` e `products`
da empresa.

**A transação** (`db.transaction`):

1. `forUpdate()` no inventário; status diferente de `open` → 422 *"Operação
   não permitida: o inventário não está aberto."*.
2. Produtos dos itens travados com `lockProducts` (`forUpdate()` em **ordem
   crescente de id**, a mesma trava da entrada e da saída, sem deadlock).
3. Para cada item cujo produto **controla estoque agora**:
   `stock_at_close = quantity_in_stock` (a linha travada) e
   `products.quantity_in_stock = coalesce(counted_quantity, 0)`. O saldo
   recebe um **valor absoluto**, não uma diferença (decisão A, igual ao
   Delphi). Por isso não há expressão "± ?" aqui.
4. Item cujo produto **não controla estoque agora**: não toca no produto, e
   `stock_at_close` fica `null` *(decisão da spec: o produto com
   `controls_stock = false` tem saldo `null` por regra, e o fechamento não
   pode quebrar essa regra)*. Produto que ficou **inativo** depois da
   abertura é ajustado normalmente.
5. `status = 'closed'`, `closed_at = now()` e `closed_by_user_id`.

O **custo** (`cost_price`) não é tocado, igual ao Delphi. Qualquer erro faz
com que nada persista.

### Excluir (aberto)

`ConfirmDialog` *"Deseja realmente excluir o inventário e toda a sua
contagem?"* → `DELETE /inventories/:id`. A transação apaga itens, grupos e
cabeçalho. Toast *"Inventário excluído."*. Inventário fechado → 422
*"Inventário já finalizado."*, a mensagem do Delphi.

### Imprimir contagem (PDF)

`GET /inventories/:id/count-sheet[?reveal=1]` (gated `inventories.view`)
devolve `application/pdf`, com
`Content-Disposition: inline; filename="inventario-<id>.pdf"`. No frontend
passa por `openPdf` (nova aba, aberta dentro do clique).

- **Sem `reveal`** (contagem cega): é a **folha de contagem**, com Código,
  Descrição, Un. e Qtd. contada. O contado sai preenchido, ou com uma linha em
  branco se ainda não contado, para o usuário levar à prateleira *(decisão da
  spec: o Delphi imprime o que está no grid, inclusive a coluna oculta. A
  folha cega segue a decisão C)*.
- **Com `reveal`**, e sempre no inventário fechado: Código, Descrição, Un.,
  Qtd. estoque, Qtd. contada e Diferença. As linhas divergentes têm fundo
  vermelho claro, como o relatório do Delphi.
- A tela passa `reveal=1` quando a divergência está revelada.

Conteúdo comum:

- `companyHeader` (reaproveita `pdf_service.ts`).
- Título **"Relatório de Contagem de Inventário"**.
- Nº com 10 dígitos, data de abertura, status, abrangência, aberto por e, se
  fechado, data de fechamento e fechado por.
- Rodapé com os totais: itens, contados, não contados e, com `reveal`,
  divergentes.
- Se o inventário tem ferramenta, uma observação abaixo do título com o mesmo
  texto do aviso da tela (decisão I).
- Quantidades com `formatQuantityPtBr`. Itens ordenados pela descrição.

### Interação com outras telas do grupo Mercadoria

**Cancelar uma entrada de mercadoria já inventariada** (decisão H). O
fechamento grava o saldo contado, então o inventário já absorveu o efeito de
toda entrada finalizada antes dele. Se essa entrada fosse estornada depois, a
quantidade sairia do saldo de novo e o estoque ficaria errado sem aviso.
Exemplo: entra a nota com 10 kg (saldo 15), o inventário conta 15 e fecha,
e a nota é cancelada (saldo 5, prateleira 15).

- `GoodsEntryStock.assertReversible` ganha um **4º bloqueio**, verificado nos
  itens com `stock_effect = 'stock'`. O cancelamento é recusado se existe um
  `inventory_items` do mesmo produto e da mesma empresa com
  `stock_at_close is not null` (o item foi de fato ajustado), num
  `inventories` com `status = 'closed'` e `closed_at > goods_entries.finalized_at`.
- Mensagem (422, nada muda): *"Não é possível cancelar: o produto {produto}
  passou por inventário depois desta entrada, e o estoque não pode ser
  estornado."* Ela nomeia o primeiro produto encontrado, na mesma ordem dos
  demais bloqueios.
- **Não há prazo**: a regra compara datas. O fechamento de um inventário é a
  linha de corte de cada produto contado. Uma entrada finalizada depois do
  último inventário fechado do produto cancela normalmente.
- Compara com o **fechamento**, não com a abertura: uma entrada finalizada
  com o inventário aberto também teve o efeito sobrescrito pelo contado.
- Vale para a **entrada inteira**, porque o cancelamento é tudo ou nada.
  Itens com `stock_effect` `asset` ou `none` não entram na verificação.
- Entrada **aberta** não tem efeito de estoque e cancela normalmente.
- Índice para a consulta: `inventory_items (product_id)` *(decisão da spec)*.

**Saída de ferramentas** (decisão I): a contagem é **só da prateleira**. A
ferramenta entregue já saiu do saldo, e a devolução soma de volta sobre o
saldo contado, que fica certo. O fechamento não desconta empréstimos. O
aviso na tela de contagem, no PDF e na lista do diálogo de fechamento serve
para quem conta não incluir as emprestadas.

A **saída normal** não tem cancelamento, então não há estorno a proteger.

### Regras de negócio

- **Multitenant**: toda query filtra `tenant.company.id`. Grupos, itens e
  produtos têm de ser da empresa. Um `itemId` de outro inventário → 404
  *"Item do inventário não encontrado."*.
- **Lançar contagem e zerar** só com `open`, senão 422 *"Operação não
  permitida: o inventário não está aberto."*. O `PUT` do item trava o
  inventário com `forUpdate()` dentro de uma transação, então uma gravação
  nunca entra depois de um fechamento que começou antes dela.
- `countedQuantity` aceita `null` ou uma string `^\d{1,11}(\.\d{1,4})?$`,
  sempre ≥ 0.
- **Entrada e saída de mercadoria seguem livres** com o inventário aberto
  (decisão A: não há bloqueio). O diálogo de fechamento mostra o que se
  moveu. A única restrição nova é o cancelamento de uma entrada já
  inventariada (decisão H).
- **Exclusão** de produto ou de grupo de produto usado num inventário → 409
  pela FK `RESTRICT`. Os services já têm esse tratamento, com as mensagens
  "…porque está em uso.".
- **Sem edição de cabeçalho, sem cancelamento e sem reabertura**, igual ao
  Delphi. O fechado é terminal.

## Fora de escopo

- Listagem impressa dos inventários (decisão F).
- Importar o inventário 1 do Delphi, que está aberto e vazio (decisão G).
- Bloquear entradas e saídas durante o inventário (decisão A).
- Contar ferramentas emprestadas como estoque (decisão I).
- Mais de um inventário aberto por empresa, ou inventários paralelos por grupo.
- Ajuste de custo pelo inventário.
- Recontagem, ou segunda contagem com conciliação entre contadores.
- Leitor de código de barras e atalhos de teclado F2/F3/F4/F6/F7.
- Histórico de movimentação de estoque (kardex). O `stock_at_close` fica como
  rastro do ajuste.

## Decisões técnicas

### Backend

- **Migrations**: `create_inventories_table`,
  `create_inventory_product_groups_table` e `create_inventory_items_table`,
  conforme "Campos". O índice parcial único sai por `this.schema.raw` e o
  `down` desfaz na ordem inversa.
- **Camadas**:
  - Models: `Inventory`, `InventoryProductGroup` e `InventoryItem`.
  - Repository: `inventory_repository` (list com filtros e `SORT_EXPRESSIONS`;
    "Itens" e "Grupos" por subquery correlacionada, mesmo motivo das
    entradas).
  - Service: `inventory_service` (list, show com e sem reveal, open, destroy,
    updateItem, resetCount, closePreview, close).
  - Controller: `inventories_controller`, que inclui `countSheet`.
  - Estoque: reaproveita `lockProducts` de `goods_exit_stock.ts`. Se o
    import entre módulos ficar estranho, mover `lockProducts` para um
    `stock_lock.ts` comum, que a entrada e a saída também usem, sem mudar o
    comportamento.
- **Entrada de mercadoria**: o 4º bloqueio em
  `GoodsEntryStock.assertReversible` (`app/services/goods_entry_stock.ts`).
  A consulta roda dentro da transação do cancelamento, depois da trava dos
  produtos. Teste próprio: uma entrada finalizada antes do fechamento é
  bloqueada, uma finalizada depois cancela, e um item não ajustado
  (`stock_at_close` null) não bloqueia.
- **PDF**: `app/services/pdf/inventory_count_sheet.ts`, que monta a definição
  a partir do inventário serializado, no mesmo molde de
  `goods_exit_protocol.ts`.
- **Endpoints** (rotas literais registradas **antes** de `/:id` quando forem
  irmãs):
  - `GET|POST /inventories` (`view` / `create`). A listagem devolve
    `meta.hasOpen`.
  - `GET /inventories/:id[?reveal=1]` (`view`): cabeçalho mais todos os itens
    com produto e unidade.
  - `DELETE /inventories/:id` (`delete`)
  - `PUT /inventories/:id/items/:itemId` (`count`): body
    `{ countedQuantity: string | null }` e devolve o item.
  - `POST /inventories/:id/reset-count` (`count`)
  - `GET /inventories/:id/close-preview` e `POST /inventories/:id/close`
    (`close`)
  - `GET /inventories/:id/count-sheet[?reveal=1]` (`view`)
- **Catálogo** (`inventories.*`), com descrições em pt-BR:

| Slug | Nome | Descrição |
| --- | --- | --- |
| `inventories.view` | Visualizar inventários | Listar e consultar os inventários de produtos e imprimir a contagem. |
| `inventories.create` | Abrir inventário | Abrir um inventário e registrar a foto do estoque dos produtos. |
| `inventories.delete` | Excluir inventário | Remover inventários ainda abertos, com toda a sua contagem. |
| `inventories.count` | Lançar contagem de inventário | Lançar e zerar as quantidades contadas de um inventário aberto. |
| `inventories.close` | Fechar inventário | Fechar o inventário e aplicar as quantidades contadas ao estoque. |

- **Dependência de permissão**: a lista de grupos do modal vem de
  `GET /product-groups`, então perfis com `inventories.create` precisam de
  `product_groups.view`. É a mesma decisão de Produtos e Ativos, e fica
  registrada no `state.md`.
- **Validators** VineJS com mensagens em pt-BR:
  - `openingDate`: data ISO, não futura.
  - `productGroupIds`: array de inteiros únicos, vazio permitido.
  - `countedQuantity`: nullable, regex de 4 casas.
  - `status`, `openedByUserId`, `closedAt`, `closedByUserId`, `stockQuantity`
    e `stockAtClose` ficam fora de qualquer payload.

### Frontend

- `src/services/inventories-api.ts`: `list`, `get(id, { reveal })`, `open`,
  `remove`, `updateItem`, `resetCount`, `closePreview`, `close` e
  `countSheet(id, { reveal })` (blob).
- `src/modules/inventories/`, espelhando `goods-exits/`:
  - `inventories-page.tsx` (listagem)
  - `open-inventory-dialog.tsx`
  - `inventory-count-page.tsx`
  - `inventory-count-table.tsx`, com o input por linha e a navegação por Enter
    via refs
  - `close-inventory-dialog.tsx`
  - `inventory-status-badge.tsx`
- Quantidades: reaproveitar o parse e a formatação pt-BR de
  `goods-exits/quantity.ts`. Se for o caso, subir para `lib/`.
- Query keys com `companyId`:
  - `['inventories', companyId, ...]` e
    `['inventories', companyId, id, { reveal }]`.
  - Gravar uma linha atualiza o cache do detalhe **localmente**, pelo item
    devolvido, sem refetch da lista inteira a cada Enter.
  - Zerar e fechar invalidam o detalhe. Fechar também invalida `products`.
- Rota `/inventories/:id` gated `inventories.view`, e menu Mercadoria →
  "Inventário de produtos".

## Critérios de aceite

- [ ] As migrations criam as 3 tabelas com FKs, unicidades, índices e o
      índice parcial de um aberto por empresa, com `up` e `down` limpos.
- [ ] O catálogo traz as 5 permissões `inventories.*` em pt-BR, e o rótulo
      "Inventários de produtos" aparece em Permissões, Perfis e Usuários.
- [ ] O menu Mercadoria mostra "Inventário de produtos" depois de "Saída de
      mercadoria".
- [ ] Abrir com *Todos os grupos* inclui todo produto **ativo** que controla
      estoque e nenhum inativo ou sem controle. Com grupos escolhidos, só os
      desses grupos.
- [ ] A foto grava `stock_quantity` com 4 casas (5,2 continua 5,2) e `null`
      vira 0. A contagem nasce vazia.
- [ ] Abrir um segundo inventário com um já aberto → 422 *"Já existe um
      inventário em aberto."*, e o botão aparece desabilitado na listagem.
      Outra empresa abre o seu normalmente.
- [ ] *Grupos escolhidos* sem grupo → mensagem do Delphi. Nenhum produto
      elegível → 422, e nada é criado.
- [ ] A contagem começa **cega**: sem coluna de estoque na tela, e o JSON sem
      `stockQuantity`. "Verificar divergências" revela o estoque e a
      diferença e destaca as divergentes.
- [ ] Enter grava a linha e passa o foco à próxima. Blur com valor alterado
      grava. Esc desfaz. Vazio volta a não contado. Negativo ou mais de 4
      casas não é enviado.
- [ ] Zerar contagem volta tudo a não contado.
- [ ] Lançar, zerar, fechar ou excluir um inventário fechado → 422.
- [ ] O diálogo de fechamento mostra os totais, o alerta de não contados, os
      produtos movimentados desde a abertura e os que deixaram de controlar
      estoque.
- [ ] Fechar grava `quantity_in_stock = contado` (não contado = 0) em todos os
      itens cujo produto controla estoque. `stock_at_close` registra o saldo
      anterior. O custo não muda. O status vira *Fechado* com data e usuário.
- [ ] Uma entrada de mercadoria finalizada entre a abertura e o fechamento
      aparece em "movimentados", e o fechamento sobrescreve o saldo com o
      contado.
- [ ] Cancelar uma entrada finalizada **antes** do fechamento de um
      inventário que ajustou um dos produtos dela → 422 nomeando o produto,
      e nada muda. Uma entrada finalizada **depois** cancela normalmente.
- [ ] Inventário com ferramenta mostra o aviso na tela e no PDF. O diálogo
      de fechamento lista as ferramentas emprestadas (saídas entregues), e o
      fechamento não as desconta.
- [ ] O inventário fechado abre a contagem em somente leitura e revelada.
- [ ] O PDF de contagem abre numa nova aba. Sem `reveal`, é a folha cega; com
      `reveal` ou fechado, traz estoque, contado, diferença e divergentes em
      vermelho. Tem o cabeçalho da empresa e os totais.
- [ ] Excluir um inventário aberto apaga itens e grupos. Excluir produto ou
      grupo usado num inventário → 409.
- [ ] Cada botão e ação aparece só com a permissão e o status da spec, e o
      endpoint recusa sem a permissão.
- [ ] Multitenant: inventários, itens, grupos e PDF só da empresa ativa.
