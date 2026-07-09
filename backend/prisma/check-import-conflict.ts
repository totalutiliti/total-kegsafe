import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // QR Codes do xlsx (053 a 102)
  const xlsxQrCodes: string[] = [];
  for (let i = 53; i <= 102; i++) {
    xlsxQrCodes.push(`KS-BAR-${String(i).padStart(9, '0')}`);
  }
  console.log(`Total QR Codes no xlsx: ${xlsxQrCodes.length}`);
  console.log(`Range: ${xlsxQrCodes[0]} a ${xlsxQrCodes[xlsxQrCodes.length - 1]}\n`);

  // Verificar quais existem como qrCode no banco
  const existingByQr = await prisma.$queryRawUnsafe<{ qrCode: string; internalCode: string; status: string }[]>(
    `SELECT "qrCode", "internalCode", status FROM barrels WHERE "qrCode" = ANY($1::text[])`,
    xlsxQrCodes,
  );
  console.log(`QR Codes do xlsx que JA existem no banco: ${existingByQr.length}`);
  for (const b of existingByQr.slice(0, 5)) {
    console.log(`  QR: ${b.qrCode} | Code: ${b.internalCode} | Status: ${b.status}`);
  }
  if (existingByQr.length > 5) console.log(`  ... e mais ${existingByQr.length - 5}`);

  // Quais NÃO existem
  const existingQrSet = new Set(existingByQr.map(b => b.qrCode));
  const notExisting = xlsxQrCodes.filter(qr => !existingQrSet.has(qr));
  console.log(`\nQR Codes do xlsx que NAO existem no banco: ${notExisting.length}`);
  for (const qr of notExisting) {
    console.log(`  ${qr}`);
  }

  // Verificar chassis numbers do xlsx (CH-000001 a CH-000050)
  const xlsxChassis: string[] = [];
  for (let i = 1; i <= 50; i++) {
    xlsxChassis.push(`CH-${String(i).padStart(6, '0')}`);
  }
  const existingByChassis = await prisma.$queryRawUnsafe<{ chassisNumber: string; internalCode: string }[]>(
    `SELECT "chassisNumber", "internalCode" FROM barrels WHERE "chassisNumber" = ANY($1::text[])`,
    xlsxChassis,
  );
  console.log(`\nChassis do xlsx que JA existem no banco: ${existingByChassis.length}`);
  for (const b of existingByChassis.slice(0, 5)) {
    console.log(`  Chassis: ${b.chassisNumber} | Code: ${b.internalCode}`);
  }
  if (existingByChassis.length > 5) console.log(`  ... e mais ${existingByChassis.length - 5}`);
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
