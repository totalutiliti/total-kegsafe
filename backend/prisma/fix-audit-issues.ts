/**
 * Corrige os 3 problemas encontrados na auditoria do banco.
 * 1. CRITICAL: barrel_sequences.lastNumber desatualizado (53 -> 104)
 * 2. MEDIUM: Alerta ativo para barril descartado
 * 3. LOW: Refresh tokens expirados acumulados
 *
 * Uso: npx tsx prisma/fix-audit-issues.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Correcao dos problemas da auditoria ===\n');

  // 1. CRITICAL: Corrigir barrel_sequences lastNumber
  console.log('1/3 [CRITICAL] barrel_sequences...');
  const maxCode = await prisma.$queryRawUnsafe<{ max_num: number }[]>(
    `SELECT MAX(CAST(SUBSTRING("internalCode" FROM 8) AS INTEGER)) as max_num FROM barrels WHERE "internalCode" LIKE 'KS-BAR-%'`,
  );
  const maxNumber = maxCode[0]?.max_num || 0;
  console.log(`  Maior numero de barril encontrado: ${maxNumber}`);

  await prisma.$executeRawUnsafe(
    `UPDATE barrel_sequences SET "lastNumber" = $1 WHERE key = 'global' AND "lastNumber" < $1`,
    maxNumber,
  );
  const seqAfter = await prisma.$queryRawUnsafe<{ lastNumber: number }[]>(
    `SELECT "lastNumber" FROM barrel_sequences WHERE key = 'global'`,
  );
  console.log(`  lastNumber atualizado para: ${seqAfter[0]?.lastNumber}`);
  console.log('  OK\n');

  // 2. MEDIUM: Resolver alertas ativos de barris descartados
  console.log('2/3 [MEDIUM] Alertas de barris descartados...');
  const alertsFix = await prisma.$executeRawUnsafe(
    `UPDATE alerts SET status = 'RESOLVED', "resolvedAt" = NOW(), "resolutionNotes" = 'Auto-resolvido: barril descartado' WHERE status = 'ACTIVE' AND "barrelId" IN (SELECT id FROM barrels WHERE status = 'DISPOSED')`,
  );
  console.log(`  ${alertsFix} alerta(s) resolvido(s)`);
  console.log('  OK\n');

  // 3. LOW: Limpar refresh tokens expirados
  console.log('3/3 [LOW] Refresh tokens expirados...');
  const tokensFix = await prisma.$executeRawUnsafe(
    `DELETE FROM refresh_tokens WHERE "expiresAt" < NOW()`,
  );
  console.log(`  ${tokensFix} token(s) expirado(s) removido(s)`);
  console.log('  OK\n');

  console.log('=== Todas as correcoes aplicadas com sucesso! ===');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
