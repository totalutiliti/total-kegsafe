import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Unlock all locked users and reset failed attempts
  const result = await prisma.$executeRawUnsafe(
    `UPDATE users SET "failedLoginAttempts" = 0, "lockedUntil" = NULL WHERE "failedLoginAttempts" > 0 OR "lockedUntil" IS NOT NULL`,
  );
  console.log(`Unlocked ${result} user(s)`);

  // Show users
  const users = await prisma.$queryRawUnsafe<{ email: string; role: string; failedLoginAttempts: number }[]>(
    `SELECT email, role, "failedLoginAttempts" FROM users WHERE "deletedAt" IS NULL ORDER BY role, email`,
  );
  for (const u of users) {
    console.log(`  ${u.role.padEnd(15)} ${u.email} (failed: ${u.failedLoginAttempts})`);
  }
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
