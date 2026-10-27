# Spec: Saída de Mercadoria

> Segunda tela do grupo **Mercadoria**, irmã da
> [Entrada de Mercadoria](001-criar-tela-entrada-de-mercadoria.md): a entrada
> soma estoque, a saída baixa. Controla o almoxarifado — consumo de material
> por um **ativo** ou **funcionário**, e ferramentas que saem com um
> funcionário e voltam.
>
> Traz duas novidades para o sistema: o tipo de produto **Ferramenta** e a
> **primeira impressão** (protocolo em PDF numa nova aba — padrão para todas as
> impressões daqui em diante).
>
> Análise do Delphi e decisões do brainstorm em
> [002-analise-saida-de-mercadoria.md](002-analise-saida-de-mercadoria.md).

## Problema

O material de uso e consumo sai do depósito sem registro: o saldo de estoque
só sobe (Entrada de Mercadoria) e nunca desce, e não se sabe qual equipamento
ou funcionário consumiu o quê. Ferramentas emprestadas a funcionários também
não têm controle de saída e retorno.

## Solução proposta

Criar a **saída de mercadoria**: uma requisição de produtos para um
consumidor, de um de dois tipos.

- **Normal** — material de uso e consumo para um ativo ou funcionário. Nasce
  **aberta** com as quantidades requisitadas; ao ser **finalizada**, informa-se
  quanto foi de fato consumido e só isso sai do estoque.
- **Ferramenta** — ferramentas para um funcionário. Nasce **aberta**; ao ser
  **entregue**, todo o requisitado sai do estoque; ao ser **devolvida**, volta
  tudo.

Depois de finalizada, entregue ou devolvida, a saída tem um **protocolo** em
PDF, que abre numa nova aba.

## Domínio

- **Entidade**: saída de mercadoria (requisição ao almoxarifado).
- **Exemplos**: *Saída 1 — normal, funcionário Elton, 2 un. de Cola Armaflex,
  consumidas 2*; *Saída 2 — ferramenta, funcionário Maria, 1 furadeira,
  entregue de manhã e devolvida à tarde*.

## Específicos do módulo

- **Tabelas**: `goods_exits`, `goods_exit_items`
- **Slug do módulo**: `goods_exits`
- **Endpoints**: `/api/goods-exits`
- **Rotas frontend**: `/goods-exits`, `/goods-exits/new`, `/goods-exits/:id`,
  `/goods-exits/:id/edit`
- **Módulo frontend**: `src/modules/goods-exits/`
- **Ícone (lucide-react)**: `PackageMinus`
- **Menu**: grupo **"Mercadoria"**, item "Saída de mercadoria", logo depois de
  "Entrada de mercadoria"
- **Rótulo do módulo** (`module-labels.ts`): `goods_exits: 'Saídas de mercadoria'`

## Produto do tipo Ferramenta

`products.type` ganha o valor **`tool`** (rótulo "Ferramenta"), ao lado de
`consumable` ("Uso e consumo") e `fixed_asset` ("Ativo imobilizado").

- **Ferramenta sempre controla estoque**: o `ProductService` força
  `controls_stock = true` para `tool`, como já força `false` para
  `fixed_asset`. No formulário de Produtos, o switch "Controla estoque" fica
  marcado e desabilitado para Ferramenta.
- **Entrada de Mercadoria**: sem mudança de regra. `resolveStockEffect` já
  trata como `stock` todo produto que não é `fixed_asset` e controla estoque,
  então ferramenta soma saldo e recalcula o custo médio. O que muda são os
  enums/tipos (`goods-entry-form-values.ts`).
- **Ativos**: só `fixed_asset` continua permitindo ativos.
- Lugares que hoje só conhecem dois tipos e passam a aceitar `tool`:
  `ProductType` (backend e frontend), `PRODUCT_TYPES` do validator, filtro e
  rótulos da tela de Produtos, rótulo do `EntityPicker` de produto
  (`entity-sources.ts`: "Ferramenta"), e o `STOCK_SORT_SQL` de Produtos
  (ferramenta ordena pelo saldo, como consumo).

## Campos

### Cabeçalho — `goods_exits`

| Campo (UI, pt-BR) | Coluna | Tipo | Obrigatório | Observações |
| --- | --- | --- | --- | --- |
| Código | `id` | `increments` | auto | Exibido como "Código"; no protocolo, `nº 0000000001`. |
| Tipo de saída | `exit_type` | `varchar(10)` | sim | `normal` \| `tool`. Labels "Saída normal" / "Saída de ferramentas". **Não muda depois de criada** (update recusa). |
| Tipo de consumidor | `consumer_type` | `varchar(10)` | sim | `asset` \| `employee`. Labels "Ativo" / "Funcionário". `tool` exige `employee`. |
| Consumidor (ativo) | `product_asset_id` | FK `product_assets`, `RESTRICT` | condicional | Preenchido sse `consumer_type = 'asset'`. |
| Consumidor (funcionário) | `employee_id` | FK `employees`, `RESTRICT` | condicional | Preenchido sse `consumer_type = 'employee'`. |
| Data da operação | `operation_date` | `date` | auto | `todayIso()` na criação; não editável. |
| Usuário solicitante | `requested_by_user_id` | FK `users`, `RESTRICT` | auto | Usuário logado na criação; não editável. |
| Observação | `notes` | `text` | não | |
| Status | `status` | `varchar(10)` default `open` | auto | `open` \| `finalized` \| `delivered` \| `returned`. **Resultado**, nunca escrito pelo payload. |
| — | `finalized_at`, `delivered_at`, `returned_at` | `timestamp` | auto | Gravados pela ação correspondente. |

- Check constraint `goods_exits_consumer_chk`: `(consumer_type = 'asset' and
  product_asset_id is not null and employee_id is null) or (consumer_type =
  'employee' and employee_id is not null and product_asset_id is null)`.
- Check constraint `goods_exits_tool_employee_chk`: `exit_type <> 'tool' or
  consumer_type = 'employee'`.
- FK `company_id` `RESTRICT`. Sem `deleted_at`: hard delete, só com
  `status = 'open'`.
- Índices: `(company_id, operation_date)`, `(company_id, status)`,
  `(company_id, employee_id)`, `(company_id, product_asset_id)`.

### Itens — `goods_exit_items`

| Campo (UI) | Coluna | Tipo | Observações |
| --- | --- | --- | --- |
| Produto | `product_id` | FK `products`, `RESTRICT` | Unicidade `(goods_exit_id, product_id)` (`goods_exit_items_exit_product_uq`). |
| Qtd. requisitada | `requested_quantity` | `decimal(15,4)` | > 0. |
| Qtd. consumida | `consumed_quantity` | `decimal(15,4)` nullable | Só a saída normal; gravada na finalização; `null` até lá. |
| — | `unit_cost` | `decimal(20,10)` nullable | Foto do `products.cost_price`: gravada ao salvar e **regravada na finalização** com o custo do momento. `null` se o produto não tem custo. |

- FKs `company_id`, `goods_exit_id`, `product_id`, todas `RESTRICT` (o service
  apaga os itens explicitamente na transação, como nas entradas).
- **Derivados, nunca gravados** (devolvidos pela API em reais, 2 casas,
  `round(qtd × unit_cost, 2)`, `null` custo conta como 0):
  - valor requisitado do item = `requested_quantity × unit_cost`;
  - valor consumido do item = `consumed_quantity × unit_cost` (0 enquanto
    `null`);
  - no cabeçalho, `requestedValue` e `consumedValue` = somas dos itens.
- No update do pai, os itens são **substituídos em bloco**.
- Quantidades e custo trafegam como **string** na API, mesma convenção da
  Entrada de Mercadoria (`#utils/decimal`, `lib/decimal.ts`).

## Comportamento esperado

### Listagem

- Filtros (disparam no "Pesquisar", `useSearchFilters`, persistem ao voltar):
  - **Código** (exato);
  - **Consumidor** (texto: `lower(employees.name)` ou
    `lower(product_assets.description)` ou `lower(products.description)` do
    ativo, `like %?%`);
  - **Tipo de saída** (*Todos*, *Saída normal*, *Saída de ferramentas*);
  - **Data da operação** (intervalo com checkbox, marcado por default do 1º ao
    último dia do mês corrente);
  - **Status** (múltipla escolha: Aberta, Finalizada, Entregue, Devolvida;
    nenhum = todos).
- Colunas, **todas ordenáveis**: Código, Consumidor (nome + rótulo
  "Funcionário"/"Ativo"), Tipo, Data da operação, Valor requisitado, Valor
  consumido, Status (badge).
  - Consumidor e os valores ordenam por `SORT_EXPRESSIONS` (subquery
    correlacionada, não `join` — mesmo motivo da Entrada de Mercadoria), pela
    **mesma expressão que exibem**.
  - Status ordena pelo **ciclo de vida** (`CASE`: aberta → entregue →
    finalizada → devolvida).
  - Default: data da operação desc, código desc.
- Botão "Nova saída" (gated `goods_exits.create`).
- Menu **Ações** de cada linha, item a item conforme status e permissão:

| Ação | Status | Tipo | Permissão |
| --- | --- | --- | --- |
| Visualizar | todos | ambos | `goods_exits.view` |
| Editar | aberta | ambos | `goods_exits.edit` |
| Excluir | aberta | ambos | `goods_exits.delete` |
| Finalizar | aberta | normal | `goods_exits.finalize` |
| Entregar | aberta | ferramenta | `goods_exits.deliver` |
| Devolver | entregue | ferramenta | `goods_exits.return` |
| Imprimir protocolo | finalizada, entregue, devolvida | ambos | `goods_exits.view` |

### Cadastro — fluxo feliz

Formulário em rota dedicada; `/goods-exits/:id` é o mesmo formulário em
`readOnly`.

1. **Dados da requisição**: Código, Data da operação e Usuário solicitante
   (somente leitura; vazios em "Nova saída" até salvar, exceto data = hoje e
   usuário = logado); **Tipo de saída** (`RadioGroup`, default *Saída
   normal*); **Tipo de consumidor** (`Select` Ativo/Funcionário — com *Saída
   de ferramentas* fica travado em Funcionário); **Consumidor**
   (`EntityPicker`, fonte conforme o tipo); **Observação** (`Textarea`).
2. **Produtos**: `EntityPicker` de produto (só ativos, que controlam estoque,
   do tipo `consumable` na saída normal ou `tool` na de ferramentas), campo
   **Qtd.** e botão **+**. Tabela: Código, Descrição, Un., Qtd. requisitada,
   Valor requisitado, remover. Rodapé: quantidade de produtos e total
   requisitado.
   - Produto já na lista → não adiciona, *"Este produto já está na saída."*
   - Trocar o **tipo de saída** com produtos na lista pede confirmação e
     limpa a lista (os produtos de um tipo não servem no outro).
   - Trocar o **tipo de consumidor** limpa o consumidor escolhido.
3. Salvar → toast *"Saída de mercadoria criada."* e volta à listagem.

### Finalizar (saída normal aberta)

Diálogo **"Finalizar saída"**, alimentado por
`GET /goods-exits/:id/finalize-preview` (itens com estoque **atual** e custo
atual):

- Tabela: Código, Produto, Estoque, Qtd. requisitada, **Qtd. consumida**
  (input), Valor consumido. A consumida vem **pré-preenchida** com
  `min(requisitada, estoque)` (mín. 0).
- Rodapé com o **valor total consumido**, recalculado a cada digitação.
- Validação local e no backend, por item:
  - consumida ≥ 0;
  - consumida ≤ requisitada → *"A quantidade de consumo de {produto} não pode
    ser superior à quantidade requisitada."*;
  - consumida ≤ estoque atual → *"A quantidade de consumo de {produto} não
    pode ser superior ao estoque atual."*
- Consumo **0 é permitido** (item requisitado e não usado).
- **Finalizar** → `ConfirmDialog` *"Deseja realmente finalizar a saída de
  mercadoria?"* → `POST /goods-exits/:id/finalize` com
  `{ items: [{ productId, consumedQuantity }] }` (todos os itens da saída,
  nem mais nem menos — senão 422).
- Sucesso: toast *"Saída de mercadoria finalizada."*, o protocolo abre numa
  nova aba, a listagem atualiza.

**A transação** (`db.transaction`):

1. `forUpdate()` na saída; status ≠ `open` ou tipo ≠ `normal` → 422.
2. Produtos dos itens travados com `forUpdate()` em **ordem crescente de id**.
3. Revalida as três regras por item contra o saldo travado.
4. Por item: `quantity_in_stock = quantity_in_stock - ?` (expressão SQL),
   `consumed_quantity`, `unit_cost = products.cost_price` atual.
5. `status = 'finalized'`, `finalized_at = now()`.

Qualquer erro → nada persiste. O requisitado e não consumido **nunca saiu** do
estoque — não há o que devolver.

### Entregar (ferramenta aberta)

`ConfirmDialog` *"Deseja realmente entregar a mercadoria para o
destinatário?"* com a lista de ferramentas e quantidades.
`POST /goods-exits/:id/deliver`, em transação com a mesma trava: algum item
com requisitado > estoque → 422 *"O produto {produto} não possui estoque
suficiente. Altere a quantidade solicitada."* e nada muda; senão
`quantity_in_stock -= requested_quantity` para cada item, `status =
'delivered'`, `delivered_at`. Sucesso: toast *"Mercadoria entregue."* e o
protocolo abre numa nova aba.

### Devolver (ferramenta entregue)

`ConfirmDialog` *"Deseja realmente devolver a mercadoria para o estoque?"*.
`POST /goods-exits/:id/return`, em transação: `quantity_in_stock +=
requested_quantity` para cada item, `status = 'returned'`, `returned_at`.
Sem devolução parcial. Sucesso: toast *"Mercadoria devolvida ao estoque."* e o
protocolo abre numa nova aba.

- Se o produto deixou de controlar estoque entre a entrega e a devolução
  (só possível mudando o tipo de `tool` para `consumable` e desligando o
  controle), a devolução soma assim mesmo sobre `coalesce(quantity_in_stock,
  0)` — devolver nunca é bloqueado.

### Protocolo (PDF)

`GET /goods-exits/:id/protocol` (gated `goods_exits.view`) devolve
`application/pdf` (`Content-Disposition: inline; filename="saida-<id>.pdf"`).
Saída aberta → 422 *"Só é permitido imprimir o protocolo de saídas entregues,
devolvidas ou finalizadas."*

Conteúdo:

- **Cabeçalho da empresa** (helper reutilizável): logo (se houver), razão
  social, endereço (logradouro, número, bairro, CEP, cidade/UF), telefone,
  e-mail, CNPJ, inscrição municipal; à direita, data/hora de emissão e "Pág. N".
- Título **"Protocolo de Saída de Mercadoria"**.
- Nº da saída com 10 dígitos (`0000000001`), tipo de saída, status, data da
  operação, usuário solicitante.
- Consumidor com o rótulo do tipo: *"FUNCIONÁRIO: Elton"* ou *"ATIVO: Split
  12000 – Sala 2 – PAT-001"*.
- Observação, se houver.
- Tabela: Código, Produto, Qtd. requisitada e Qtd. consumida (normal) ou
  Código, Produto, Qtd. (ferramenta). Quantidades em pt-BR, sem zeros
  supérfluos (`2`, `0,5`, `1,2500` → `1,25`).
- Sem código de barras e sem valores monetários (é um comprovante de
  movimentação, como o do Delphi).

**No frontend**, toda impressão passa por um helper `openPdf(fetchPdf)`
(`src/lib/open-pdf.ts`): abre `window.open('', '_blank')` **dentro do clique**
(senão o navegador bloqueia como popup), baixa o PDF via axios com o token
(`responseType: 'blob'`), e aponta a aba para `URL.createObjectURL(blob)`. Em
erro, fecha a aba e mostra o toast com a mensagem da API. Os disparos
automáticos (depois de finalizar/entregar/devolver) abrem a aba no clique do
botão de confirmação, antes da chamada da ação.

### Regras de negócio

- **Multitenant**: toda query filtra `tenant.company.id`; consumidor, produtos
  e usuário solicitante têm de ser da empresa.
- **Salvar** (create/update, só `open`):
  - ≥ 1 produto; produto repetido → 422 *"O produto {produto} aparece mais de
    uma vez na saída."*;
  - `requested_quantity` > 0, até 4 casas;
  - produto tem de ser da empresa, **ativo**, **controlar estoque** e do tipo
    da saída (`consumable` na normal, `tool` na de ferramentas) → senão 422
    *"O produto {produto} não pode ser usado nesta saída."*;
  - saída de ferramentas: produto com `cost_price` nulo ou zero → 422
    *"Produto {produto} com preço de custo zerado ou inexistente."* (regra do
    Delphi);
  - consumidor: funcionário **ativo** ou ativo **não vendido** da empresa; na
    edição, o vínculo já gravado passa mesmo que tenha ficado inativo/vendido
    (mesma política de `assertRelations` das entradas);
  - `exit_type` não muda no update (422 *"O tipo de saída não pode ser
    alterado."*);
  - requisitar mais do que o estoque **é permitido** ao salvar.
- **Editar/Excluir** fora de `open` → 422 *"Operação não permitida: a saída
  não está aberta."*
- **Sem cancelamento** (decisão do usuário, igual ao Delphi): finalizada e
  devolvida são terminais.
- **Interação com a Entrada de Mercadoria**: cancelar uma entrada já recusa o
  estorno que deixaria saldo negativo. Ferramentas dela que estejam entregues
  (ou consumo que já baixou o saldo) barram o cancelamento por essa regra
  existente.
- **Exclusão** de funcionário, ativo ou produto usado numa saída → 409 (FK
  `RESTRICT`, tratamento já existente em cada service).

## Fora de escopo

- Cancelamento de saída (decisão do usuário).
- Devolução parcial de ferramenta.
- Saída Avulsa do Delphi (`UFrmSaidaAvulsaMercadoria`, com motivo de saída).
- Código de barras no protocolo.
- Valores monetários no protocolo.
- Importação das saídas do Delphi.
- Relatórios de consumo por consumidor/produto (virão como PDFs próprios).

## Decisões técnicas

### Backend

- **Migrations**: `create_goods_exits_table` e `create_goods_exit_items_table`
  conforme "Campos", check constraints por `this.schema.raw`. O tipo `tool`
  **não precisa de migration**: `products.type` é `varchar` sem check
  constraint, e nenhuma linha `tool` existe ainda.
- **Dependência**: `pdfmake` (versão estável atual, com as fontes Roboto
  embutidas — `pdfmake/build/vfs_fonts`), usada pelo `PdfPrinter` server-side.
- **PDF** em `app/services/pdf/`:
  - `pdf_service.ts` — `renderPdf(doc: TDocumentDefinitions): Promise<Buffer>`
    e `companyHeader(company: Company, logo: Buffer | null)`; lê o logo pelo
    `@adonisjs/drive` (`company.logoPath`); sem logo, o cabeçalho sai só com o
    texto. Formatação pt-BR de quantidade e data em helpers do mesmo módulo.
  - `goods_exit_protocol.ts` — monta a definição do protocolo a partir da
    saída serializada.
- **Camadas**: `GoodsExit` / `GoodsExitItem` models → `goods_exit_repository`
  → `goods_exit_service` (CRUD, list, preview, finalize, deliver, return) e
  `goods_exit_stock.ts` (baixa/soma de estoque com trava, como o
  `goods_entry_stock.ts`) → `goods_exits_controller` (inclui `protocol`, que
  responde com `response.header('content-type', 'application/pdf')`).
- **Lookups novos** (sem gate de rota, payload mínimo, `?q=` só ativos/não
  vendidos, `?ids=` hidrata qualquer um — mesma política dos lookups de
  fornecedor/cliente):
  - `GET /employees/lookup` → `{ id, name, roleTitle, isActive }`;
  - `GET /product-assets/lookup` → `{ id, description, assetCode,
    productDescription, situation }`, busca por descrição do ativo, do produto
    ou código de patrimônio.
  - `GET /products/lookup` ganha `?type=` (`consumable` | `fixed_asset` |
    `tool`) e `?controlsStock=true`; o `costPrice` passa a vir também para
    quem tem `goods_exits.create`/`edit`.
- **Endpoints**:
  - `GET|POST /goods-exits`, `GET|PUT|DELETE /goods-exits/:id`
  - `GET /goods-exits/:id/finalize-preview`, `POST /goods-exits/:id/finalize`
    (gate `finalize`)
  - `POST /goods-exits/:id/deliver` (gate `deliver`)
  - `POST /goods-exits/:id/return` (gate `return`)
  - `GET /goods-exits/:id/protocol` (gate `view`)
- **Catálogo** (`goods_exits.*`): `view` "Visualizar saídas de mercadoria",
  `create` "Criar saída de mercadoria", `edit` "Editar saída de mercadoria",
  `delete` "Excluir saída de mercadoria", `finalize` "Finalizar saída de
  mercadoria", `deliver` "Entregar ferramentas", `return` "Devolver
  ferramentas" — descrições em pt-BR.
- **Validators** VineJS com mensagens pt-BR; quantidades como string por regex
  (`^\d{1,11}(\.\d{1,4})?$`), como na Entrada de Mercadoria; `status`,
  `operationDate`, `requestedByUserId`, `unitCost` e `consumedQuantity`
  ausentes do payload de salvar.

### Frontend

- `src/services/goods-exits-api.ts`: `list`, `get`, `create`, `update`,
  `remove`, `finalizePreview`, `finalize`, `deliver`, `return`, `protocol`
  (blob).
- `src/lib/open-pdf.ts`: `openPdf(fetchPdf: () => Promise<Blob>): Promise<void>`
  — padrão de impressão do sistema.
- `src/modules/goods-exits/`: listagem, formulário, seção de produtos, diálogo
  de finalização, badge de status. Espelhar `src/modules/goods-entries/`.
- Fontes novas do `EntityPicker`: `employee`, `productAsset`; a fonte
  `product` aceita os filtros `type`/`controlsStock`.
- Produtos: tipo "Ferramenta" no `Select` do formulário e do filtro; switch
  "Controla estoque" marcado e desabilitado para Ferramenta.
- Query keys com `companyId`; finalizar/entregar/devolver invalidam
  `goods-exits` e `products` da empresa.

## Critérios de aceite

- [ ] Produto do tipo **Ferramenta** cria/edita com "Controla estoque" sempre
      ligado; aparece no filtro de tipo de Produtos.
- [ ] Entrada de Mercadoria finalizada com uma ferramenta soma o estoque e
      recalcula o custo médio dela.
- [ ] Migrations criam `goods_exits` e `goods_exit_items` com FKs, checks,
      unicidade e índices; `up`/`down` limpas.
- [ ] Catálogo traz as 7 permissões `goods_exits.*` em pt-BR; o rótulo
      "Saídas de mercadoria" aparece em Permissões/Perfis/Usuários.
- [ ] Menu "Mercadoria" mostra "Saída de mercadoria" depois de "Entrada de
      mercadoria".
- [ ] Criar saída normal para funcionário e para ativo; ativo vendido e
      funcionário inativo não aparecem no picker e o backend recusa.
- [ ] Saída de ferramentas só aceita funcionário (UI trava; backend recusa
      ativo).
- [ ] Picker de produto só mostra produtos ativos que controlam estoque e do
      tipo da saída; backend recusa os outros com a mensagem da spec.
- [ ] Ferramenta com custo zero → 422.
- [ ] Produto repetido → 422; quantidade 0 → 422.
- [ ] Editar substitui os itens; editar/excluir fora de `open` → 422; trocar
      `exitType` no update → 422.
- [ ] Finalizar: consumo vem pré-preenchido com `min(requisitado, estoque)`;
      consumo > requisitado ou > estoque → 422 nomeando o produto; consumo 0
      aceito; o saldo baixa só o consumido; `unit_cost` regravado; status
      *Finalizada*.
- [ ] Duas saídas finalizadas do mesmo produto em sequência deixam o saldo
      exato (sem leitura-soma-gravação).
- [ ] Entregar com estoque insuficiente → 422 e nada muda; com estoque, baixa
      o requisitado; Devolver soma de volta; status *Entregue* → *Devolvida*.
- [ ] Ações do menu aparecem só no status/tipo/permissão da tabela da spec.
- [ ] Protocolo: saída aberta → 422; finalizada/entregue/devolvida abre PDF
      numa nova aba com cabeçalho da empresa (com e sem logo), nº com 10
      dígitos, consumidor com rótulo e a tabela correta para o tipo.
- [ ] O protocolo abre sozinho depois de finalizar, entregar e devolver, sem
      bloqueio de popup.
- [ ] Listagem: filtros (código, consumidor, tipo, data marcada no mês,
      status múltiplo) e ordenação por todas as colunas, status pelo ciclo.
- [ ] Multitenant: saídas, pickers e protocolo só da empresa ativa.
- [ ] Excluir funcionário/ativo/produto usado numa saída → 409.
