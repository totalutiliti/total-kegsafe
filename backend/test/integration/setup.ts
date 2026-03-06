import { execSync } from 'child_process';
import path from 'path';

/**
 * Global setup for integration tests.
 * Sets DATABASE_URL to the test database and runs migrations + seed.
 */
export default async function globalSetup() {
  // Use CI database (port 5432) when in CI, local test database (port 5440) otherwise
  const isCI = process.env.CI === 'true';
  const port = isCI ? '5432' : '5440';
  const databaseUrl = `postgresql://postgres:postgres@localhost:${port}/kegsafe_test`;

  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET =
    'integration-test-secret-that-is-at-least-32-characters-long';
  process.env.JWT_EXPIRATION = '15m';
  process.env.JWT_REFRESH_SECRET =
    'integration-test-refresh-secret-at-least-32-chars';
  process.env.JWT_REFRESH_EXPIRATION = '7d';
  process.env.PEPPER_SECRET =
    'integration-test-pepper-secret-minimum-32-characters';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3099';
  process.env.CORS_ORIGINS = 'http://localhost:3000';

  const backendDir = path.resolve(__dirname, '..', '..');

  console.log(`\n[Integration Setup] Using DATABASE_URL: ${databaseUrl}`);
  console.log('[Integration Setup] Running prisma migrate deploy...');

  execSync('npx prisma migrate deploy', {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  console.log('[Integration Setup] Migrations applied successfully.');
}
