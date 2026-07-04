# Spec: Criar tela de modelos (filha de marcas)

Cadastro **pai-filho** — modelo pertence a uma marca. Espelha o padrão de
`product_subgroups` (filho de `product_groups`); os campos seguem o
[simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md)
(descrição + status), mas o recurso é **escopado por um pai** via path.

## Domínio
- Entidade: modelo (masculino), filho de uma marca.
- Exemplos: modelos de uma marca de ar-condicionado (ex.: da Electrolux → "Chill Inverter", "Ecoturbo").
- Justificativa de negócio: catalogar os modelos atendidos dentro de cada marca.

## Específicos do módulo
- Tabela: `brand_models` (`id`, `company_id` FK companies RESTRICT, `brand_id` FK brands RESTRICT, `description varchar(120)`, `is_active`, timestamps; índice `(brand_id, description)`).
- `company_id` **denormalizado** (também derivável de `brand_id`) para blindar acesso cross-tenant e simplificar as queries escopadas.
- Slug do módulo: `brand_models` (permissões `brand_models.view/create/edit/delete`).
- Endpoints (aninhados sob a marca): `GET|POST /api/brands/:brandId/models`, `GET|PUT|DELETE /api/brands/:brandId/models/:id`. O `brandId` vem **sempre do path** — o cliente não injeta o pai pelo body.
- Rota frontend: `/brands/:brandId/models` (gated por `brand_models.view`). **Sem item de menu.**
- Módulo frontend: `src/modules/brand-models/`.
- Acesso: botão ícone `Shapes` (lucide-react) em cada linha da tela de Marcas (gated por `brand_models.view`) que navega para `/brands/:brandId/models`.

## Critérios de aceite
- Backend valida que a marca pai existe no tenant ativo antes de listar/criar (404 neutro *"Marca não encontrada."*).
- Toda query escopada por `company_id` + `brand_id`.
- Hard delete; FK violation na exclusão → 409 *"Não é possível excluir este modelo porque está em uso."*.
- Página drill-down: header "Modelos de {marca}", link voltar "← Marcas", valida o pai, busca por descrição (debounced), paginação 20/página, colunas ordenáveis, badge Ativo/Inativo, modal de create/edit.
- Demais critérios universais na rule simple-crud-pattern.
