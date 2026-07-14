# Spec: Criar tela de contas a pagar

> ⚠️ **Não é simple-CRUD puro.** Tem FK para fornecedor, 4 campos monetários,
> 2 datas, enum de status, campos derivados (total e saldo) e um filtro de status
> com um valor **virtual** (vencido). A [rule simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
> manda abandonar o padrão quando há valores e relacionamentos — mas a **dinâmica**
> da família se mantém: paginação 20/página server-side, ordenação por colunas,
> formulário em modal, hard delete, multitenant.
>
> **Primeira consumidora do [EntityPicker](../comum/001-componente-entity-picker.md)**,
> usado para escolher o fornecedor (no formulário e no filtro).
>
> **Primeira tela do módulo Financeiro** — abre o grupo de menu "Financeiro".

## Problema

A empresa precisa registrar os **títulos que tem a pagar** aos fornecedores:
quanto, para quem, quando vence e em que situação está. Hoje não existe nada
disso no sistema — o cadastro de fornecedores existe, mas nada aponta para ele
do lado financeiro.

Esta spec cobre o **CRUD do título**. A **baixa** (pagamento total ou parcial)
vem em spec própria, logo em seguida, e é ela que vai movimentar o saldo.

## Solução proposta

Criar a tela de contas a pagar da empresa ativa.

- A entidade é **por empresa** (multitenant); toda query filtra por
  `tenant.company.id`.
- Cada título aponta para um **fornecedor** (`suppliers`), escolhido pelo
  **EntityPicker** — nada de `Select` com teto de 200 aqui, o cadastro de
  fornecedores é grande por natureza.
- Gerar 4 permissões: `payables.view`, `payables.create`, `payables.edit`,
  `payables.delete`. ROOT recebe tudo pelo curinga `*`.
- O formulário é exibido em **modal**, como no resto do projeto.
- **Grupo de menu novo: "Financeiro"**, com a tela "Contas a pagar" dentro.
- **Saldo** e **total** são **campos virtuais** (calculados, não colunas de
  entrada) — ver [Campos derivados](#campos-derivados).

## Domínio

- **Entidade**: título a pagar (`payable`).
- **Pai**: fornecedor (`supplier`) — chamado **"cedente"** na UI da listagem e
  dos filtros, que é o termo do domínio financeiro (quem emitiu o título).
- **Exemplos**: título 1234, ordem 1/3, cedente *Acme Distribuidora*, emitido em
  01/07, vencendo em 10/08, valor R$ 1.500,00, em aberto.
- **Justificativa de negócio**: é a base do contas a pagar — sem o título
  lançado, não há o que baixar, nem fluxo de caixa, nem relatório de vencimentos.

## Específicos do módulo

- **Tabela**: `payables`
- **Slug do módulo**: `payables`
- **Endpoints**: `/api/payables`
- **Rota frontend**: `/payables`
- **Módulo frontend**: `src/modules/payables/`
- **Ícone (lucide-react)**: `Receipt` (item), `Landmark` (grupo "Financeiro")
- **Label do menu**: "Contas a pagar"
- **Grupo do menu**: "Financeiro" *(novo)*
- **Rótulo do módulo** (`module-labels.ts`): `payables: 'Contas a pagar'`

## Campos

| Campo (UI, pt-BR)   | Coluna (DB, en)   | Tipo                        | Obrigatório | Observações |
| ------------------- | ----------------- | --------------------------- | ----------- | ----------- |
| Número do título    | `document_number` | `varchar(20)`               | sim         | `trim`, 1–20. **Texto, não número**: preserva zeros à esquerda ("000123") e aceita formatos de documento fiscal ("12345/A", "12345-2"). |
| Ordem               | `installment`     | `smallint`                  | sim         | 1–999. Default `1`. É a parcela do título. |
| Cedente (fornecedor)| `supplier_id`     | FK `suppliers.id`           | sim         | **EntityPicker** (`source="supplier"`). `RESTRICT` na FK. |
| Data de emissão     | `issue_date`      | `date`                      | sim         | Default: **data de hoje**. |
| Data de vencimento  | `due_date`        | `date`                      | sim         | Default: **data de hoje**. |
| Valor do título     | `amount`          | `decimal(12,2)`             | sim         | `> 0`. Máscara de moeda (R$). |
| Desconto            | `discount`        | `decimal(12,2)` default `0` | não         | `>= 0`. Vazio → `0`. |
| Multa               | `fine`            | `decimal(12,2)` default `0` | não         | `>= 0`. Vazio → `0`. |
| Juros               | `interest`        | `decimal(12,2)` default `0` | não         | `>= 0`. Vazio → `0`. |
| Observação          | `notes`           | `text` nullable             | não         | `trim`, máx 1000. Vazio → `null`. |

> **Idioma**: colunas e enum em inglês; labels e mensagens em português.

### Campos de resultado (não editáveis)

Estas duas colunas existem no banco mas **não aparecem no formulário**. Nenhuma
delas é escrita pelo usuário:

| Coluna        | Tipo                        | Quem escreve |
| ------------- | --------------------------- | ------------ |
| `paid_amount` | `decimal(12,2)` default `0` | O módulo de **baixa** (spec seguinte). Soma das baixas do título. |
| `status`      | `varchar(20)` default `open`| O **sistema**, recalculado a partir de `paid_amount`; e a ação **Cancelar título** (spec seguinte). |

**`status` é um resultado, não uma escolha.** Regra única de derivação:

```txt
cancelado  ⟸  a ação "Cancelar título" foi executada     (status = 'cancelled')
aberto     ⟸  paid_amount = 0                            (status = 'open')
pago       ⟸  paid_amount >= total                       (status = 'paid')
parcial    ⟸  0 < paid_amount < total                    (status = 'partially_paid')
```

- Um **único** ponto de escrita no backend — `PayableService.recomputeStatus()` —
  chamado sempre que `paid_amount` ou os valores do título mudarem. Nenhum outro
  código atribui `status` (exceto a ação de cancelar, que é terminal).
- O `status` é **coluna persistida**, não expressão calculada, porque a listagem
  **filtra e ordena** por ele — derivar em SQL a cada consulta custaria índice.
  O preço é o risco de divergir de `paid_amount`; o `recomputeStatus()` único é
  justamente o que contém esse risco.
- **Neste CRUD, todo título nasce e permanece `open`.** Os outros três estados só
  passam a ocorrer quando as specs de **baixa** e **cancelamento** chegarem — mas
  o enum, o filtro e o badge já os contemplam desde agora.

### Campos derivados (calculados, sem coluna)

```txt
total  = amount - discount + fine + interest
saldo  = max(0, total - paid_amount)     (0 quando status = cancelled)
```

- **`total`** é o valor efetivo do título (o que se deve de fato).
- **`saldo`** é o que falta pagar. Sem nenhuma baixa (`paid_amount = 0`), o saldo
  é o próprio total. Um título **cancelado** tem saldo **0** — não se deve mais
  nada.
- O cálculo é feito **no backend** e devolvido pronto, para a listagem não ter
  que somar no cliente (e para os futuros relatórios usarem a mesma fonte).

## Comportamento esperado

### Fluxo feliz

- O usuário com `payables.view` acessa **Financeiro → Contas a pagar**.
- Vê a listagem paginada (20/página, server-side) com as colunas:

  | Coluna     | Ordenável | Observação |
  | ---------- | --------- | ---------- |
  | Número     | sim       | `document_number` |
  | Ordem      | sim       | `installment` |
  | Emissão    | sim       | `dd/MM/yyyy` |
  | Cedente    | **não**   | Nome do fornecedor (join). Ver "Fora de escopo". |
  | Vencimento | sim       | `dd/MM/yyyy`. **Vermelho quando vencido** (ver abaixo). |
  | Valor      | sim       | O **`total`** (`amount + fine + interest - discount`), formatado `R$ 0,00`. **Nunca o `amount` cru.** Ordena pela mesma expressão que exibe — ver [Backend](#backend). |
  | Saldo      | **não**   | Derivado; não é coluna do banco. |
  | Status     | sim       | Badge. |
  | Ações      | —         | Editar / Excluir. |

- Ao abrir a tela, os filtros já vêm preenchidos: **intervalo de vencimento
  marcado**, do **primeiro ao último dia do mês corrente**. A listagem já carrega
  filtrada por isso.
- Clica em "Novo título" (gated por `payables.create`) → modal com os campos da
  tabela de [Campos](#campos). Emissão e vencimento já vêm com **a data de hoje**;
  ordem já vem `1`. **Não há campo de status** — o título nasce "Aberto".
- Escolhe o fornecedor digitando o nome (ou o CNPJ) no EntityPicker.
- Submete → registro salvo, modal fecha, listagem atualiza, toast de sucesso.

### Destaque visual de vencido

O campo **Vencimento** aparece em **fonte vermelha** quando o título está
**vencido**:

```txt
vencido  ⟺  due_date < hoje  E  status ∈ (open, partially_paid)
```

- A comparação é **estritamente menor** — vencer *hoje* **não** é estar vencido.
- Um título **pago** ou **cancelado** **nunca** é pintado de vermelho, mesmo com
  vencimento no passado: não se deve mais nada, o vermelho seria ruído.
- É puramente visual; não existe status `overdue` no banco.

### Filtros

Ficam numa área acima da tabela, como nos demais CRUDs.

| Filtro                    | Tipo                          | Comportamento |
| ------------------------- | ----------------------------- | ------------- |
| Número do título          | `Input` de texto              | Busca **"contém"** (`lower(document_number) like %?%`), não igualdade — assim "123" acha "000123" e "12345/A". Debounced 350 ms. |
| Cedente                   | **EntityPicker** (`supplier`) | Igualdade por FK (`supplier_id = ?`). |
| Intervalo de **vencimento** | `Checkbox` + 2 `date`       | **Marcado por default**, do 1º ao último dia do mês corrente. |
| Intervalo de **emissão**  | `Checkbox` + 2 `date`         | **Desmarcado** por default. |
| Status                    | **`MultiSelect`** (checkbox)  | Aberto, Pago parcial, Pago, Cancelado, **Vencido**. **Nenhum selecionado = Todos** (default). Os marcados se combinam em **OR**. |

- Os dois intervalos de data são **independentes** e podem estar ativos ao mesmo
  tempo — nesse caso se somam (`AND`).
- **Desmarcar o checkbox desativa o filtro** daquele intervalo (não envia as
  datas). Marcar sem alterar as datas usa o mês corrente.
- **Status é múltipla escolha.** **Nenhum selecionado significa "todos"** — é a
  ausência de filtro, não um filtro vazio (que não devolveria nada). Nesse caso o
  param nem é enviado.
- Os status marcados se combinam em **OR**: marcar *Pago* e *Cancelado* traz os
  dois conjuntos.
- **Status "Vencido"** é **virtual**: não filtra a coluna `status`, e sim
  `due_date < hoje AND status IN ('open','partially_paid')` — a mesma regra do
  destaque em vermelho, para a tela não se contradizer. Ele entra como **mais um
  ramo do OR**: marcar *Pago* + *Vencido* traz os quitados **e** os vencidos —
  e um título quitado com vencimento no passado aparece só por ser "pago",
  **nunca** como vencido.
- Qualquer mudança de filtro reseta `page` para 1.
- Todos os filtros entram na `queryKey` e nos query params do GET.
- "Limpar filtros" volta ao **estado default** (vencimento do mês corrente
  marcado), não ao vazio — senão o usuário perde o recorte útil.

### Fluxos alternativos

- **Editar** (gated por `payables.edit`): mesmo modal, preenchido, **também sem
  campo de status**. O EntityPicker recebe só o `supplierId` e **hidrata o nome
  sozinho**. Fornecedor **inativo** vinculado a um título antigo continua
  aparecendo, com o sufixo `(inativo)`.
  - Ao salvar, o backend **recalcula o status** (os valores podem ter mudado o
    `total` e, com isso, a relação com o `paid_amount`).
  - **Título cancelado não é editável** → 422 *"Não é possível editar um título
    cancelado."* Cancelamento é terminal.
- **Excluir** (gated por `payables.delete`): `ConfirmDialog` → **hard delete**.
  Quando existirem baixas, a FK vai barrar a exclusão e o backend devolve **409**:
  *"Não é possível excluir este título porque já possui baixas."* (a mensagem é
  do futuro módulo de baixa; por ora, nada referencia o título).
- **Fornecedor com títulos**: excluir um fornecedor que tenha título vinculado →
  **409** (FK `RESTRICT`), com *"Não é possível excluir este fornecedor porque
  está em uso."* (mensagem que o módulo de fornecedores já devolve).

### Regras de negócio

- **Multitenant**: título pertence à empresa ativa; ninguém vê o de outra empresa
  (exceto ROOT).
- **Fornecedor**: obrigatório. O backend valida que o `supplier_id` **existe e
  pertence ao tenant**; senão **422** *"Fornecedor inválido."* — não vaza a
  existência de fornecedores de outra empresa.
- **Valor**: `> 0`. Zero ou negativo → 422.
- **Desconto, multa, juros**: `>= 0`; default `0`.
- **Desconto não pode superar o valor**: `discount <= amount`, senão 422
  *"O desconto não pode ser maior que o valor do título."* — evita título com
  total negativo.
- **Vencimento não pode ser anterior à emissão**: `due_date >= issue_date`, senão
  422 *"O vencimento não pode ser anterior à emissão."*
- **Ordem**: inteiro de 1 a 999. Default `1`.
- **Sem regra de unicidade** (decisão explícita do usuário): o mesmo número de
  título, do mesmo fornecedor, na mesma ordem, **pode** ser lançado mais de uma
  vez. Nada no banco nem no service impede duplicata — consistente com o resto da
  família de cadastros, que também permite descrições repetidas.
- **Status**: **nunca vem do cliente.** O payload de create/update que trouxer
  `status` tem o campo **ignorado** (não é 422 — simplesmente não existe no
  validator). Quem escreve é o `recomputeStatus()` e a ação de cancelar.
- **Editar os valores de um título já baixado é permitido**, e o status é
  **recalculado no save** — esse é o comportamento desejado, não um efeito
  colateral. Consequências diretas, todas corretas por construção:
  - Título **Pago** cujo valor sobe → `total > paid_amount` → volta a **Parcial**,
    devendo a diferença.
  - Título **Parcial** cujo valor cai até `<= paid_amount` → vira **Pago**.
  - Não há trava, confirmação extra nem aviso: quem tem `payables.edit` edita.
- **Saldo nunca é negativo**: se uma edição derrubar o `total` **abaixo** do que
  já foi pago, o saldo é exibido como **0** (e o status, "Pago"). O troco/crédito
  ao pagador **não** é modelado aqui — ver "Fora de escopo".
- **Saldo de cancelado é 0**, independente de `paid_amount`.
- **Título cancelado não é editável** (422) — cancelamento é terminal.
- **"Hoje"** é calculado **no backend** (fuso da aplicação), nunca no cliente —
  ver **brecha 5**.
- **Ordenação default**: `due_date asc` (o que vence primeiro aparece primeiro).
- **Paginação**: server-side, 20/página.
- **Exclusão**: hard delete.

## Fora de escopo

- **Baixa (pagamento) total ou parcial** — spec própria, logo a seguir. É ela que
  move `paid_amount` e, por consequência, o saldo e o status.
- Rateio por centro de custo / plano de contas.
- Anexo de boleto ou nota fiscal.
- Recorrência / geração automática de parcelas (o usuário lança cada ordem).
- Cálculo automático de multa e juros por atraso — aqui são **valores informados**
  pelo usuário, não calculados.
- Contas a **receber** (é o espelho, virá depois).
- **Crédito / troco por pagamento a maior**: se uma edição derrubar o total abaixo
  do já pago, o saldo é simplesmente `0` — o sistema não devolve, não guarda nem
  compensa a diferença em outro título.
- Ordenação pelas colunas "Cedente" (join) e "Saldo" (derivada).
- Conciliação bancária, remessa/retorno, integração com banco.

## Decisões técnicas

### Backend

- **Migration** `create_payables_table`:

  ```ts
  table.increments('id').notNullable()

  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('companies').onDelete('RESTRICT')

  table
    .integer('supplier_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('suppliers').onDelete('RESTRICT')

  table.string('document_number', 20).notNullable()
  table.smallint('installment').notNullable().defaultTo(1)

  table.date('issue_date').notNullable()
  table.date('due_date').notNullable()

  table.decimal('amount', 12, 2).notNullable()
  table.decimal('discount', 12, 2).notNullable().defaultTo(0)
  table.decimal('fine', 12, 2).notNullable().defaultTo(0)
  table.decimal('interest', 12, 2).notNullable().defaultTo(0)
  table.decimal('paid_amount', 12, 2).notNullable().defaultTo(0)

  table.string('status', 20).notNullable().defaultTo('open')
  table.text('notes').nullable()

  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()

  table.index(['company_id', 'due_date'], 'payables_company_due_date_idx')
  table.index(['company_id', 'status'], 'payables_company_status_idx')
  table.index(['company_id', 'supplier_id'], 'payables_company_supplier_idx')
  ```

  **Sem `deleted_at`** (hard delete). **Sem índice único** — duplicatas são
  permitidas (decisão do usuário). `supplier_id` com `RESTRICT`: não se apaga
  fornecedor que tenha título.

- **Catálogo de permissões** (`catalog.ts`): módulo `payables` com `view`,
  `create`, `edit`, `delete`, `name`/`description` em pt-BR.

- **Rótulo do módulo** (`frontend/src/permissions/module-labels.ts`):
  `payables: 'Contas a pagar'` — obrigatório, senão a tela de Permissões mostra
  o slug cru em inglês.

- **Camadas**: model `Payable` → `payable_repository` → `payable_service` →
  `payables_controller` → rotas `/api/payables` com `middleware.tenant()` e
  `middleware.permission(...)` por ação.
  - O **service** valida que o `supplier_id` existe e é do tenant.
  - O **service** calcula `total` e `balance` na serialização.
  - O **service** expõe `recomputeStatus(payable)` — **o único ponto do código
    que atribui `status`** (fora a ação de cancelar). Chamado no create e no
    update, e depois pelo módulo de baixa.

- **Validator VineJS** (pt-BR):
  - `documentNumber`: string, `trim`, 1–20 caracteres, obrigatório.
  - `installment`: inteiro 1–999, default 1.
  - `supplierId`: inteiro positivo, obrigatório (existência/tenant no service).
  - `issueDate`, `dueDate`: data `YYYY-MM-DD`, obrigatórias.
  - `amount`: número `> 0`, 2 casas.
  - `discount`, `fine`, `interest`: número `>= 0`, 2 casas, default 0.
  - **`status` e `paid_amount` não existem no validator** — são resultado, e o
    cliente não os envia. Se vierem no payload, são descartados pelo VineJS.
  - `notes`: `trim`, máx 1000, opcional. Vazio → `null`.
  - Regras cruzadas (`discount <= amount`, `dueDate >= issueDate`) no **service**
    → `BusinessException` (422), porque dependem de mais de um campo.

- **Listagem** — query params:

  | Param | Efeito |
  | ----- | ------ |
  | `documentNumber` | `lower(document_number) like %?%` (contém) |
  | `supplierId` | `supplier_id = ?` |
  | `dueFrom`, `dueTo` | `due_date between ?` (só quando enviados) |
  | `issueFrom`, `issueTo` | `issue_date between ?` |
  | `status` | **CSV de múltiplos** (`open,overdue`). Valores: `open`, `partially_paid`, `paid`, `cancelled`, **`overdue`**. Ausente/vazio = todos. Valor inválido é **ignorado**, não 422 (um bookmark velho não deve quebrar). |
  | `page`, `perPage`, `sort`, `order` | padrão da família |

  - `status` aceita **string ou array**: `?status=open,paid` já chega quebrado em
    array pelo parser de query string (e o axios manda a vírgula crua).
  - `overdue` **não** filtra a coluna: vira
    `due_date < :today AND status IN ('open','partially_paid')`, como **mais um
    ramo do OR** entre os status selecionados.
  - `SORT_COLUMNS` permitidos: `document_number`, `installment`, `issue_date`,
    `due_date`, `total`, `status`. Default `due_date asc`.
  - **`sort=total` ordena pela expressão, não pela coluna `amount`.** A tela
    exibe o total, então ordenar por "Valor" tem de ordenar por aquilo que está
    à vista — senão a coluna se contradiz:

    ```sql
    ORDER BY (amount - discount + fine + interest) <asc|desc>
    ```

    Sem índice (é expressão). Aceitável no volume desta aplicação; se um dia
    doer, o caminho é uma **coluna gerada** (`GENERATED ALWAYS AS ... STORED`)
    com índice, sem mudar o contrato da API.
  - A query faz `join` em `suppliers` para devolver `supplierName` (coluna
    "Cedente"), sem permitir ordenar por ele.

- **Serialização** de cada título: além das colunas, devolve
  `supplierName`, `total` e `balance` (o saldo), já calculados.

- **Erro de FK** (`23503`) na exclusão → **409** em pt-BR. Não há tratamento de
  `23505` (unicidade) porque não há índice único.

- **Seeder**: apenas as permissões novas. Sem títulos pré-cadastrados.

### Frontend

- **Rota** `/payables` em `router.tsx`, gated por `payables.view`, com `lazy()`.
- **Menu** (`permissions/menu.ts`): **grupo novo "Financeiro"** (ícone
  `Landmark`), posicionado **depois de "Cadastros"**, contendo "Contas a pagar"
  (ícone `Receipt`). Os filhos do grupo seguem em ordem alfabética (convenção
  atual do menu).
- **Página** `src/modules/payables/payables-page.tsx`, reusando `PageHeader`,
  `Pagination`, `SortableHeader`, `EmptyState`, `ConfirmDialog`, `Can`,
  `Skeleton`, `Badge`.
- **Filtros**: `Input` numérico + `EntityPicker` (cedente) + 2 blocos de
  intervalo de data (cada um: `Checkbox` + 2 `<input type="date">`) + `Select` de
  status + "Limpar filtros" (volta ao default, não ao vazio).
  - Os defaults do mês corrente são calculados **uma vez**, ao montar a tela.
- **Formulário** em modal `payable-form-dialog.tsx` (React Hook Form + Zod).
  **Sem campo de status** — no modo edição, o status atual pode ser exibido como
  um `Badge` read-only no cabeçalho do modal, nunca como `Select`:
  - **Moeda**: os 4 campos monetários usam o padrão já existente no projeto —
    string de **centavos** no form (`maskMoney` na exibição, `reaisToCents` /
    `centsToReais` nas fronteiras), como faz `service-form-dialog.tsx`. Nada novo
    a criar.
  - **Datas**: `<input type="date">` com string `YYYY-MM-DD`, como
    `customer-form-dialog.tsx` faz com `customerSince`.
  - **Fornecedor**: `<Controller>` + `<EntityPicker source="supplier" />`, com
    `value: number | null` (sem a sentinela `NONE` dos `Select`).
  - **Total e saldo** aparecem no rodapé do modal, **calculados ao vivo** conforme
    o usuário digita — é o feedback que evita erro de digitação em valor.
- **API client**: `src/services/payables-api.ts`.
- **Tipo `Payable`** em `types/api.ts` (com `supplierName`, `total`, `balance`).
- **QueryKey**: `['payables', companyId, listParams]`.
- **Exibição**:
  - Valores via `formatCurrency`; datas via formatação `dd/MM/yyyy`.
  - Vencimento em vermelho (`text-destructive`) quando vencido, pela regra acima.
    O backend devolve `isOverdue` já resolvido, para o cliente não recalcular
    "hoje" (**brecha 5**).
  - **Badge de status** — componente único `PayableStatusBadge` (fonte da cor e
    do rótulo, usado pela listagem **e** pelo modal, para não divergirem):

    | Status | Cor | Variante |
    | ------ | --- | -------- |
    | Aberto | cinza | `secondary` |
    | Pago parcial | azul | `info` |
    | Pago | verde | `success` |
    | Cancelado | vermelho | `destructive` |

    As variantes `success` e `info` **não existiam** no `Badge` — foram criadas,
    junto dos tokens `--success` / `--info` em `index.css` (claro e escuro). Cor
    fixa está fora de questão: quebraria o dark mode, que é regra do projeto.

## Critérios de aceite

- [ ] Migration cria `payables` com as 2 FKs `RESTRICT` e os índices de
      `due_date`, `status` e `supplier_id`; `up` e `down` rodam limpas.
- [ ] Catálogo traz `payables.view/create/edit/delete`; `module-labels.ts` traz
      `payables: 'Contas a pagar'`.
- [ ] Menu mostra o grupo **Financeiro** → **Contas a pagar** para quem tem
      `payables.view`; some inteiro para quem não tem.
- [ ] Endpoints `/api/payables` (GET listar, POST criar, GET detalhe, PUT editar,
      DELETE excluir) com gate de permissão e escopo de tenant.
- [ ] Criar título com fornecedor escolhido pelo EntityPicker persiste o
      `supplier_id` correto.
- [ ] Editar um título existente: o EntityPicker vem preenchido com o nome do
      fornecedor (hidratado a partir do `supplierId`).
- [ ] Fornecedor **inativo** vinculado continua exibido no EntityPicker, com
      `(inativo)`.
- [ ] `supplier_id` de **outra empresa** (id forjado) → 422 "Fornecedor inválido."
- [ ] Emissão e vencimento vêm com **a data de hoje** no formulário de criação;
      ordem vem `1`.
- [ ] **O formulário não tem campo de status**, nem no create nem no edit.
- [ ] Todo título criado nasce com `status = 'open'` e `paid_amount = 0`.
- [ ] Enviar `status: 'paid'` no payload de create/update **não** altera o status
      do registro (o campo é descartado) — o título continua "Aberto".
- [ ] `amount <= 0` → 422. `discount > amount` → 422. `dueDate < issueDate` → 422.
- [ ] `installment` fora de 1–999 → 422.
- [ ] Título **duplicado** (mesmo fornecedor + número + ordem) é **aceito** — não
      há unicidade, e o segundo lançamento salva normalmente.
- [ ] `total` e `balance` vêm calculados da API: `total = amount - discount + fine
      + interest`; `balance = max(0, total - paid_amount)`; **cancelado → balance 0**.
- [ ] **Recálculo do status na edição** (verificável assim que a baixa existir;
      até lá, forçando `paid_amount` no banco):
      - título **Pago** cujo `amount` é aumentado → salva como **Parcial**, com
        saldo igual à diferença;
      - título **Parcial** cujo `amount` cai até `<= paid_amount` → salva como
        **Pago**, com saldo `0` (nunca negativo).
- [ ] Editar um título **cancelado** → 422.
- [ ] Listagem: 20/página, ordenação default por vencimento asc; colunas Número,
      Ordem, Emissão, Vencimento, Valor e Status ordenáveis.
- [ ] A coluna **Valor** exibe o **total** (`amount + fine + interest - discount`),
      não o `amount`. Título de R$ 100 com R$ 10 de juros e R$ 5 de desconto
      aparece como **R$ 105,00**.
- [ ] Ordenar por **Valor** ordena pelo **total exibido**, não pelo `amount`: um
      título de `amount` 100 com total 105 vem **depois** de um de `amount` 102
      com total 102.
- [ ] Ao abrir a tela, o filtro de **vencimento** já vem marcado, do 1º ao último
      dia do mês corrente, e a listagem já vem filtrada.
- [ ] Desmarcar o checkbox de vencimento remove o filtro (a data não é enviada).
- [ ] Os dois intervalos (emissão e vencimento) podem estar ativos juntos e se
      somam.
- [ ] Filtro de status é **múltipla escolha**; **nenhum selecionado = todos** (o
      param não é enviado e a listagem não filtra por status).
- [ ] Marcar **Pago** + **Cancelado** devolve os dois conjuntos (OR).
- [ ] Filtro **Vencido** devolve só títulos com `due_date < hoje` **e** status
      aberto/parcial.
- [ ] Marcar **Pago** + **Vencido** devolve os quitados **e** os vencidos; um
      título quitado com vencimento no passado entra por "pago", **nunca** como
      vencido.
- [ ] Valor de status inválido na querystring é ignorado (não 422) e a listagem
      se comporta como "todos".
- [ ] Título que vence **hoje** **não** é considerado vencido (comparação
      estritamente menor), nem no filtro nem no vermelho.
- [ ] Vencimento aparece em **vermelho** só quando vencido; pago/cancelado com
      data passada não fica vermelho.
- [ ] "Limpar filtros" volta ao default (mês corrente), não ao vazio.
- [ ] Excluir abre `ConfirmDialog` e faz hard delete.
- [ ] Excluir um **fornecedor** que tenha título → 409.
- [ ] Multitenant: trocar de empresa invalida o cache e mostra só os títulos da
      empresa ativa.
- [ ] `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) passam.

## Brechas e considerações

Pontos que a spec **decidiu de um jeito** mas que merecem sua confirmação antes
da implementação.

### 1. Status é resultado, não escolha ✅ *decidido*

**Resolvido pelo usuário:** o status **não é editável**. É consequência das
baixas e do cancelamento, exatamente como descrito em
[Campos de resultado](#campos-de-resultado-não-editáveis). O formulário perdeu o
campo, o validator não aceita `status`, e o `recomputeStatus()` é o único ponto
de escrita.

Consequência para as **próximas specs**:

- A spec de **baixa** é a dona de `paid_amount` e a única a chamar
  `recomputeStatus()` fora deste CRUD.
- A spec de **cancelamento** ("Cancelar título") escreve `status = 'cancelled'`
  diretamente — é o único estado que **não** deriva de `paid_amount`, e é
  terminal (título cancelado não volta atrás nem é editável).

### 2. "Valor" na listagem ✅ *decidido — é sempre o total*

**Resolvido pelo usuário:** a coluna "Valor" exibe **sempre**
`amount + fine + interest - discount`. Nunca o `amount` cru.

Consequência já incorporada: para a coluna não se contradizer, `sort=total`
**ordena pela mesma expressão que exibe** (`ORDER BY (amount - discount + fine +
interest)`), e não pela coluna `amount`. Isso custa o índice nessa ordenação —
irrelevante no volume desta aplicação, e com saída conhecida (coluna gerada
`STORED` com índice) caso um dia pese.

### 3. Número do título como `number`

Você especificou `number`. Isso significa que **"000123" vira 123** e que um
número com letra ou traço (comum em nota fiscal / boleto: "12345/A") **não entra**.
Se o número do título sempre vier de um documento fiscal, `varchar(20)` costuma
ser a escolha mais segura — e o filtro poderia até virar "contém" em vez de
igualdade exata. **Recomendo `varchar`**, mas mantive `integer` como você pediu.

### 4. Unicidade ✅ *decidido — não haverá*

Eu tinha assumido um índice único em
`(company_id, supplier_id, document_number, installment)`. **O usuário descartou
a regra**: duplicatas são permitidas, e a spec foi ajustada (sem índice único,
sem 409 de `23505`).

Consequência assumida: nada impede lançar o mesmo título duas vezes por engano.
Se isso virar dor na operação, o caminho menos invasivo **não** é a constraint —
é um **aviso não-bloqueante** no formulário ("já existe um título 1234/1 para
este fornecedor; deseja lançar mesmo assim?"), que alerta sem barrar o caso
legítimo.

### 5. Qual é o "hoje" que decide o vencido

"Vencido" compara com a data atual, e isso é sensível a fuso: um servidor em UTC
vira o dia **21h no horário de Brasília**. Um título que vence hoje apareceria
como vencido nas últimas 3 horas do dia.

A spec resolve calculando "hoje" **no backend**, no fuso da aplicação, e mandando
`isOverdue` já pronto para o cliente. Vale confirmar qual fuso a aplicação assume
(`America/Sao_Paulo`) e se o Postgres/servidor está alinhado.

### 6. Multa e juros informados, não calculados

Aqui são **campos digitados**. Nenhum cálculo automático por atraso. Se a
expectativa é que o sistema calcule multa de 2% + juros de 1% a.m. sobre o
atraso, isso é outra feature (e provavelmente pertence à **baixa**, não ao
cadastro do título).

### 7. Editar o valor de um título já baixado ✅ *decidido*

**Resolvido pelo usuário:** a edição **é permitida** e o recálculo no save é o
comportamento **desejado**, não um efeito colateral a ser evitado. Quem tem
`payables.edit` pode aumentar o valor de um título **Pago**; ao salvar, o `total`
cresce, passa a superar o `paid_amount`, e o status vira **Parcial**.

Não há trava nem confirmação extra: o título simplesmente volta a dever a
diferença, que é o resultado correto. A regra está em
[Regras de negócio](#regras-de-negócio) e o `recomputeStatus()` já a implementa —
nenhum caso especial é necessário.

O único estado que **não** volta atrás é o **cancelado**: título cancelado não é
editável (422).

### 8. Cancelar ≠ excluir

Existem os dois: status `cancelled` e o hard delete. Vale alinhar a intenção —
o normal em financeiro é **cancelar** (mantém rastro) e **quase nunca excluir**.
Se for esse o caso, talvez a exclusão deva ser restrita a `payables.delete` para
poucos perfis, ou até sair de cena.
