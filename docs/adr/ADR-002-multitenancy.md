# ADR-002: Estrategia de Multi-Tenancy

## Status
Accepted

## Data
2026-02-28

## Contexto

O KegSafe e um SaaS multi-tenant onde cada cervejaria (tenant) deve ter isolamento completo de dados. Nenhum tenant pode acessar dados de outro tenant, mesmo em caso de bug na aplicacao.

Existem tres abordagens principais para multi-tenancy em PostgreSQL:

1. **Database per tenant:** Um banco de dados separado para cada tenant
2. **Schema per tenant:** Um schema PostgreSQL separado para cada tenant, no mesmo banco
3. **Shared schema com RLS:** Todas as tabelas compartilhadas, isolamento via Row-Level Security
4. **Shared schema com filtro na aplicacao:** Todas as tabelas compartilhadas, isolamento via filtros no ORM

A decisao impacta diretamente:
- Seguranca e isolamento de dados
- Complexidade de operacao (migrations, backups)
- Performance e escalabilidade
- Custo de infraestrutura

## Decisao

**Adotar shared schema com filtro na aplicacao via CLS (Continuation Local Storage) + Prisma middleware**, em vez de PostgreSQL RLS policies.

### Implementacao

```typescript
// tenant-context.middleware.ts
// Extrai tenantId do JWT e armazena no CLS
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.user?.tenantId;
    this.cls.set('tenantId', tenantId);
    next();
  }
}
```

```typescript
// prisma-tenant.middleware.ts
// Intercepta todas as queries Prisma e adiciona filtro tenantId
prisma.$use(async (params, next) => {
  const tenantId = cls.get('tenantId');

  if (tenantId && TENANT_SCOPED_MODELS.includes(params.model)) {
    // Adiciona filtro tenantId em todas as queries
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, tenantId };
    }
    if (params.action === 'create') {
      params.args.data = { ...params.args.data, tenantId };
    }
    if (params.action === 'update' || params.action === 'delete') {
      params.args.where = { ...params.args.where, tenantId };
    }
  }

  return next(params);
});
```

### Modelos com escopo de tenant

Todos os models de negocio possuem `tenantId` obrigatorio:

- `User`, `Barrel`, `Client`, `Supplier`, `ServiceProvider`
- `Geofence`, `ComponentConfig`, `Alert`, `AuditLog`
- `LogisticsEvent`, `MaintenanceOrder`, `Triage`, `Disposal`

### Modelos sem escopo de tenant

- `Tenant` (e o proprio tenant)
- `RefreshToken` (vinculado ao userId, nao ao tenant diretamente)

## Trade-offs

### Por que NAO usar PostgreSQL RLS

| Aspecto | RLS | Filtro na Aplicacao (escolhido) |
|---------|-----|-------------------------------|
| **Seguranca** | Isolamento no nivel do banco (mais seguro) | Isolamento no nivel da aplicacao (depende do middleware) |
| **Compatibilidade Prisma** | Prisma nao suporta RLS nativamente; requer `$queryRaw` ou `SET LOCAL` por transacao | Funciona nativamente com Prisma middleware |
| **Migrations** | Policies RLS precisam ser gerenciadas manualmente (fora do Prisma Migrate) | Tudo gerenciado pelo Prisma |
| **Performance** | Policies adicionam overhead em cada query | Filtro e um simples `WHERE` adicionado pelo ORM |
| **Debugging** | Dificil debugar policies silenciosas (query retorna vazio em vez de erro) | Middleware explicito, facil de logar e debugar |
| **Testes** | Complexo: precisa configurar `SET LOCAL` em cada teste | Simples: mockar CLS com tenantId desejado |
| **Complexidade operacional** | Alta: policies, roles PostgreSQL, grants | Baixa: middleware TypeScript padrao |

### Riscos da Abordagem Escolhida

1. **Bug no middleware pode expor dados cross-tenant:** Se o middleware falhar em adicionar o filtro, um tenant pode ver dados de outro.
   - **Mitigacao:** Testes automatizados que validam isolamento. Guard de seguranca que rejeita requests sem tenantId.

2. **Queries `$queryRaw` nao passam pelo middleware:** Queries SQL brutas precisam incluir `tenantId` manualmente.
   - **Mitigacao:** Lint rule ou code review obrigatorio para qualquer `$queryRaw`.

3. **Soft-delete pode vazar dados:** Se `deletedAt` nao for filtrado junto com `tenantId`.
   - **Mitigacao:** Middleware tambem adiciona `deletedAt: null` em todas as queries.

## Consequencias

### Positivas

- Desenvolvimento mais rapido com Prisma (sem necessidade de gerenciar policies SQL)
- Testes mais simples (mock do CLS)
- Debugging mais facil (middleware explicito com logs)
- Prisma Migrate gerencia todo o schema
- Performance previsivel (WHERE simples em indice composto `[tenantId, ...]`)

### Negativas

- Seguranca depende 100% da aplicacao (sem rede de seguranca do banco)
- Todo desenvolvedor precisa entender e respeitar o padrao CLS
- Queries raw (`$queryRaw`) sao pontos de risco
- Se Prisma passar a suportar RLS nativamente, considerar migracao

## Alternativas Consideradas

| Alternativa | Motivo da Rejeicao |
|-------------|-------------------|
| Database per tenant | Custo proibitivo (um PostgreSQL por cervejaria), migrations em N bancos |
| Schema per tenant | Complexidade de Prisma com multiplos schemas, migrations duplicadas |
| PostgreSQL RLS | Incompatibilidade com Prisma, complexidade operacional alta |
| Supabase RLS | Lock-in no Supabase, custo adicional, mesma incompatibilidade com Prisma |

## Referencias

- [Prisma Multi-Tenancy Guide](https://www.prisma.io/docs/guides/other/multi-tenancy)
- [NestJS CLS Module](https://github.com/Papooch/nestjs-cls)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
