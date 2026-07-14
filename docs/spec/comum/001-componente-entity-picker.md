# Spec: Componente EntityPicker (busca de entidade com muitos registros)

> 📦 **Não é uma tela.** Esta é a primeira spec da pasta `docs/spec/comum/`,
> reservada a **componentes e capacidades transversais** — coisas que servem a
> vários contextos de negócio e não pertencem a nenhum deles. As specs de tela
> continuam nas pastas de contexto (`cadastros/`, `financeiro/`, …).
>
> Esta spec **antecede** a tela de Contas a Pagar
> (`docs/spec/financeiro/001-criar-tela-contas-a-pagar.md`), que é a primeira
> consumidora do componente.

## Problema

Todo formulário que aponta para uma entidade de cadastro precisa de um jeito de
escolher o registro. Hoje o projeto tem **um jeito só**: carregar tudo num
`Select`. O formulário de produtos e o de ativos fazem exatamente isso —
`useQuery` com `perPage: 200` fixo e filtragem no cliente:

```ts
// frontend/src/modules/products/product-form-dialog.tsx
const groupsQuery = useQuery({
  queryKey: ['product-groups', companyId, 'options'],
  queryFn: () => productGroupsApi.list({ page: 1, perPage: 200, sort: 'description', order: 'asc' }),
  enabled: open,
})
```

Isso funciona para grupos de produto (dezenas de registros). **Não funciona para
fornecedor, cliente ou produto**, que chegam a milhares. O teto de 200 já está
registrado como risco aceito na [spec 013 — Produtos](../cadastros/013-criar-tela-produtos.md):
a partir do registro 201, o usuário simplesmente **não consegue selecionar** o
que precisa, e nada na tela explica o porquê.

A tela de Contas a Pagar exige escolher um fornecedor. É o gatilho para resolver
isso de uma vez, de forma reaproveitável.

## Solução proposta

Criar o componente **`EntityPicker`**: um campo que parece um `Input`, onde o
usuário digita e recebe uma lista de candidatos vinda do servidor; ao escolher,
o item vira um **chip com o rótulo e um `×`** para remover. O que trafega no
formulário e é persistido é sempre a **FK** (o `id`), nunca o rótulo.

- **Não acopla com fornecedor.** O componente conhece apenas um contrato
  (`EntitySource`). Cada entidade pesquisável registra uma implementação. Nesta
  entrega, duas: **fornecedor** e **cliente**. Acrescentar produto (ou qualquer
  outra) depois é criar um arquivo e adicionar uma linha no registry — sem tocar
  no componente.
- **Escolher entre `EntityPicker` e `Select` é decisão da tela**, caso a caso.
  O registry só torna a entidade *disponível* para busca; não obriga ninguém a
  usá-la assim. Cadastros pequenos (grupos, unidades, tipos) continuam em
  `Select`.
- **Múltipla seleção existe, mas é opt-in.** O componente suporta `multiple`;
  em Contas a Pagar o fornecedor é **um só**, então o modo simples é o default.
- **Busca no servidor, com debounce** (350 ms, o `useDebouncedValue` que o
  projeto já usa), a partir de **2 caracteres**.
- **Sem permissão própria.** Decisão explícita do usuário: *"o componente não
  precisa se preocupar com permissão; se o usuário tem acesso à tela onde o
  componente está, já é o suficiente"*. Isso tem consequência técnica direta —
  ver [Decisões técnicas → Backend](#backend).

## Domínio

- **Entidade**: nenhuma nova. O componente é infraestrutura de UI + endpoints de
  consulta sobre entidades que já existem.
- **Entidades pesquisáveis nesta entrega**: `supplier` (fornecedor) e `customer`
  (cliente).
- **Preparadas para depois** (fora de escopo aqui): produto, e o que mais vier.
- **Justificativa de negócio**: lançar um título a pagar exige apontar o
  fornecedor. Com milhares de fornecedores, rolar uma lista não é opção — o
  usuário sabe o nome (ou tem o CNPJ na nota) e quer digitar.

## Específicos do módulo

- **Tabela**: nenhuma (sem migration).
- **Slug do módulo**: nenhum (sem permissão própria).
- **Endpoints novos**: `GET /api/suppliers/lookup`, `GET /api/customers/lookup`
- **Rota frontend**: nenhuma (não é tela).
- **Módulo frontend**: `src/components/common/entity-picker/`
- **Primitivos novos**: `src/components/ui/command.tsx`, `src/components/ui/popover.tsx`
- **Dependência nova**: `cmdk`
- **Item de menu**: nenhum.

## Contrato

### O que a tela usa

```tsx
// modo simples (default) — value é a FK, ou null
<EntityPicker
  source="supplier"
  value={supplierId}          // number | null
  onChange={setSupplierId}    // (v: number | null) => void
/>

// modo múltiplo — value é a lista de FKs
<EntityPicker
  source="customer"
  multiple
  value={customerIds}         // number[]
  onChange={setCustomerIds}   // (v: number[]) => void
/>
```

Os props são uma **união discriminada** por `multiple`, então o TypeScript cobra
o formato certo do `value`/`onChange` em cada modo — sem cast na tela:

```ts
type EntityPickerBaseProps = {
  source: EntitySourceKey
  id?: string              // liga o <Label htmlFor>
  disabled?: boolean
  invalid?: boolean        // pinta a borda de erro (aria-invalid)
  placeholder?: string     // sobrescreve o placeholder do source
  minChars?: number        // default 2
}

type EntityPickerProps =
  | (EntityPickerBaseProps & {
      multiple?: false
      value: number | null
      onChange: (value: number | null) => void
    })
  | (EntityPickerBaseProps & {
      multiple: true
      value: number[]
      onChange: (value: number[]) => void
    })
```

### O que desacopla: `EntitySource`

```ts
export interface EntityOption {
  id: number
  label: string        // "Acme Distribuidora Ltda"
  sublabel?: string    // "12.345.678/0001-90" — desambigua homônimos
  isActive: boolean
}

export interface EntitySource {
  placeholder: string     // "Buscar fornecedor por nome ou CNPJ..."
  emptyMessage: string    // "Nenhum fornecedor encontrado."
  search(term: string, signal: AbortSignal): Promise<{ options: EntityOption[]; hasMore: boolean }>
  fetchByIds(ids: number[]): Promise<EntityOption[]>
}

export const ENTITY_SOURCES = {
  supplier: supplierSource,
  customer: customerSource,
} satisfies Record<string, EntitySource>

export type EntitySourceKey = keyof typeof ENTITY_SOURCES
```

É o `EntitySource` que traduz a entidade crua devolvida pelo endpoint em
`EntityOption` — **toda a apresentação mora aqui**:

```ts
// entity-sources.ts
const supplierSource: EntitySource = {
  placeholder: 'Buscar fornecedor por nome ou CNPJ...',
  emptyMessage: 'Nenhum fornecedor encontrado.',
  async search(term, signal) {
    const { data, hasMore } = await supplierLookupApi.search(term, signal)
    return { options: data.map(toOption), hasMore }
  },
  async fetchByIds(ids) {
    const { data } = await supplierLookupApi.byIds(ids)
    return data.map(toOption)
  },
}

// suppliers: label = name, sublabel = documento formatado
const toOption = (s: SupplierLookup): EntityOption => ({
  id: s.id,
  label: s.name,
  sublabel: maskTaxId(s.taxId),
  isActive: s.isActive,
})
```

O componente **nunca importa `suppliers-api` nem `customers-api`** — só o
registry. `EntitySourceKey` é derivado do registry, então registrar uma entidade
nova a torna imediatamente aceita pelo prop `source`, com autocomplete no editor.

### Como registrar uma entidade nova (ex.: produto)

1. Backend: adicionar `GET /api/products/lookup` (mesmo contrato do de fornecedor).
2. Frontend: `productSource` em `entity-sources.ts`, mapeando a resposta para
   `EntityOption`.
3. Frontend: uma linha em `ENTITY_SOURCES`.

Nada dentro de `entity-picker.tsx` muda.

## Comportamento esperado

### Fluxo feliz (modo simples)

- O campo aparece como um `Input` vazio com o placeholder do source
  ("Buscar fornecedor por nome ou CNPJ...").
- O usuário digita. A partir de **2 caracteres**, dispara a busca com
  **debounce de 350 ms**.
- O dropdown abre mostrando até **10 candidatos**, cada um com o **rótulo** em
  destaque e o **sublabel** (documento / nome fantasia) abaixo, em texto menor.
- O usuário escolhe com **mouse ou teclado** (setas ↑↓, `Enter` seleciona,
  `Esc` fecha).
- O item selecionado vira um **chip** — `[ Acme Distribuidora  × ]` — que **ocupa
  o lugar do input de busca**. O `onChange` dispara com o `id`.
- Clicar no `×` limpa a seleção (`onChange(null)`) e devolve o input de busca,
  já focado.

### Fluxo feliz (modo múltiplo)

- Igual, com duas diferenças: os chips se acumulam **dentro do próprio campo**,
  enfileirados antes do input (com quebra de linha quando não couberem), o input
  de busca **permanece** ao lado deles, e selecionar acrescenta ao array.
- Um item já selecionado **não reaparece** na lista de candidatos.
- `Backspace` com o input vazio remove o último chip.

### Fluxos alternativos

- **Menos de 2 caracteres**: o dropdown mostra a dica *"Digite ao menos 2
  caracteres"*. Nenhuma requisição é feita.
- **Nenhum resultado**: mostra o `emptyMessage` do source
  (*"Nenhum fornecedor encontrado."*).
- **Mais de 10 resultados**: a lista mostra os 10 primeiros e, no rodapé, o aviso
  *"Mostrando os 10 primeiros. Refine a busca."* (o backend devolve `hasMore`).
- **Buscando**: a lista mostra um estado de carregamento (`Skeleton` de 3 linhas),
  sem piscar o conteúdo anterior.
- **Erro na busca** (rede/500): a lista mostra, **inline**, *"Não foi possível
  buscar. Tente novamente."* — não usa `toast`, porque o erro é local ao campo e
  o usuário ainda está no meio da digitação.
- **Modo edição (hidratação)**: a tela abre passando só a FK
  (`value={7}`), sem rótulo. O componente detecta que não conhece o rótulo do
  `7`, chama `fetchByIds([7])` e renderiza o chip. Enquanto carrega, o chip
  aparece como `Skeleton` — o campo nunca "pisca vazio" dando a impressão de que
  o fornecedor se perdeu.
- **Registro inativo já vinculado**: um título antigo pode apontar para um
  fornecedor que depois foi inativado. A **busca** só devolve ativos, mas o
  **`fetchByIds` devolve mesmo se inativo**, e o chip ganha o sufixo
  `(inativo)`. Isso espelha o que os selects de produtos/ativos já fazem hoje —
  o vínculo não pode sumir da tela de edição.
- **Desabilitado**: `disabled` some com o input e com o `×`; o chip fica visível,
  em cinza.

### Regras de negócio

- **O valor é sempre a FK.** O componente entrega `number | null` (ou `number[]`)
  ao formulário. Rótulo é detalhe de apresentação e nunca é persistido.
- **Multitenant**: o lookup é escopado por `tenant.company.id`. Um usuário nunca
  encontra fornecedor/cliente de outra empresa (exceto ROOT, pela regra padrão do
  `TenantContext`).
- **Corrida de requisições**: cada busca nova **aborta a anterior** via
  `AbortSignal`. Sem isso, a resposta lenta de `"ac"` pode chegar depois da de
  `"acme"` e sobrescrever a lista com resultados errados.
- **Busca por nome ou documento**: o termo casa com o nome **ou** com o
  CPF/CNPJ. Ver a regra exata em [Decisões técnicas → Backend](#backend).
- **Só ativos na busca**: `is_active = true`. (Exceção do `fetchByIds`, acima.)
- **Deduplicação no modo múltiplo**: selecionar duas vezes o mesmo id não duplica
  o chip.

## Fora de escopo

- **Criar entidade pelo picker** ("+ Novo fornecedor" dentro do dropdown).
- **Scroll infinito / paginação no dropdown** — o limite é 10 + aviso "refine a
  busca". Se virar dor real, vira ajuste próprio.
- **Busca por qualquer entidade além de fornecedor e cliente.** Produto e demais
  ficam para quando houver tela que peça.
- **Migrar os selects existentes** (grupo→subgrupo em produtos, marca→modelo em
  ativos) para o picker. Eles continuam como estão; a decisão é tela a tela.
- **Cache compartilhado de rótulos** entre telas (um "dicionário" de id→label).
- **Busca com tolerância a erro de digitação** (fuzzy, trigram, unaccent).

## Decisões técnicas

### Backend

**O endpoint de lookup é novo e não reusa a listagem.** Motivo: `GET /api/suppliers`
é protegido por `middleware.permission('suppliers.view')`, e a decisão do usuário
é que o componente **não dependa de permissão** — quem tem acesso à tela de
Contas a Pagar precisa conseguir buscar fornecedor mesmo sem permissão para o
cadastro de fornecedores. Reusar a listagem devolveria **403** e o campo diria
"nenhum resultado", escondendo a causa real.

- **Rotas** (em `start/routes.ts`), dentro do grupo que já tem
  `middleware.auth() + middleware.tenant()`, **sem `middleware.permission(...)`**:

  ```ts
  router.get('/suppliers/lookup', [SuppliersController, 'lookup'])
  router.get('/customers/lookup', [CustomersController, 'lookup'])
  ```

  > ⚠️ Registrar `/suppliers/lookup` **antes** de `/suppliers/:id`, senão o
  > Adonis casa `lookup` como `:id` e o handler errado responde.

- **Superfície mínima**: a resposta devolve **apenas** os campos necessários para
  identificar o registro — id, nome(s), documento e status. Nada de endereço,
  e-mail, telefone ou o resto do cadastro; é o que torna aceitável expor o
  endpoint a qualquer usuário do tenant.

- **O endpoint devolve a entidade crua, não `label`/`sublabel`.** Quem traduz
  para `EntityOption` é o `EntitySource` no frontend — é exatamente a costura que
  o componente cria para isso. Assim o backend não carrega semântica de
  apresentação, e a formatação de CPF/CNPJ reusa o `maskTaxId` que já existe em
  `frontend/src/lib/masks.ts`, sem duplicar a lógica no servidor.

- **Query params**:

  | Param   | Tipo     | Obrigatório | Comportamento |
  | ------- | -------- | ----------- | ------------- |
  | `q`     | string   | não\*       | Termo de busca. Mínimo 2 caracteres (422 abaixo disso). |
  | `ids`   | string   | não\*       | CSV de ids (`"7,9"`), para hidratação. Máx 50 ids. |
  | `limit` | number   | não         | Default 10, máx 20. Ignorado quando `ids` está presente. |

  \* Exatamente **um** dos dois é obrigatório. Se vierem os dois, `ids` vence e
  `q` é ignorado. Se não vier nenhum → 422.

- **Formato da resposta** — envelope igual nos dois modos (busca e hidratação),
  para o cliente não ramificar; o `data` carrega os campos crus da entidade:

  ```jsonc
  // GET /api/suppliers/lookup
  {
    "data": [
      { "id": 7, "name": "Acme Distribuidora Ltda", "taxId": "12345678000190", "isActive": true }
    ],
    "hasMore": false
  }

  // GET /api/customers/lookup
  {
    "data": [
      { "id": 3, "legalName": "João da Silva", "tradeName": null, "taxId": "12345678901", "isActive": true }
    ],
    "hasMore": false
  }
  ```

  `taxId` vai **só com dígitos**, como está no banco. `hasMore` é sempre `false`
  no modo `ids`.

- **Como `hasMore` é calculado**: a query busca `limit + 1` registros; se voltar
  mais que `limit`, corta o excedente e marca `hasMore: true`. Evita um
  `count(*)` só para saber se há mais.

- **Regra de busca do `q`** (a mesma nos dois controllers, mudando as colunas):

  ```txt
  termo   = q.trim().toLowerCase()
  dígitos = q.replace(/\D/g, '')

  WHERE company_id = :tenant
    AND is_active = true
    AND (
          <colunas de nome> LIKE %termo%
       OR (dígitos.length >= 3 AND tax_id LIKE %dígitos%)
    )
  ORDER BY <coluna de rótulo> ASC
  LIMIT :limit + 1
  ```

  O `OR` do documento só entra quando o termo tem **3 ou mais dígitos** — assim
  digitar `"ac"` não varre `tax_id` à toa, e digitar `"12.345"` acha o CNPJ mesmo
  com a máscara (comparamos só dígitos, e `tax_id` já é armazenado só com dígitos).

- **Mapeamento por entidade** — o backend define o que **busca** e como **ordena**;
  o `EntitySource` (frontend) define como aquilo **aparece**:

  | | Fornecedor (`suppliers`) | Cliente (`customers`) |
  | --- | --- | --- |
  | Colunas pesquisadas (nome) | `name` | `legal_name` **e** `trade_name` |
  | `ORDER BY` | `name` | `legal_name` |
  | Campos devolvidos | `id`, `name`, `taxId`, `isActive` | `id`, `legalName`, `tradeName`, `taxId`, `isActive` |
  | → `label` (no source) | `name` | `legalName` |
  | → `sublabel` (no source) | `maskTaxId(taxId)` | `tradeName` ?? `maskTaxId(taxId)` |

- **Modo `ids`**: mesmo `SELECT`, sem o filtro `is_active` e sem `limit`,
  com `WHERE company_id = :tenant AND id IN (:ids)`. Ids inexistentes ou de outra
  empresa **são silenciosamente omitidos** do resultado (não 404, não vaza
  existência).

- **Camadas**: método `lookup` no controller existente
  (`suppliers_controller.ts`, `customers_controller.ts`) delegando para um método
  novo no service correspondente. Nenhum repository novo.

- **Validator VineJS** com mensagens em pt-BR: `q` mín 2 caracteres; `ids` CSV de
  inteiros positivos, máx 50; `limit` inteiro 1–20.

### Frontend

- **Dependência nova**: `cmdk` (base do `Command` do shadcn). O `Popover` sai do
  pacote `radix-ui` **já instalado** — não é dependência nova.

- **Primitivos novos** em `components/ui/`, seguindo o estilo new-york do shadcn:
  - `popover.tsx` — importando do pacote unificado
    (`import { Popover as PopoverPrimitive } from 'radix-ui'`), **igual ao
    `select.tsx` já existente**, e não do `@radix-ui/react-popover` avulso que a
    CLI do shadcn gera por padrão.
  - `command.tsx` — o `Command` do shadcn sobre `cmdk`.

- **`shouldFilter={false}` no `Command`.** Por padrão o `cmdk` filtra a lista no
  cliente. Aqui **quem filtra é o servidor** — deixar o filtro ligado faria o
  `cmdk` re-filtrar (e esconder) resultados que o backend já considerou válidos,
  por exemplo ao buscar por CNPJ, cujo texto não aparece no `label`.

- **Arquivos** em `src/components/common/entity-picker/`:

  ```txt
  entity-picker.tsx     # o componente (união discriminada de props)
  entity-sources.ts     # ENTITY_SOURCES: supplier, customer
  types.ts              # EntityOption, EntitySource, EntitySourceKey
  index.ts              # reexporta o que a tela consome
  ```

  A pasta `common/` é nova — é onde passam a morar componentes compartilhados de
  domínio, ao lado das já existentes `components/form/` e `components/data-table/`.

- **Busca** com TanStack Query:
  `useQuery({ queryKey: ['entity-lookup', source, companyId, debouncedTerm], queryFn: ({ signal }) => ENTITY_SOURCES[source].search(term, signal), enabled: term.length >= minChars })`.
  O `signal` que o TanStack Query já entrega **é** o `AbortSignal` do cancelamento —
  não precisamos gerenciar `AbortController` na mão.

- **Hidratação** com um segundo `useQuery`:
  `queryKey: ['entity-lookup-ids', source, companyId, ids]`, `enabled` apenas
  quando há ids **cujo rótulo o componente ainda não conhece**. Os rótulos já
  resolvidos ficam num `Map<number, EntityOption>` local, então trocar de item
  não refaz a busca do que já foi resolvido.

- **`companyId` na `queryKey`** (regra do projeto): trocar de empresa invalida o
  cache e impede que resultados da empresa anterior vazem para a nova.

- **Integração com React Hook Form**: via `<Controller>`, com o `value` sendo
  `number | null` **direto** — e não o padrão `string` + sentinela `NONE` usado
  nos `Select` dos forms existentes. Aquela sentinela existe porque o **Radix
  `Select` não aceita `value=""`**; o `EntityPicker` não tem essa restrição, e
  forçar string aqui só criaria conversão desnecessária. No Zod (o projeto usa
  **Zod v4**, onde `required_error` não existe mais — a mensagem vai em `error`):

  ```ts
  supplierId: z
    .number({ error: 'Selecione um fornecedor.' })
    .int()
    .positive()
  ```

- **Acessibilidade**: o `id` do prop liga o `<Label htmlFor>`; o input recebe
  `aria-invalid` quando `invalid`; o dropdown é uma `listbox` com
  `aria-activedescendant` (o `cmdk` cuida disso).

## Critérios de aceite

- [ ] `GET /api/suppliers/lookup?q=ac` devolve até 10 registros
      `{ id, name, taxId, isActive }` da empresa ativa, ordenados por nome, e
      `hasMore` correto.
- [ ] O endpoint responde **sem** a permissão `suppliers.view` — um usuário que só
      tem acesso à tela consumidora consegue buscar (não retorna 403).
- [ ] `GET /api/suppliers/lookup?q=1` (1 caractere) → 422 em pt-BR.
- [ ] `GET /api/suppliers/lookup` sem `q` e sem `ids` → 422 em pt-BR.
- [ ] Buscar por documento funciona: `q=12345` acha o fornecedor de CNPJ
      `12.345.678/0001-90`; `q=ac` **não** varre `tax_id`.
- [ ] `GET /api/customers/lookup?q=x` casa tanto em `legal_name` quanto em
      `trade_name`, e devolve `{ id, legalName, tradeName, taxId, isActive }`.
- [ ] O `customerSource` monta o `sublabel` com o nome fantasia e, quando ele for
      `null`, cai para o documento formatado — a formatação de CPF/CNPJ acontece
      **no source** (via `maskTaxId`), não no backend.
- [ ] A busca devolve **apenas ativos**; `?ids=7` devolve o registro 7 **mesmo
      inativo**, com `isActive: false`.
- [ ] `?ids=` com id de **outra empresa** devolve lista vazia — não 404, não vaza
      existência.
- [ ] A rota `/suppliers/lookup` não é capturada por `/suppliers/:id`.
- [ ] `<EntityPicker source="supplier">` busca com debounce de 350 ms e só a
      partir de 2 caracteres; abaixo disso mostra a dica e **não** faz requisição.
- [ ] Digitar rápido não embaralha a lista: a resposta de uma busca abortada
      nunca sobrescreve a atual.
- [ ] Selecionar um item vira chip com `×`; o `onChange` recebe o **id** (`number`),
      não o rótulo.
- [ ] Clicar no `×` limpa (`onChange(null)`) e devolve o input de busca focado.
- [ ] Teclado: `↑`/`↓` navegam, `Enter` seleciona, `Esc` fecha o dropdown.
- [ ] Modo edição: passando só `value={7}`, o chip aparece preenchido com o nome
      correto (hidratação via `?ids=7`), exibindo `Skeleton` enquanto carrega.
- [ ] Fornecedor inativo vinculado a um título antigo continua aparecendo no chip,
      com sufixo `(inativo)`.
- [ ] `multiple` acumula chips, não duplica o mesmo id, esconde da lista os já
      selecionados e remove o último chip com `Backspace` no input vazio.
- [ ] Mais de 10 resultados → aviso *"Mostrando os 10 primeiros. Refine a busca."*
- [ ] Erro de rede na busca → mensagem inline no dropdown (sem `toast`).
- [ ] Trocar de empresa ativa invalida o cache: a busca não devolve registros da
      empresa anterior.
- [ ] `ENTITY_SOURCES` tem `supplier` e `customer`; o componente **não importa**
      `suppliers-api` nem `customers-api` (verificável por grep em `entity-picker.tsx`).
- [ ] `npm run typecheck` (backend) e `npx tsc --noEmit` (frontend) passam.
