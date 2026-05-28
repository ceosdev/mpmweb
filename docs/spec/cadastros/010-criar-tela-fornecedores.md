# Spec: Criar tela de fornecedores

> ⚠️ **Não é simple-CRUD puro.** O cadastro tem 11 campos (além de status), filtros
> específicos e enum próprio — a [rule simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
> diz para abandonar quando há mais do que descrição + status. Esta spec mantém a
> **mesma dinâmica** da família (paginação 20/página server-side, ordenação por colunas,
> formulário em modal, hard delete, badge de status, multitenant) — só amplia campos
> e filtros.

## Problema

A plataforma precisa registrar os fornecedores de cada empresa (quem vende
mercadorias ou presta serviços para ela). Esses dados serão consumidos por
módulos futuros (contas a pagar, entradas de produto, ordens de serviço).

## Solução proposta

Criar tela de CRUD para gerenciar os fornecedores da empresa ativa.

- A entidade é **por empresa** (multitenant): cada empresa mantém os seus
  próprios fornecedores. Toda query é filtrada por `tenant.company.id`.
- Gerar as 4 permissões no catálogo: `suppliers.view`, `suppliers.create`,
  `suppliers.edit`, `suppliers.delete`. ROOT recebe tudo via curinga `*`.
- Apesar de ter muitos campos, o formulário é exibido em **modal** (decisão
  explícita do usuário) — modal mais largo (`max-w-2xl`) e com seções internas.
- O item entra no menu lateral, dentro do grupo **"Cadastros"**.

## Domínio

- **Entidade**: fornecedor.
- **Exemplos**: *Distribuidora ABC Ltda* (mercadoria), *Manutenção XYZ MEI* (serviço).
- **Justificativa de negócio**: futuras telas (compras, contas a pagar, OS) precisam
  apontar para um fornecedor cadastrado — este é o cadastro mestre.

## Específicos do módulo

- **Tabela**: `suppliers`
- **Slug do módulo**: `suppliers`
- **Endpoints**: `/api/suppliers`
- **Rota frontend**: `/suppliers`
- **Módulo frontend**: `src/modules/suppliers/`
- **Ícone (lucide-react)**: `Truck`
- **Label do menu**: "Fornecedores"
- **Grupo do menu**: "Cadastros"

## Campos

| Campo (UI, pt-BR) | Coluna (DB, en)   | Tipo                          | Obrigatório | Observações |
| ----------------- | ----------------- | ----------------------------- | ----------- | ----------- |
| CPF/CNPJ          | `tax_id`          | `varchar(14)`                 | sim         | Armazenado **sem máscara** (apenas dígitos); exibido com máscara na UI. |
| Nome              | `name`            | `varchar(120)`                | sim         | `trim`, mínimo 1 char. |
| Tipo              | `type`            | `varchar(20)` (enum)          | sim         | Valores no DB: `goods` \| `service`. Labels na UI: "Mercadoria" / "Serviço". Default no form: **"Mercadoria"** (`goods`). |
| Endereço          | `address`         | `varchar(160)`                | não         | Logradouro + número numa só string (consistente com `companies.address`). |
| Bairro            | `neighborhood`    | `varchar(80)`                 | não         |             |
| Cidade            | `city`            | `varchar(80)`                 | não         |             |
| CEP               | `zip_code`        | `char(8)`                     | não         | Apenas dígitos. |
| Telefone          | `phone`           | `varchar(20)`                 | não         | Apenas dígitos. |
| Celular           | `mobile`          | `varchar(20)`                 | não         | Apenas dígitos. |
| Contato           | `contact_name`    | `varchar(120)`                | não         | Pessoa física de contato no fornecedor. |
| Status            | `is_active`       | `boolean` default `true`      | sim         | Toggle no form; badge "Ativo"/"Inativo" na listagem. |

> **Idioma** (regra do projeto): nomes de colunas e enum em inglês; labels e
> mensagens em português. As máscaras de CPF/CNPJ, CEP e telefones já existem
> em [`frontend/src/lib/masks.ts`](frontend/src/lib/masks.ts) e usam
> `MaskedInput`.

## Comportamento esperado

### Fluxo feliz

- O usuário com permissão `suppliers.view` acessa a tela pelo menu lateral
  ("Cadastros" → "Fornecedores").
- Vê a listagem paginada (20 por página, server-side) com as colunas:
  - **Nome** (ordenável, asc por default)
  - **CPF/CNPJ** (mascarado)
  - **Tipo** (badge: "Mercadoria" / "Serviço")
  - **Cidade**
  - **Telefone** (mascarado; mostra celular se telefone vazio)
  - **Status** (badge "Ativo"/"Inativo")
  - **Ações** (Editar / Excluir)
- Clica em "Novo fornecedor" (gated por `suppliers.create`) → abre o
  formulário em **modal** (`max-w-2xl`), organizado em seções:
  1. **Identificação** — CPF/CNPJ, Nome, Tipo
  2. **Endereço** — CEP, Endereço, Bairro, Cidade
  3. **Contato** — Contato (nome), Telefone, Celular
  4. **Status** (toggle, default ativo)
- Preenche os campos obrigatórios. Submete.
- O registro é salvo, o modal fecha, a listagem atualiza e um toast de
  sucesso aparece.

### Fluxos alternativos

- **Editar**: clica no botão de editar (gated por `suppliers.edit`) → abre o mesmo modal preenchido.
- **Excluir**: clica em excluir (gated por `suppliers.delete`) → abre `ConfirmDialog` → **hard delete**. Se houver FK violation (módulo futuro referenciando), o backend traduz para 409 em pt-BR: *"Não é possível excluir este fornecedor porque está em uso."*.
- **Reativar**: editar um inativo e marcar o toggle de status como ativo. Inativos continuam visíveis na listagem (filtrados via combo de status, ver abaixo).

### Filtros

A tela de pesquisa tem 4 filtros, posicionados em uma linha entre o `PageHeader`
e o `Card` (regra `crud-search-and-filters`, mesma área do `Input` de busca dos
simple-CRUDs):

| Filtro     | Tipo     | Comportamento |
| ---------- | -------- | ------------- |
| Nome       | `Input`  | Busca debounced (350 ms), `lower(name) like ?` no backend. |
| CPF/CNPJ   | `MaskedInput` | Busca debounced; backend compara contra `tax_id` desmascarado. Aceita match parcial nos dígitos. |
| Tipo       | `Select` | Opções: *Todos*, *Mercadoria*, *Serviço*. Default *Todos*. |
| Status     | `Select` | Opções: *Todos*, *Ativos*, *Inativos*. Default *Todos* (ativos e inativos aparecem juntos; usuário filtra quando precisa). |

- Qualquer mudança de filtro reseta `page` para 1.
- Todos os filtros entram na `queryKey` e nos query params do GET.
- Botão "Limpar filtros" só aparece quando ao menos um filtro está ativo.

### Regras de negócio

- **Multitenant**: fornecedores pertencem à empresa ativa. Um usuário nunca vê
  fornecedores de outra empresa (exceto ROOT, que enxerga tudo).
- **CPF/CNPJ**: armazenado cru (somente dígitos); validação:
  - 11 dígitos → valida algoritmo de CPF
  - 14 dígitos → valida algoritmo de CNPJ
  - Outro tamanho → erro "CPF/CNPJ inválido."
  - **Sem unicidade** — manter a dinâmica do simple-CRUD. (Se a unicidade for
    pedida depois, vira spec própria.)
- **Tipo**: enum estrito (`goods` | `service`), **obrigatório**. No formulário, vem pré-selecionado como "Mercadoria" (`goods`). Não há "ambos".
- **CEP / Telefone / Celular**: armazenados como dígitos. Sem regex restritivo
  além de comprimento (CEP exatamente 8 quando presente; telefones 10–11 dígitos
  quando presentes).
- **Status**: campo `is_active` boolean. Sempre visível na coluna da listagem.
- **Ordenação default**: nome ascendente. Colunas ordenáveis: Nome, CPF/CNPJ, Tipo, Cidade, Status (regra `crud-sortable-columns`).
- **Paginação**: server-side 20/página (regra `crud-pagination`).
- **Exclusão**: hard delete (sem `deleted_at`), consistente com a família.

## Fora de escopo

- Vínculo com outros módulos (compras, contas a pagar, OS) — vem nas specs deles.
- Importação em lote (CSV/planilha).
- Histórico / auditoria de mudanças.
- Múltiplos endereços, múltiplos contatos, e-mails — campo único nesta versão.
- Unicidade de CPF/CNPJ por empresa.
- Anexar arquivos / documentos do fornecedor.
- Integração com Receita Federal / consulta automática de CNPJ.

## Decisões técnicas

### Backend

- **Migration** nova `create_suppliers_table`:
  ```ts
  table.increments('id').notNullable()

  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id').inTable('companies').onDelete('RESTRICT')

  table.string('tax_id', 14).notNullable()
  table.string('name', 120).notNullable()
  table.string('type', 20).notNullable() // 'goods' | 'service'
  table.string('address', 160).nullable()
  table.string('neighborhood', 80).nullable()
  table.string('city', 80).nullable()
  table.specificType('zip_code', 'char(8)').nullable()
  table.string('phone', 20).nullable()
  table.string('mobile', 20).nullable()
  table.string('contact_name', 120).nullable()
  table.boolean('is_active').notNullable().defaultTo(true)

  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()

  table.index(['company_id', 'name'], 'suppliers_company_name_idx')
  table.index(['company_id', 'tax_id'], 'suppliers_company_tax_id_idx')
  ```
  **Sem `deleted_at`** (hard delete). Sem unique — duplicados são permitidos.

- **Catálogo de permissões** (`backend/app/abilities/catalog.ts`): adicionar
  módulo `suppliers` com `view`, `create`, `edit`, `delete`.

- **Camadas**: `Supplier` model → `supplier_repository` → `supplier_service` →
  `suppliers_controller` → rota em `start/routes.ts` sob `/api/suppliers` com
  `middleware.tenant()` e `middleware.permission(...)` em cada ação.

- **Validator VineJS** com mensagens em pt-BR. Validações:
  - `taxId`: `trim`, somente dígitos, 11 ou 14 caracteres, **algoritmo válido** de
    CPF (11) ou CNPJ (14). Se o projeto ainda não tem helper de validação de
    CPF/CNPJ, criar em `backend/app/utils/tax-id.ts` (com `isValidCpf`, `isValidCnpj`).
  - `name`: `trim`, mín 1, máx 120.
  - `type`: obrigatório, `enum(['goods','service'])`.
  - `address`, `neighborhood`, `city`, `contactName`: `trim`, opcional, máx
    conforme tabela. String vazia → tratada como `null`.
  - `zipCode`: opcional, exatamente 8 dígitos quando presente. `null` aceito.
  - `phone`, `mobile`: opcional, 10 ou 11 dígitos quando presentes.
  - `isActive`: boolean, default `true` no create.

- **Listagem**: paginação 20/página server-side, ordenação default `name asc`.
  Query params aceitos: `page`, `perPage`, `sort` (campo+direção), `name`,
  `taxId`, `type`, `status` (`active` | `inactive` | `all`).
  - `name` → `lower(name) like %?%`.
  - `taxId` → `tax_id like %?%` (depois de remover não-dígitos do parâmetro).
  - `type` → igualdade exata, ignora se ausente.
  - `status` default `all` (lista ativos e inativos juntos; usuário filtra explicitamente).

- **Erro de FK na exclusão**: tratar no controller/exception handler para retornar
  409 com mensagem amigável em pt-BR (*"Não é possível excluir este fornecedor
  porque está em uso."*).

- **Seeder principal** (`main_seeder.ts`): apenas cadastra as permissões no catálogo.
  Sem fornecedores pré-cadastrados.

### Frontend

- **Rota nova** `/suppliers` em `routes/router.tsx`, gated por `suppliers.view`,
  registrada com `lazy()`.
- **Item no menu** (`permissions/menu.ts`): dentro do grupo "Cadastros", com
  ícone `Truck` e label "Fornecedores".
- **Página** `src/modules/suppliers/suppliers-page.tsx` reusando os blocos
  compartilhados: `PageHeader`, `Pagination`, `SortableHeader`, `EmptyState`,
  `ConfirmDialog`, `Can`, `Skeleton`, `Badge`, `MaskedInput`.
- **Filtros** acima da tabela: 1 `Input` (nome), 1 `MaskedInput` (cpf/cnpj),
  2 `Select` (tipo, status), 1 botão "Limpar filtros" condicional.
  - Hook `useDebouncedValue` (350 ms) para os 2 campos texto.
  - Toda mudança reseta `page = 1`.
- **Formulário** em modal: `src/modules/suppliers/supplier-form-dialog.tsx` com
  React Hook Form + Zod, modal `max-w-2xl`, organizado em 4 seções (ver
  "Fluxo feliz"). Layout responsivo em 2 colunas no desktop nas seções de
  endereço/contato; coluna única no mobile. `defaultValues` do form na criação:
  `type: 'goods'`, `isActive: true`; todos os outros campos vazios.
- **API client**: `src/services/suppliers-api.ts`.
- **Tipo `Supplier`** em `src/types/api.ts`.
- **QueryKey**: `['suppliers', companyId, debouncedName, debouncedTaxId, type, status, page, sort]`.
- **Exibição**:
  - CPF/CNPJ formatado via `formatTaxId(taxId)` (já existe em `lib/masks.ts`).
  - Telefone formatado via `formatPhone(...)`.
  - Coluna "Telefone" mostra `phone` mascarado; se vazio, mostra `mobile` mascarado; se ambos vazios, traço.

## Critérios de aceite

- [ ] Migration cria a tabela `suppliers` com FK + índices; `up` e `down` rodam limpas.
- [ ] Catálogo traz `suppliers.view/create/edit/delete`; ROOT acessa por curinga.
- [ ] Endpoints `/api/suppliers` (GET listar, POST criar, GET detalhe, PUT editar, DELETE excluir) com gates de permissão e escopo de tenant.
- [ ] Excluir um fornecedor referenciado (em módulos futuros) devolve 409 com mensagem pt-BR.
- [ ] Menu dinâmico mostra "Fornecedores" dentro de "Cadastros" para quem tem `suppliers.view`.
- [ ] Listagem paginada 20/página, ordenação default por nome asc; colunas Nome, CPF/CNPJ, Tipo, Cidade, Status ordenáveis.
- [ ] Filtros funcionam (nome com `like`, cpf/cnpj com `like` em dígitos crus, tipo igualdade, status com default *Ativos*).
- [ ] "Limpar filtros" só aparece quando há filtro ativo e reseta tudo (volta status a *Todos*).
- [ ] Modal de criação salva com CPF e CNPJ válidos; rejeita inválidos com mensagem amigável.
- [ ] Modal de edição vem preenchido com os valores atuais (inclusive máscaras formatadas na exibição).
- [ ] Excluir abre `ConfirmDialog`; hard delete após confirmação.
- [ ] Tipo obrigatório; aceita apenas `goods` ou `service`; backend rejeita ausência ou outro valor com 422. No form de criação vem pré-selecionado como "Mercadoria".
- [ ] CEP exige 8 dígitos quando preenchido; telefones 10–11 dígitos quando preenchidos.
- [ ] Multitenant: trocar de empresa invalida o cache e mostra somente os fornecedores da empresa ativa.
- [ ] Inativos aparecem na listagem por default (filtro *Todos*) com badge "Inativo" para permitir reativação; filtrar por *Ativos* ou *Inativos* limita conforme escolhido.
