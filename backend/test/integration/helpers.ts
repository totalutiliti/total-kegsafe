import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import type { Role } from '@prisma/client';
import type { Server } from 'http';

/**
 * PEPPER_SECRET used by HashingService for Argon2id hashing.
 * Must match the env var set in setup.ts.
 */
const PEPPER =
  process.env.PEPPER_SECRET ||
  'integration-test-pepper-secret-minimum-32-characters';

/**
 * Creates a fully bootstrapped NestJS test application with real Prisma.
 * Includes cookie-parser middleware and global prefix matching production.
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  module: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  // Match production bootstrap setup
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  const prisma = moduleRef.get<PrismaService>(PrismaService);

  return { app, prisma, module: moduleRef };
}

/**
 * Creates a test tenant with random data.
 * Returns the created tenant object.
 */
export async function createTestTenant(
  prisma: PrismaService,
  overrides?: Partial<{
    name: string;
    cnpj: string;
    slug: string;
    isActive: boolean;
  }>,
) {
  const uniqueId = randomUUID().slice(0, 8);
  return prisma.tenant.create({
    data: {
      name: overrides?.name ?? `Test Tenant ${uniqueId}`,
      cnpj: overrides?.cnpj ?? generateCnpj(),
      slug: overrides?.slug ?? `test-${uniqueId}`,
      isActive: overrides?.isActive ?? true,
    },
  });
}

/**
 * Creates a test user with a hashed password.
 * Default password is 'TestPassword123' unless overridden.
 */
export async function createTestUser(
  prisma: PrismaService,
  tenantId: string,
  overrides?: Partial<{
    name: string;
    email: string;
    password: string;
    role: Role;
    isActive: boolean;
  }>,
) {
  const uniqueId = randomUUID().slice(0, 8);
  const password = overrides?.password ?? 'TestPassword123';
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      tenantId,
      name: overrides?.name ?? `Test User ${uniqueId}`,
      email: overrides?.email ?? `user-${uniqueId}@test.com`,
      role: overrides?.role ?? 'ADMIN',
      passwordHash,
      isActive: overrides?.isActive ?? true,
    },
  });
}

/**
 * Logs in via the auth endpoint and returns the accessToken cookie value.
 * Uses supertest to hit POST /api/v1/auth/login.
 */
export async function getAuthCookie(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const server = app.getHttpServer() as Server;
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  // Extract Set-Cookie header — supertest returns it as an array
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  if (!cookies || cookies.length === 0) {
    throw new Error(
      'No Set-Cookie header in login response. Check auth controller.',
    );
  }

  // Find the accessToken cookie
  const accessTokenCookie = cookies.find((c: string) =>
    c.startsWith('accessToken='),
  );
  if (!accessTokenCookie) {
    throw new Error('accessToken cookie not found in login response.');
  }

  // Return the full cookie string for use with .set('Cookie', ...)
  return accessTokenCookie;
}

/**
 * Cleans all data from the database in the correct FK order.
 * Useful for beforeEach/afterEach cleanup between tests.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Delete in reverse FK dependency order
  // Most dependent tables first, then parents
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "idempotency_keys",
      "audit_logs",
      "maintenance_items",
      "maintenance_logs",
      "triages",
      "maintenance_orders",
      "component_cycles",
      "logistics_events",
      "alerts",
      "disposals",
      "refresh_tokens",
      "barrels",
      "component_configs",
      "geofences",
      "clients",
      "suppliers",
      "service_providers",
      "users",
      "tenants"
    CASCADE
  `);
}

/**
 * Hashes a password with Argon2id + pepper, matching the app's HashingService.
 */
async function hashPassword(plaintext: string): Promise<string> {
  const peppered = plaintext + PEPPER;
  return argon2.hash(peppered, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Generates a random valid-looking CNPJ (14 digits).
 * Not algorithmically valid, but unique for test purposes.
 */
function generateCnpj(): string {
  const base = Math.floor(Math.random() * 99999999999)
    .toString()
    .padStart(11, '0');
  // Append 3 digits to reach 14 chars
  return (
    base +
    Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, '0')
  );
}
