# Spec: Criar tela de clientes

> ⚠️ **Não é simple-CRUD puro.** O cadastro tem 17 campos (incluindo status e o
> flag de cliente interno), filtros específicos, enum de tipo PF/PJ e validação
> cruzada de CPF/CNPJ contra o tipo. A [rule simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
> diz para abandonar quando há mais do que descrição + status. Esta spec mantém a
> **mesma dinâmica** da família (paginação 20/página server-side, ordenação por
> colunas, formulário em modal, hard delete, badge de status, multitenant) — só
> amplia campos e filtros, na mesma linha do spec [010 — Fornecedores](./010-criar-tela-fornecedores.md).

## Problema

A plataforma precisa registrar os clientes de cada empresa (pessoas físicas e
jurídicas atendidas). Esses dados serão consumidos por módulos futuros (ordens
de serviço, contas a receber, vendas, agendamentos).

## Solução proposta

Criar tela de CRUD para gerenciar os clientes da empresa ativa.

- A entidade é **por empresa** (multitenant): cada empresa mantém os seus
  próprios clientes. Toda query é filtrada por `tenant.company.id`.
- Gerar as 4 permissões no catálogo: `customers.view`, `customers.create`,
  `customers.edit`, `customers.delete`. ROOT recebe tudo via curinga `*`.
- Apesar de ter muitos campos, o formulário é exibido em **modal** (decisão
  explícita do usuário) — modal mais largo (`max-w-3xl`) e com seções internas.
- O item entra no menu lateral, dentro do grupo **"Cadastros"**.

## Domínio

- **Entidade**: cliente.
- **Exemplos**: *João da Silva* (PF, cliente desde 2022); *Auto Peças Beta Ltda*
  (PJ, cliente desde 2024).
- **Justificativa de negócio**: futuras telas (OS, contas a receber, vendas)
  precisam apontar para um cliente cadastrado — este é o cadastro mestre.

## Específicos do módulo

- **Tabela**: `customers`
- **Slug do módulo**: `customers`
- **Endpoints**: `/api/customers`
- **Rota frontend**: `/customers`
- **Módulo frontend**: `src/modules/customers/`
- **Ícone (lucide-react)**: `Contact`
- **Label do menu**: "Clientes"
- **Grupo do menu**: "Cadastros"

## Campos

| Campo (UI, pt-BR)             | Coluna (DB, en)        | Tipo                          | Obrigatório | Observações |
| ----------------------------- | ---------------------- | ----------------------------- | ----------- | ----------- |
| Tipo                          | `type`                 | `varchar(20)` (enum)          | sim         | Valores no DB: `individual` \| `company`. Labels na UI: "Pessoa física" / "Pessoa jurídica". |
| Razão social / Nome completo  | `legal_name`           | `varchar(160)`                | sim         | Label na UI varia pelo tipo. PF: "Nome completo". PJ: "Razão social". |
| Nome fantasia                 | `trade_name`           | `varchar(160)`                | não         | Só aparece no formulário quando tipo = PJ. Coluna é nullable. |
| CPF / CNPJ                    | `tax_id`               | `varchar(14)`                 | sim         | Armazenado **sem máscara** (apenas dígitos); exibido com máscara na UI. PF=11 dígitos, PJ=14. |
| Endereço                      | `address`              | `varchar(160)`                | não         | Logradouro (sem número). |
| Número                        | `address_number`       | `varchar(20)`                 | não         | Aceita "S/N", "100 A" etc.; por isso string. |
| Complemento                   | `address_complement`   | `varchar(80)`                 | não         | |
| Bairro                        | `neighborhood`         | `varchar(80)`                 | não         | |
| Cidade                        | `city`                 | `varchar(80)`                 | não         | |
| CEP                           | `zip_code`             | `char(8)`                     | não         | Apenas dígitos. |
| Telefone                      | `phone`                | `varchar(20)`                 | não         | Apenas dígitos. |
| Celular                       | `mobile`               | `varchar(20)`                 | não         | Apenas dígitos. |
| E-mail                        | `email`                | `varchar(160)`                | não         | Valida formato se preenchido. **Sem unicidade.** |
| Cliente desde                 | `customer_since`       | `date`                        | não         | Default = hoje no create se ausente. Aceita data passada **ou futura**. |
| Contato                       | `contact_name`         | `varchar(120)`                | não         | Pessoa física de contato (para PJ). |
| Status                        | `is_active`            | `boolean` default `true`      | sim         | Toggle no form; badge "Ativo"/"Inativo" na listagem. |
| Cliente interno da oficina    | `is_internal`          | `boolean` default `false`     | sim         | Apenas armazenado; sem regra de negócio nesta versão. Default desmarcado no form. |

> **Idioma** (regra do projeto): nomes de colunas e enum em inglês; labels e
> mensagens em português. As máscaras de CPF/CNPJ, CEP e telefones já existem
> em [`frontend/src/lib/masks.ts`](../../../frontend/src/lib/masks.ts) e usam
> `MaskedInput`.

## Comportamento esperado

### Fluxo feliz

- O usuário com permissão `customers.view` acessa a tela pelo menu lateral
  ("Cadastros" → "Clientes").
- Vê a listagem paginada (20 por página, server-side) com as colunas:
  - **Nome** (ordenável, asc por default) — mostra `trade_name` se houver, senão `legal_name`.
  - **CPF/CNPJ** (mascarado, ordenável)
  - **Tipo** (badge: "PF" / "PJ", ordenável)
  - **Cidade**
  - **Telefone** (mascarado; mostra `phone`; se vazio mostra `mobile`; se ambos vazios, traço)
  - **Status** (badge "Ativo"/"Inativo", ordenável)
  - **Ações** (Editar / Excluir)
- Clica em "Novo cliente" (gated por `customers.create`) → abre o
  formulário em **modal** (`max-w-3xl`), organizado em seções:
  1. **Identificação** — Tipo (radio ou select), CPF/CNPJ, Razão social/Nome completo, Nome fantasia *(só PJ)*
  2. **Endereço** — CEP, Endereço, Número, Complemento, Bairro, Cidade
  3. **Contato** — Contato (nome), Telefone, Celular, E-mail
  4. **Dados do cliente** — Cliente desde (date picker), Cliente interno da oficina (toggle, default desmarcado)
  5. **Status** — toggle (default ativo)
- Preenche os campos obrigatórios (Tipo, Razão social/Nome completo, CPF/CNPJ). Submete.
- O registro é salvo, o modal fecha, a listagem atualiza e um toast de
  sucesso aparece.

### Fluxos alternativos

- **Editar**: clica no botão de editar (gated por `customers.edit`) → abre o mesmo modal preenchido. Trocar o tipo PF↔PJ no edit é permitido, mas a validação do CPF/CNPJ refaz a checagem.
- **Excluir**: clica em excluir (gated por `customers.delete`) → abre `ConfirmDialog` → **hard delete**. Se houver FK violation (módulo futuro referenciando), o backend traduz para 409 em pt-BR: *"Não é possível excluir este cliente porque está em uso."*.
- **Reativar**: editar um inativo e marcar o toggle de status como ativo. Inativos continuam visíveis na listagem (filtrados via combo de status, ver abaixo).

### Filtros

A tela de pesquisa tem 4 filtros, posicionados em uma linha entre o `PageHeader`
e o `Card` (regra `crud-search-and-filters`, mesma área do `Input` de busca dos
simple-CRUDs):

| Filtro     | Tipo            | Comportamento |
| ---------- | --------------- | ------------- |
| Nome       | `Input`         | Busca debounced (350 ms). Backend faz `lower(legal_name) like ? OR lower(trade_name) like ?`. |
| CPF/CNPJ   | `MaskedInput`   | Busca debounced; backend compara contra `tax_id` desmascarado. Aceita match parcial nos dígitos. |
| Tipo       | `Select`        | Opções: *Todos*, *Pessoa física*, *Pessoa jurídica*. Default *Todos*. |
| Status     | `Select`        | Opções: *Todos*, *Ativos*, *Inativos*. Default *Ativos* (esconde inativos por padrão, mas o usuário consegue ver para reativar). |

- Qualquer mudança de filtro reseta `page` para 1.
- Todos os filtros entram na `queryKey` e nos query params do GET.
- Botão "Limpar filtros" só aparece quando ao menos um filtro está ativo (e volta status a *Ativos*).

### Regras de negócio

- **Multitenant**: clientes pertencem à empresa ativa. Um usuário nunca vê
  clientes de outra empresa (exceto ROOT, que enxerga tudo).
- **CPF/CNPJ**: armazenado cru (somente dígitos); validação **cruzada com o tipo**:
  - `type = 'individual'` → exatamente 11 dígitos + algoritmo de CPF válido.
  - `type = 'company'` → exatamente 14 dígitos + algoritmo de CNPJ válido.
  - Mismatch entre tipo e número de dígitos → erro 422 com mensagem amigável (ex.: *"CNPJ deve conter 14 dígitos."*).
  - **Sem unicidade** — manter a dinâmica do simple-CRUD. (Se a unicidade for
    pedida depois, vira spec própria.)
- **Tipo**: enum estrito (`individual` | `company`). Não há "ambos".
- **CEP / Telefone / Celular**: armazenados como dígitos. Sem regex restritivo
  além de comprimento (CEP exatamente 8 quando presente; telefones 10–11 dígitos
  quando presentes).
- **E-mail**: opcional. Quando preenchido, valida formato (`vine.string().email()`). Sem unicidade.
- **Cliente desde**: opcional na entrada; quando ausente no create, o backend grava `today()`. **Sem restrição de futuro** (a empresa pode cadastrar clientes com data de início futura para contratos planejados).
- **Cliente interno da oficina**: simples flag boolean. Sem unicidade, sem permissão extra, sem comportamento especial no filtro. Default `false`. Regras de uso ficam para uma spec futura.
- **Status**: campo `is_active` boolean. Sempre visível na coluna da listagem.
- **Ordenação default**: nome ascendente. Colunas ordenáveis: Nome, CPF/CNPJ, Tipo, Cidade, Status (regra `crud-sortable-columns`).
- **Paginação**: server-side 20/página (regra `crud-pagination`).
- **Exclusão**: hard delete (sem `deleted_at`), consistente com a família.

## Fora de escopo

- Vínculo com outros módulos (OS, contas a receber, vendas) — vem nas specs deles.
- Importação em lote (CSV/planilha).
- Histórico / auditoria de mudanças.
- Múltiplos endereços, múltiplos contatos, múltiplos e-mails — campo único nesta versão.
- Unicidade de CPF/CNPJ ou e-mail por empresa.
- Anexar arquivos / documentos do cliente.
- Integração com Receita Federal / consulta automática de CNPJ.
- Regras de negócio em torno de "cliente interno da oficina" (ficam para spec futura quando o módulo de OS precisar diferenciar).
- Consulta de CEP (preencher endereço automaticamente).

## Decisões técnicas

### Backend

- **Migration** nova `create_customers_table`:
  ```ts
  table.increments('id').notNullable()

  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('companies').onDelete('RESTRICT')

  table.string('type', 20).notNullable() // 'individual' | 'company'
  table.string('legal_name', 160).notNullable()
  table.string('trade_name', 160).nullable()
  table.string('tax_id', 14).notNullable()

  table.string('address', 160).nullable()
  table.string('address_number', 20).nullable()
  table.string('address_complement', 80).nullable()
  table.string('neighborhood', 80).nullable()
  table.string('city', 80).nullable()
  table.specificType('zip_code', 'char(8)').nullable()

  table.string('phone', 20).nullable()
  table.string('mobile', 20).nullable()
  table.string('email', 160).nullable()

  table.date('customer_since').nullable()
  table.string('contact_name', 120).nullable()

  table.boolean('is_active').notNullable().defaultTo(true)
  table.boolean('is_internal').notNullable().defaultTo(false)

  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()

  table.index(['company_id', 'legal_name'], 'customers_company_legal_name_idx')
  table.index(['company_id', 'trade_name'], 'customers_company_trade_name_idx')
  table.index(['company_id', 'tax_id'], 'customers_company_tax_id_idx')
  ```
  **Sem `deleted_at`** (hard delete). Sem unique — duplicados são permitidos.

- **Catálogo de permissões** (`backend/app/abilities/catalog.ts`): adicionar
  módulo `customers` com `view`, `create`, `edit`, `delete`.

- **Camadas**: `Customer` model → `customer_repository` → `customer_service` →
  `customers_controller` → rota em `start/routes.ts` sob `/api/customers` com
  `middleware.tenant()` e `middleware.permission(...)` em cada ação.

- **Validator VineJS** com mensagens em pt-BR. Validações:
  - `type`: `enum(['individual','company'])`.
  - `legalName`: `trim`, mín 1, máx 160.
  - `tradeName`: `trim`, opcional, máx 160. String vazia → `null`.
  - `taxId`: `trim`, somente dígitos. Comprimento e algoritmo dependem do `type`:
    - `individual` → 11 dígitos + `isValidCpf`.
    - `company` → 14 dígitos + `isValidCnpj`.
    - Comprimento incoerente com o tipo → mensagem específica (*"CPF deve conter 11 dígitos."* / *"CNPJ deve conter 14 dígitos."*).
  - `address`, `addressNumber`, `addressComplement`, `neighborhood`, `city`, `contactName`: `trim`, opcional, máx conforme tabela. String vazia → `null`.
  - `zipCode`: opcional, exatamente 8 dígitos quando presente.
  - `phone`, `mobile`: opcional, 10 ou 11 dígitos quando presentes.
  - `email`: opcional, formato válido quando presente.
  - `customerSince`: opcional, data ISO (`vine.date()`). Sem restrição de futuro. Service preenche com `DateTime.now()` no create se ausente.
  - `isActive`: boolean, default `true` no create.
  - `isInternal`: boolean, default `false` no create.

- **Helper de CPF/CNPJ** em `backend/app/utils/tax-id.ts` (com `isValidCpf`, `isValidCnpj`). Se já tiver sido criado pelo spec [010 — Fornecedores](./010-criar-tela-fornecedores.md), reutilizar. Caso contrário, criar agora — o helper é compartilhado.

- **Listagem**: paginação 20/página server-side, ordenação default `legal_name asc`.
  Query params aceitos: `page`, `perPage`, `sort` (campo+direção), `name`,
  `taxId`, `type`, `status` (`active` | `inactive` | `all`).
  - `name` → `(lower(legal_name) like %?% or lower(trade_name) like %?%)`.
  - `taxId` → `tax_id like %?%` (depois de remover não-dígitos do parâmetro).
  - `type` → igualdade exata, ignora se ausente.
  - `status` default `active` (esconde inativos a menos que peçam).

- **Erro de FK na exclusão**: tratar no controller/exception handler para retornar
  409 com mensagem amigável em pt-BR (*"Não é possível excluir este cliente
  porque está em uso."*).

- **Seeder principal** (`main_seeder.ts`): apenas cadastra as permissões no catálogo.
  Sem clientes pré-cadastrados.

### Frontend

- **Rota nova** `/customers` em `routes/router.tsx`, gated por `customers.view`,
  registrada com `lazy()`.
- **Item no menu** ([`permissions/menu.ts`](../../../frontend/src/permissions/menu.ts)): dentro do grupo "Cadastros", com
  ícone `Contact` e label "Clientes". Posicionar logo após "Empresas" (clientes
  é cadastro mestre primário, antes dos tipos).
- **Página** `src/modules/customers/customers-page.tsx` reusando os blocos
  compartilhados: `PageHeader`, `Pagination`, `SortableHeader`, `EmptyState`,
  `ConfirmDialog`, `Can`, `Skeleton`, `Badge`, `MaskedInput`.
- **Filtros** acima da tabela: 1 `Input` (nome), 1 `MaskedInput` (cpf/cnpj),
  2 `Select` (tipo, status), 1 botão "Limpar filtros" condicional.
  - Hook `useDebouncedValue` (350 ms) para os 2 campos texto.
  - Toda mudança reseta `page = 1`.
- **Formulário** em modal: `src/modules/customers/customer-form-dialog.tsx` com
  React Hook Form + Zod, modal `max-w-3xl`, organizado em 5 seções (ver
  "Fluxo feliz"). Layout responsivo em 2 colunas no desktop nas seções de
  endereço/contato/dados do cliente; coluna única no mobile.
  - **Comportamento PF/PJ**: ao trocar o tipo, o label do campo `legal_name`
    alterna entre "Razão social" (PJ) e "Nome completo" (PF), e o campo
    `trade_name` aparece somente quando o tipo é PJ (com label "Nome fantasia").
    Quando o usuário troca de PJ para PF, o valor de `trade_name` é limpo no
    form (não persistido no submit).
  - **Máscara dinâmica de CPF/CNPJ**: a máscara segue o tipo selecionado
    (`formatCpf` para PF, `formatCnpj` para PJ). Se o usuário troca o tipo
    com valor já digitado, o campo é limpo (decisão simples para evitar dígitos
    inválidos pro novo tipo).
  - **Cliente desde**: input de data (default vazio no create; vem preenchido
    no edit). Backend é quem aplica o default `today()` se vier vazio.
- **API client**: `src/services/customers-api.ts`.
- **Tipo `Customer`** em `src/types/api.ts`.
- **QueryKey**: `['customers', companyId, debouncedName, debouncedTaxId, type, status, page, sort]`.
- **Exibição**:
  - CPF/CNPJ formatado via `formatTaxId(taxId)` (já existe em `lib/masks.ts`).
  - Telefone formatado via `formatPhone(...)`.
  - Coluna "Nome" mostra `trade_name` quando preenchido (nome fantasia tem
    precedência por ser o nome "comercial" usado no dia-a-dia); senão `legal_name`.
  - Coluna "Telefone" mostra `phone` mascarado; se vazio, mostra `mobile`
    mascarado; se ambos vazios, traço.
  - Badge de "Tipo": "PF" (variante `secondary`) ou "PJ" (variante `default`).

## Critérios de aceite

- [ ] Migration cria a tabela `customers` com FK + índices; `up` e `down` rodam limpas.
- [ ] Catálogo traz `customers.view/create/edit/delete`; ROOT acessa por curinga.
- [ ] Endpoints `/api/customers` (GET listar, POST criar, GET detalhe, PUT editar, DELETE excluir) com gates de permissão e escopo de tenant.
- [ ] Excluir um cliente referenciado (em módulos futuros) devolve 409 com mensagem pt-BR.
- [ ] Menu dinâmico mostra "Clientes" dentro de "Cadastros" para quem tem `customers.view`.
- [ ] Listagem paginada 20/página, ordenação default por nome asc; colunas Nome, CPF/CNPJ, Tipo, Cidade, Status ordenáveis.
- [ ] Filtros funcionam (nome com `like` em razão social **e** nome fantasia, cpf/cnpj com `like` em dígitos crus, tipo igualdade, status com default *Ativos*).
- [ ] "Limpar filtros" só aparece quando há filtro ativo e reseta tudo (volta status a *Ativos*).
- [ ] Modal de criação salva com CPF (PF) e CNPJ (PJ) válidos; rejeita inválidos com mensagem amigável.
- [ ] Tentar salvar PF com 14 dígitos (ou PJ com 11) retorna 422 com mensagem clara.
- [ ] Modal de edição vem preenchido com os valores atuais (inclusive máscaras formatadas na exibição). Trocar PF↔PJ no edit revalida CPF/CNPJ.
- [ ] No modal, ao trocar Tipo para PF, o campo "Nome fantasia" desaparece e o label do campo principal vira "Nome completo".
- [ ] No modal, ao trocar Tipo para PJ, o campo "Nome fantasia" aparece (opcional) e o label do principal vira "Razão social".
- [ ] Excluir abre `ConfirmDialog`; hard delete após confirmação.
- [ ] Tipo aceita apenas `individual` ou `company`; backend rejeita qualquer outro com 422.
- [ ] CEP exige 8 dígitos quando preenchido; telefones 10–11 dígitos quando preenchidos.
- [ ] E-mail aceita vazio; quando preenchido, formato inválido retorna 422.
- [ ] Cliente desde aceita vazio no create (backend grava hoje); aceita data passada e futura.
- [ ] Toggle "Cliente interno da oficina" vem desmarcado por default no create.
- [ ] Multitenant: trocar de empresa invalida o cache e mostra somente os clientes da empresa ativa.
- [ ] Inativos não aparecem por default (filtro *Ativos*), mas ficam visíveis ao trocar o filtro para *Todos* ou *Inativos*, com badge "Inativo" para permitir reativação.
