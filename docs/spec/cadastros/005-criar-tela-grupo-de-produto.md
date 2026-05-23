# Spec: Criar tela de grupo de produto

CRUD simples padrão — ver rule [simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Domínio
- Entidade: grupo de produto
- Exemplos: Ar condicionado, Máquinas e Equipamentos, Ferramentas
- Justificativa de negócio: cada empresa precisa agrupar os produtos que comercializa em categorias próprias (ex.: separar ar condicionado de ferramentas) para organização interna e relatórios futuros.

## Específicos do módulo
- Tabela: `product_groups`
- Slug do módulo: `product_groups`
- Endpoints: `/api/product-groups`
- Rota frontend: `/product-groups`
- Módulo frontend: `src/modules/product-groups/`
- Ícone (lucide-react): `Package`
- Label do menu: "Grupos de produto"

## Critérios de aceite
Padrão da rule simple-crud-pattern.
