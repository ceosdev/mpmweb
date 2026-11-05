# Spec: Criar telas de regionais e unidades (filhas de clientes)

Cadastro **pai-filho em dois níveis** dentro do cliente:

```txt
Cliente              Fundo Municipal de Saúde
 └─ Regional         Distrito 5
     └─ Unidade      Romero Marques
```

Espelha o padrão de `brand_models` (filho de `brands`, ver
[spec 015](015-criar-tela-modelos.md)), aplicado duas vezes em cascata. Os
campos seguem o
[simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
(descrição + status), com o recurso **escopado pelos pais via path**.

## Por que

No sistema Delphi, clientes grandes (prefeituras, fundos municipais) são
subdivididos em **Canal de atendimento** (`CAD_CLIENTE_CANAL_CCA`) e
**Unidade** (`CAD_CLIENTE_CANAL_UNIDADE_CCU`), ambos só com nome. Esses dois
níveis aparecem no cabeçalho do **Protocolo de Movimentação de Ativo**
("Canal de Atendimento: DISTRITO 5 / Unidade: ROMERO MARQUES").

Na migração para o MPM Web, o nível do meio passa a se chamar **Regional**:
"canal de atendimento" costuma significar meio de contato (telefone,
WhatsApp), e "Regional" é o termo que o setor público já usa (Distrito
Sanitário, GRE).

## Objetivo e escopo

- **Objetivo**: preparar o terreno para a futura **movimentação de ativos**,
  que vai referenciar cliente → regional → unidade.
- **Entra**: cadastro de regionais por cliente e de unidades por regional,
  com as mesmas informações do Delphi (só nome) + situação ativa/inativa.
- **Não entra**:
  - a movimentação de ativos e o protocolo (etapa futura);
  - importação das regionais/unidades existentes no Firebird (vai com a
    migração geral de dados);
  - campos novos (endereço, contato etc.) — decisão do usuário: "a mesma
    coisa do Delphi".

## Domínio
- **Regional** (feminino), filha de um cliente. Ex.: "Distrito 5".
- **Unidade** (feminino), filha de uma regional. Ex.: "Romero Marques".
- Um cliente tem **zero ou mais** regionais; uma regional tem **zero ou
  mais** unidades. A unidade **sempre** pertence a uma regional (como no
  Delphi) — não existe unidade direto no cliente.
- **Inativar não propaga**: inativar a regional não inativa as unidades dela,
  nem inativar o cliente afeta regionais/unidades. Cada nível tem sua própria
  situação. Inativos somem das listas de escolha futuras (movimentação), mas
  continuam no histórico.
- **Sem unicidade** de nome (mesma decisão de marcas/modelos).

## Banco de dados

### `customer_regions`
- `id`
- `company_id` FK `companies` `RESTRICT` — **denormalizado** (blindagem
  cross-tenant + queries escopadas simples).
- `customer_id` FK `customers` `RESTRICT` — autoridade do pai, vem do path.
- `description varchar(120)` **NOT NULL**.
- `is_active boolean` **NOT NULL** default `true`.
- timestamps.
- Índice `(customer_id, description)`.

### `customer_units`
- `id`
- `company_id` FK `companies` `RESTRICT` — denormalizado.
- `customer_region_id` FK `customer_regions` `RESTRICT` — autoridade do pai.
- `description varchar(120)` **NOT NULL**.
- `is_active boolean` **NOT NULL** default `true`.
- timestamps.
- Índice `(customer_region_id, description)`.

Não há `customer_id` em `customer_units`: o cliente é derivado pela regional
(o service sempre valida a cadeia cliente → regional pelo path).

**Hard delete** nas duas. O `RESTRICT` é quem bloqueia:
- excluir **cliente** com regional → 409 (o `customer_service.destroy` já
  converte FK violation em *"Não é possível excluir este cliente porque está
  em uso."* — nada a mudar);
- excluir **regional** com unidade → 409 *"Não é possível excluir esta
  regional porque está em uso."*;
- excluir **unidade** usada pela futura movimentação → 409 *"Não é possível
  excluir esta unidade porque está em uso."* (hoje é folha; o tratamento
  fica pronto por robustez).

## Permissões

**Nenhuma permissão nova** (decisão do usuário: quem usa a tela de cliente já
mantém regionais e unidades). Reusa as de clientes:

| Ação em regionais/unidades | Permissão exigida |
| --- | --- |
| Listar e consultar (`index`, `show`) | `customers.view` |
| Criar, editar, excluir (`store`, `update`, `destroy`) | `customers.edit` |

Manter regionais/unidades é editar o cliente — por isso `customers.edit` e
não `customers.create`/`customers.delete`. Como não há módulo novo, **nada
muda** em `catalog.ts` nem em `module-labels.ts`.

## API

Aninhada sob o cliente; os ids dos pais vêm **sempre do path**, nunca do body.

- `GET|POST /api/customers/:customerId/regions`
- `GET|PUT|DELETE /api/customers/:customerId/regions/:id`
- `GET|POST /api/customers/:customerId/regions/:regionId/units`
- `GET|PUT|DELETE /api/customers/:customerId/regions/:regionId/units/:id`

`customerId` e `regionId` entram no matcher global de ids numéricos de
`start/routes.ts` (junto de `brandId` etc.): `/customers/abc/regions` → 404.

Validação dos pais (service, padrão `ensureParent`):
- cliente inexistente ou de outra empresa → 404 neutro *"Cliente não
  encontrado."*;
- regional inexistente, de outra empresa **ou de outro cliente** → 404
  neutro *"Regional não encontrada."*;
- registro filho inexistente → 404 *"Regional não encontrada."* /
  *"Unidade não encontrada."*.

Listagem: busca por descrição (`?search=`, como `brand_models`), filtro de
situação (`?status=active|inactive|all`, como a listagem de clientes), paginação e ordenação
no padrão do simple-crud-pattern (com `pickSort`, `queryPositiveInt` etc. —
ver `backend/CLAUDE.md`). O `index` devolve só `data` + `meta`, como
`brand_models`: os dados do pai para o header vêm de chamadas próprias (ver
Frontend).

Validator: `description` obrigatória, trim, máx. 120; `isActive` boolean
(default `true` no create). Mensagens em pt-BR.

## Frontend

### Tela de Clientes (existente)
- Formulário em modal **não muda**.
- Cada linha ganha botão-ícone **Regionais** (lucide `Network`, sugestão),
  gated `customers.view`, que navega para `/customers/:customerId/regions`.

### Regionais de {cliente} — `/customers/:customerId/regions`
- Gated `customers.view`. **Sem item de menu.**
- Header "Regionais de {cliente}", link voltar "← Clientes".
- Busca por descrição e filtro de situação (default *Ativas*), disparados
  **só no clique em Pesquisar** (`useSearchFilters` + `SearchButton`, regra
  do projeto — sem debounce); paginação 20/página, colunas ordenáveis, badge
  Ativa/Inativa.
- O nome do cliente no header vem de `GET /customers/:customerId` (exige só
  `customers.view`), como Modelos carrega a marca com `brandsApi.get`.
  Nome exibido: **nome fantasia** se houver, senão razão social/nome
  completo (decisão do implementador, registrada aqui).
- Modal de create/edit com Descrição e Situação.
- Botões Novo/Editar/Excluir gated `customers.edit`.
- Cada linha tem botão-ícone **Unidades** (lucide `Building2`, sugestão),
  gated `customers.view`, que navega para
  `/customers/:customerId/regions/:regionId/units`.
- Módulo: `src/modules/customer-regions/`.

### Unidades de {regional} — `/customers/:customerId/regions/:regionId/units`
- Mesmo comportamento da tela de regionais (gates, filtros, modal).
- Header "Unidades de {regional}" com o cliente como subtítulo; link voltar
  "← Regionais de {cliente}". Regional e cliente carregados por
  `GET /customers/:customerId/regions/:regionId` e `GET /customers/:customerId`.
- Módulo: `src/modules/customer-units/`.

Pai inexistente/cross-tenant (404 da API) → estado "não encontrado" com link
de volta, igual às telas filhas existentes.

## Critérios de aceite
- Toda query escopada por `company_id` + pai(s) do path.
- Regional de outro cliente acessada pela URL de um cliente → 404, mesmo na
  mesma empresa.
- Usuário só com `customers.view` vê as telas e os botões de navegação, mas
  não vê Novo/Editar/Excluir e recebe 403 ao chamar POST/PUT/DELETE.
- Excluir cliente com regional, ou regional com unidade → 409 com a mensagem
  correspondente; nada é apagado.
- Inativar regional mantém as unidades com a situação que tinham.
- Demais critérios universais na rule simple-crud-pattern.
- `state.md` atualizado (2 tabelas novas → 38; endpoints; módulo entregue).

## Decisões do usuário
1. Nomenclatura: Cliente → **Regional** → **Unidade** (substitui "Canal de
   atendimento" do Delphi).
2. Dois níveis; cliente 1..N regionais; regional 1..N unidades.
3. Só o cadastro agora; movimentação de ativos depois.
4. Mesmos dados do Delphi (nome) + situação ativa/inativa.
5. Cada empresa vê só os seus.
6. Exclusão bloqueada em qualquer nível quando há uso.
7. Sem permissão própria: reusa as de clientes.
8. Nomes de tabela `customer_regions` / `customer_units`.
9. Telas em drill-down, mesmo padrão de Marcas → Modelos / Produtos → Ativos;
   no Delphi também são telas à parte.

## Deixado ao implementador
- Ícones exatos dos botões de navegação.
- Já decidido na revisão (calls do implementador, para conferência): dados
  do pai carregados à parte (não no `index`); filtro só no Pesquisar, sem
  debounce; nome exibido do cliente = fantasia, senão razão social.
- Nomes de arquivos/classes (seguindo `brand_models`).
- Ordenação padrão da listagem (seguir `brand_models`).
