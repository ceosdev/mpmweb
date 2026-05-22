# Spec: Criar tela de tipo de documento

CRUD simples padrão — ver rule [simple-crud-pattern](../../../frontend/.agents/skills/mpmweb-ui-patterns/rules/simple-crud-pattern.md).

## Domínio
- Entidade: tipo de documento
- Exemplos: NF-e, NFS-e, Recibo, Boleto
- Justificativa de negócio: classificar os documentos da empresa (fiscais, financeiros etc.) para uso em módulos consumidores futuros.

## Específicos do módulo
- Tabela: `document_types`
- Slug do módulo: `document_types`
- Endpoints: `/api/document-types`
- Rota frontend: `/document-types`
- Módulo frontend: `src/modules/document-types/`
- Ícone (lucide-react): `FileText`
- Label do menu: "Tipos de documento"

## Critérios de aceite
Padrão da rule simple-crud-pattern.
