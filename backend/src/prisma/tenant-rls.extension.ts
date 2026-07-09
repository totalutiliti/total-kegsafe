import { Prisma } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';

/**
 * Extensão Prisma que injeta o contexto de tenant para o RLS do Postgres
 * (ver backend/prisma/rls/enable-rls.sql).
 *
 * Para CADA query, roda dentro de um $transaction que antes faz
 * set_config('app.tenant_id', <cls tenantId>, true). SUPER_ADMIN ativa
 * app.bypass_rls='on' (a policy libera acesso cross-tenant controlado).
 *
 * Quando NÃO há tenant no contexto (jobs de cron, /auth antes do login), a
 * query passa sem contexto — nesses caminhos você deve rodar como um papel
 * com BYPASSRLS ou setar o contexto manualmente.
 *
 * ⚠️ CAVEAT das transações explícitas: operações dentro de um
 * `prisma.$transaction(async (tx) => ...)` do próprio app rodam na conexão da
 * transação, que NÃO passa por esta extensão. Nesses pontos, chame
 * `setTenantContext(tx, tenantId, isSuperAdmin)` no início da transação.
 */
export function createTenantRlsExtension(cls: ClsService) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant-rls',
      query: {
        async $allOperations({ args, query }) {
          const tenantId = cls.get<string | undefined>('tenantId');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Prisma extension query() é tipado como any
          if (!tenantId) return query(args);
          const bypass =
            cls.get<string | undefined>('userRole') === 'SUPER_ADMIN'
              ? 'on'
              : 'off';
          const results = await client.$transaction([
            client.$executeRaw`SELECT set_config('app.bypass_rls', ${bypass}, true)`,
            client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
            query(args),
          ]);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- resultado do $transaction é any
          return results[results.length - 1];
        },
      },
    }),
  );
}

/**
 * Seta o contexto de tenant no início de uma $transaction interativa explícita,
 * para o RLS valer dentro dela. Use nas ~71 transações do app.
 */
export async function setTenantContext(
  tx: Prisma.TransactionClient,
  tenantId: string,
  isSuperAdmin = false,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.bypass_rls', ${isSuperAdmin ? 'on' : 'off'}, true)`;
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
}
