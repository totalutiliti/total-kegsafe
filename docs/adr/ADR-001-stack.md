# ADR-001: Escolha de Stack Tecnologica

## Status
Accepted

## Data
2026-02-28

## Contexto

O KegSafe e um sistema SaaS multi-tenant para gestao de ativos (barris de chopp) voltado para cervejarias. O sistema precisa de:

- API RESTful robusta com autenticacao JWT e RBAC
- Suporte a multi-tenancy com isolamento completo de dados
- Deploy containerizado em cloud (Azure)
- Type-safety end-to-end para reduzir bugs em runtime
- ORM com migrations versionadas e type-safe queries
- Framework opinado com padrao de arquitetura definido (modulos, injecao de dependencia)
- Capacidade de escalar horizontalmente

A equipe de desenvolvimento tem experiencia com TypeScript e JavaScript.

## Decisao

### Backend: NestJS (TypeScript)

- Framework opinado com modulos, injecao de dependencia (DI), guards, interceptors, pipes
- Padrao de arquitetura modular que facilita separacao de dominios (auth, barrels, logistics, maintenance)
- Suporte nativo a decorators para RBAC (`@Roles`), validacao (`@IsEmail`), e documentacao (`@ApiProperty`)
- Ecossistema maduro com integracao Prisma, Passport, class-validator, class-transformer
- Guards globais (`JwtAuthGuard`, `RolesGuard`) para seguranca deny-by-default

### ORM: Prisma

- Schema-first: `schema.prisma` como fonte de verdade do modelo de dados
- Type-safe queries: PrismaClient gera tipos TypeScript automaticamente
- Migrations versionadas: `prisma migrate dev` para desenvolvimento, `prisma migrate deploy` para producao
- Prisma Studio para debug visual do banco
- Middleware para filtros automaticos de multi-tenancy (tenantId)

### Database: PostgreSQL

- Banco relacional robusto com suporte a JSON/JSONB (para `settings`, `changes`)
- Suporte a Row-Level Security (RLS) -- avaliado mas nao adotado (ver ADR-002)
- Suporte a indices compostos otimizados para queries multi-tenant
- Disponivel como servico gerenciado no Azure (Flexible Server)
- Tipos ricos: UUID, Timestamptz, Decimal, VarChar com limites

### Frontend: Next.js (React)

- SSR/SSG para performance e SEO (se necessario no futuro)
- Integracao natural com React e ecossistema
- API Routes para BFF (Backend-for-Frontend) se necessario
- Deploy simples via container Docker

## Consequencias

### Positivas

- **TypeScript end-to-end:** Backend (NestJS) e frontend (Next.js) usam TypeScript, permitindo compartilhamento de tipos e interfaces
- **Prisma simplifica migrations:** Schema declarativo, migrations automaticas, tipo-safe por padrao
- **NestJS fornece estrutura:** Modulos, DI, ciclo de vida de request bem definido
- **PostgreSQL robusto:** Suporte a transacoes ACID, JSON, indices avancados, disponivel como servico gerenciado

### Negativas

- **Prisma limita queries complexas:** Queries com JOINs multiplos, CTEs, ou window functions requerem `$queryRaw` (perda de type-safety)
- **NestJS tem learning curve:** Desenvolvedores vindos de Express puro precisam aprender decorators, DI, modulos, guards
- **Overhead do framework:** NestJS adiciona abstraccoes que podem ser desnecessarias para endpoints simples
- **Lock-in do Prisma:** Migrar para outro ORM (TypeORM, Drizzle) requer reescrever todas as queries e migrations

### Riscos Mitigados

- **Type-safety reduz bugs:** Erros de tipo capturados em compile-time em vez de runtime
- **Modularidade facilita testes:** Cada modulo NestJS pode ser testado isoladamente
- **Prisma previne SQL injection:** Queries parametrizadas por padrao

## Alternativas Consideradas

| Alternativa | Motivo da Rejeicao |
|-------------|-------------------|
| Express.js puro | Sem estrutura opinada, cada dev faz diferente |
| Fastify | Menos ecossistema que NestJS, sem DI nativo |
| TypeORM | Menos type-safe que Prisma, API mais verbosa |
| Drizzle ORM | Mais novo, menos documentacao e ecossistema |
| MongoDB | Sem suporte a RLS, relacoes fracas para dominio complexo |
| MySQL | Menos features que PostgreSQL (JSON, UUID nativo, RLS) |
