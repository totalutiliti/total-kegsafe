import pg from 'pg';

/**
 * Global teardown for integration tests.
 * Cleans all data from the test database using TRUNCATE CASCADE.
 */
export default async function globalTeardown() {
  const isCI = process.env.CI === 'true';
  const port = isCI ? '5432' : '5440';
  const databaseUrl = `postgresql://postgres:postgres@localhost:${port}/kegsafe_test`;

  console.log('\n[Integration Teardown] Cleaning test database...');

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    // Get all table names from the public schema (excluding _prisma_migrations)
    const result = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename != '_prisma_migrations'`,
    );

    if (result.rows.length > 0) {
      const tables = result.rows.map((r) => `"${r.tablename}"`).join(', ');
      await pool.query(`TRUNCATE TABLE ${tables} CASCADE`);
      console.log(
        `[Integration Teardown] Truncated ${result.rows.length} tables.`,
      );
    }
  } catch (error) {
    console.error('[Integration Teardown] Error cleaning database:', error);
  } finally {
    await pool.end();
  }

  console.log('[Integration Teardown] Done.');
}
