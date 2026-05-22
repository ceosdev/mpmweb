# Spec: Criar tela de grupo de serviço

CRUD simples padrão — ver rule [simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Domínio
- Entidade: grupo de serviço
- Exemplos: Manutenção, Instalação, Consultoria
- Justificativa de negócio: cada empresa precisa agrupar os serviços que oferece em categorias próprias (ex.: separar manutenção de instalação) para organização interna e relatórios futuros.

## Específicos do módulo
- Tabela: `service_groups`
- Slug do módulo: `service_groups`
- Endpoints: `/api/service-groups`
- Rota frontend: `/service-groups`
- Módulo frontend: `src/modules/service-groups/`
- Ícone (lucide-react): `Wrench`
- Label do menu: "Grupos de serviço"

## Critérios de aceite
Padrão da rule simple-crud-pattern.
