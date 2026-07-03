# RLS multi-tenant (Row Level Security) — pacote de ativação

Defesa-em-profundidade: hoje o isolamento entre tenants é feito por `where { tenantId }`
na aplicação (testado, e a escrita cross-tenant já foi corrigida). O RLS adiciona um
**backstop no banco**: mesmo que uma query futura esqueça o filtro, o Postgres não
devolve/insere linhas de outro tenant.

> **Status:** mecanismo **validado** (PoC abaixo); **não** está ligado no app ainda,
> porque a ativação é acoplada à camada de acesso ao banco (ver passos). Ligar sem os
> passos 2–4 **zera as queries** e derruba o app.

## O que foi validado (PoC)

Em banco isolado, com `FORCE ROW LEVEL SECURITY` + role não-owner (`app_user`) + `set_config`:

| Cenário | Resultado |
|---|---|
| contexto = tenant A → `SELECT` | vê só as linhas de A |
| contexto = tenant B → `SELECT` | vê só as linhas de B |
| **sem contexto** → `SELECT` | **0 linhas** (fail-closed) |
| contexto = A, `INSERT` linha de B | **ERRO** — `violates row-level security policy` |

## Arquivos

- `enable-rls.sql` — cria `app_user`, grants, `ALTER DEFAULT PRIVILEGES`, e liga
  RLS+`FORCE`+policy `tenant_isolation` (fail-closed, com bypass de super-admin) nas 16
  tabelas com `tenantId`. Idempotente. Rodar como **owner** (kegsafe).
- `../../src/prisma/tenant-rls.extension.ts` — extensão Prisma que injeta
  `set_config('app.tenant_id', …)` por query, e o helper `setTenantContext(tx, …)` para as
  transações interativas explícitas.

## Passos de ativação (deliberados, acoplados)

**1. Rodar o SQL** (troque a senha de `app_user` por um segredo do cofre):
```bash
psql "$OWNER_DATABASE_URL" -f backend/prisma/rls/enable-rls.sql
```

**2. Separar as conexões** (o app runtime vira `app_user`; migrations/seed continuam como owner):
- `DATABASE_URL` → `postgresql://app_user:<senha>@host:5432/db` (runtime da app).
- `MIGRATE_DATABASE_URL` → connection string do **owner** (kegsafe/app_migrations).
- No `backend/Dockerfile`, trocar o `CMD` para migrar com o owner e rodar a app como app_user:
  ```dockerfile
  CMD ["sh","-c","DATABASE_URL=$MIGRATE_DATABASE_URL npx prisma migrate deploy && node dist/src/main"]
  ```
  (o processo Node herda `DATABASE_URL` = app_user; só o `migrate deploy` usa o owner).

**3. Ligar a extensão** no `PrismaService` (`src/prisma/prisma.service.ts`):
```ts
import { createTenantRlsExtension } from './tenant-rls.extension.js';
// ... no construtor, após super():
return super({ adapter } as any).$extends(createTenantRlsExtension(this.cls)) as any;
// (ajuste o tipo de retorno; a instância estendida substitui o cliente base)
```

**4. Transações explícitas** (o app tem ~71 `$transaction` interativas): no início de cada uma,
chamar `await setTenantContext(tx, tenantId, isSuperAdmin)` — senão o RLS bloqueia as queries
dentro delas (a extensão não alcança a conexão da transação interativa).

## Teste (2 tenants)
1. Crie um 2º tenant + alguns barris nele (via super-admin ou seed).
2. Logado como ADMIN do tenant A, tente `GET /barrels/:id` de um barril do tenant B → **404/empty**
   mesmo removendo o filtro app-level (o RLS bloqueia).
3. Rode a suíte de integração (`npm run test:integration`) apontando para um banco com RLS ligado.

## Rollback
```sql
-- desliga RLS em todas as tabelas
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['alerts','audit_logs','barrel_batches','barrels','clients',
    'component_configs','disposals','geofences','idempotency_keys','logistics_events',
    'maintenance_logs','maintenance_orders','service_providers','suppliers','triages','users']
  LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  END LOOP;
END $$;
```
E reverter `DATABASE_URL` para o owner.
