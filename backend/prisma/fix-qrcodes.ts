/**
 * Script para corrigir QR Codes dos barris gerados em lote.
 * O bug: BarrelSequence nao foi inicializada pelo seed, causando offset de -1
 * nos QR codes gerados pelo generateBatch.
 *
 * Estrategia em 2 passos para evitar unique constraint violation:
 * 1. SET qrCode = 'FIX-' || internalCode (valor temporario)
 * 2. SET qrCode = REPLACE(qrCode, 'FIX-', '') (valor final)
 *
 * Uso: npx tsx prisma/fix-qrcodes.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Encontrar barris com QR Code no formato KS-BAR-% que não batem com internalCode
  const mismatched = await prisma.$queryRawUnsafe<
    { id: string; internalCode: string; qrCode: string }[]
  >(
    `SELECT id, "internalCode", "qrCode" FROM barrels WHERE "qrCode" LIKE 'KS-BAR-%' AND "internalCode" != "qrCode"`,
  );

  console.log(`Encontrados ${mismatched.length} barris com QR Code incorreto.`);

  if (mismatched.length === 0) {
    console.log('Nenhuma correção necessária.');
    return;
  }

  // Mostrar exemplos
  for (const b of mismatched.slice(0, 5)) {
    console.log(`  ${b.internalCode} | QR atual: ${b.qrCode} -> QR correto: ${b.internalCode}`);
  }
  if (mismatched.length > 5) {
    console.log(`  ... e mais ${mismatched.length - 5} barris`);
  }

  // Passo 1: SET qrCode = 'FIX-' || internalCode (temporário para evitar unique conflict)
  const step1 = await prisma.$executeRawUnsafe(
    `UPDATE barrels SET "qrCode" = 'FIX-' || "internalCode" WHERE "qrCode" LIKE 'KS-BAR-%' AND "internalCode" != "qrCode"`,
  );
  console.log(`Passo 1: ${step1} barris com QR temporário (FIX-KS-BAR-...)`);

  // Passo 2: SET qrCode = REPLACE(qrCode, 'FIX-', '') (valor final correto)
  const step2 = await prisma.$executeRawUnsafe(
    `UPDATE barrels SET "qrCode" = REPLACE("qrCode", 'FIX-', '') WHERE "qrCode" LIKE 'FIX-%'`,
  );
  console.log(`Passo 2: ${step2} barris com QR corrigido.`);

  console.log(`\n✅ Correção concluída!`);

  // Verificar
  const remaining = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM barrels WHERE "qrCode" LIKE 'KS-BAR-%' AND "internalCode" != "qrCode"`,
  );
  console.log(`Restantes com mismatch: ${remaining[0].count}`);

  // Mostrar resultado
  const fixed = await prisma.$queryRawUnsafe<
    { internalCode: string; qrCode: string }[]
  >(
    `SELECT "internalCode", "qrCode" FROM barrels WHERE "internalCode" LIKE 'KS-BAR-0000000%' ORDER BY "internalCode" LIMIT 5`,
  );
  console.log('\nAmostra após correção:');
  for (const b of fixed) {
    console.log(`  ${b.internalCode} | QR: ${b.qrCode}`);
  }
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
