# Spec: Criar tela de unidade de medida

CRUD simples padrão — ver rule [simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Domínio
- Entidade: unidade de medida
- Exemplos: Kg, Litro, Unidade, Metro
- Justificativa de negócio: cada empresa precisa cadastrar as unidades em que comercializa/movimenta seus produtos e serviços, sem assumir um conjunto global.

## Específicos do módulo
- Tabela: `units_of_measure`
- Slug do módulo: `units_of_measure`
- Endpoints: `/api/units-of-measure`
- Rota frontend: `/units-of-measure`
- Módulo frontend: `src/modules/units-of-measure/`
- Ícone (lucide-react): `Ruler`
- Label do menu: "Unidades de medida"

## Critérios de aceite
Padrão da rule simple-crud-pattern.
