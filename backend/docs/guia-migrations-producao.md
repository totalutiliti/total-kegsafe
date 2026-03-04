# Guia de Migrations em Produção — KegSafe

## Fluxo Padrão

O deploy usa `npx prisma migrate deploy` para aplicar migrations pendentes.

## Criando Índices em Tabelas Grandes (500k+ registros)

Quando precisar criar índice em tabela com muitos registros, use `CONCURRENTLY` para não travar a tabela:

1. Crie a migration com `--create-only`:

   ```bash
   npx prisma migrate dev --name add_index_nome --create-only
   ```

2. Edite o SQL gerado. A primeira linha DEVE ser `-- CreateIndex`:

   ```sql
   -- CreateIndex
   CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_nome"
     ON "tabela" USING tipo ("coluna");
   ```

3. NÃO misture outros DDL (CREATE TABLE, ALTER TABLE, CREATE EXTENSION) na mesma migration. Se precisar, use migrations separadas.

4. Aplique:

   ```bash
   npx prisma migrate dev
   ```

5. Verifique se o índice não ficou inválido:

   ```sql
   SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE NOT indisvalid;
   ```

## Referências

- [Prisma — CreateIndex comment](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/mental-model)
- [PostgreSQL — CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html)
