# Spec: Criar tela de marca

CRUD simples padrão — ver rule [simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Domínio
- Entidade: marca
- Exemplos: Electrolux, LG, Samsung
- Justificativa de negócio: catalogar as marcas dos produtos/equipamentos atendidos pela empresa (ex.: marcas de ar-condicionado).

## Específicos do módulo
- Tabela: `brands`
- Slug do módulo: `brands`
- Endpoints: `/api/brands`
- Rota frontend: `/brands`
- Módulo frontend: `src/modules/brands/`
- Ícone (lucide-react): `Tags`
- Label do menu: "Marcas"

## Critérios de aceite
Padrão da rule simple-crud-pattern.
