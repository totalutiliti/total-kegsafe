import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Verificacao de Duplicatas Globais ===\n');

  const qrDups = await prisma.$queryRawUnsafe<{ qrCode: string; cnt: bigint }[]>(
    `SELECT "qrCode", COUNT(*) as cnt FROM barrels WHERE "deletedAt" IS NULL AND "qrCode" IS NOT NULL GROUP BY "qrCode" HAVING COUNT(*) > 1`,
  );
  console.log('qrCode duplicados globais:', qrDups.length);
  for (const d of qrDups) console.log(`  ${d.qrCode} - ${d.cnt} ocorrencias`);

  const codeDups = await prisma.$queryRawUnsafe<{ internalCode: string; cnt: bigint }[]>(
    `SELECT "internalCode", COUNT(*) as cnt FROM barrels WHERE "deletedAt" IS NULL GROUP BY "internalCode" HAVING COUNT(*) > 1`,
  );
  console.log('internalCode duplicados globais:', codeDups.length);
  for (const d of codeDups) console.log(`  ${d.internalCode} - ${d.cnt} ocorrencias`);

  const seq = await prisma.$queryRawUnsafe<{ lastNumber: number }[]>(
    `SELECT "lastNumber" FROM barrel_sequences WHERE key = 'global'`,
  );
  console.log('\nBarrelSequence lastNumber:', seq[0]?.lastNumber);

  const maxCode = await prisma.$queryRawUnsafe<{ max_num: number }[]>(
    `SELECT MAX(CAST(SUBSTRING("internalCode" FROM 8) AS INTEGER)) as max_num FROM barrels WHERE "internalCode" LIKE 'KS-BAR-%' AND "deletedAt" IS NULL`,
  );
  console.log('Max KS-BAR number no DB:', maxCode[0]?.max_num);

  const ok = qrDups.length === 0 && codeDups.length === 0;
  console.log(`\n=== ${ok ? 'SEM DUPLICATAS - pode migrar!' : 'DUPLICATAS ENCONTRADAS - resolver antes!'} ===`);
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
