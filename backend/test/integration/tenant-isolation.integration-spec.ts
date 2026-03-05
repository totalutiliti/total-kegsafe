import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import request from 'supertest';
import type { Server } from 'http';
import {
  createTestApp,
  createTestTenant,
  createTestUser,
  getAuthCookie,
  cleanDatabase,
} from './helpers';

describe('Tenant Isolation (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tenant A data
  let tenantACookie: string;
  let tenantABarrelId: string;

  // Tenant B data
  let tenantBCookie: string;
  let tenantBBarrelId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());

    // Clean slate
    await cleanDatabase(prisma);

    // --- Tenant A ---
    const tenantA = await createTestTenant(prisma, { name: 'Tenant A' });
    const userA = await createTestUser(prisma, tenantA.id, {
      email: 'admin-a@test.com',
      password: 'TestPassword123',
      role: 'ADMIN',
    });

    // Create barrel for tenant A (directly in DB to avoid CLS dependency)
    const barrelA = await prisma.barrel.create({
      data: {
        tenantId: tenantA.id,
        internalCode: 'KS-BAR-A-000001',
        qrCode: 'QR-TENANT-A-001',
        capacityLiters: 50,
        status: 'ACTIVE',
      },
    });
    tenantABarrelId = barrelA.id;

    // --- Tenant B ---
    const tenantB = await createTestTenant(prisma, { name: 'Tenant B' });
    const userB = await createTestUser(prisma, tenantB.id, {
      email: 'admin-b@test.com',
      password: 'TestPassword123',
      role: 'ADMIN',
    });

    // Create barrel for tenant B
    const barrelB = await prisma.barrel.create({
      data: {
        tenantId: tenantB.id,
        internalCode: 'KS-BAR-B-000001',
        qrCode: 'QR-TENANT-B-001',
        capacityLiters: 30,
        status: 'ACTIVE',
      },
    });
    tenantBBarrelId = barrelB.id;

    // Login both users
    tenantACookie = await getAuthCookie(
      app,
      'admin-a@test.com',
      'TestPassword123',
    );
    tenantBCookie = await getAuthCookie(
      app,
      'admin-b@test.com',
      'TestPassword123',
    );
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('Tenant A user should only see Tenant A barrels', async () => {
    const server = app.getHttpServer() as Server;
    const res = await request(server)
      .get('/api/v1/barrels')
      .set('Cookie', tenantACookie)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qrCode).toBe('QR-TENANT-A-001');
    expect(res.body.total).toBe(1);
  });

  it('Tenant B user should only see Tenant B barrels', async () => {
    const server = app.getHttpServer() as Server;
    const res = await request(server)
      .get('/api/v1/barrels')
      .set('Cookie', tenantBCookie)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].qrCode).toBe('QR-TENANT-B-001');
    expect(res.body.total).toBe(1);
  });

  it('Tenant A user cannot access Tenant B barrel by ID (should get 404)', async () => {
    const server = app.getHttpServer() as Server;
    await request(server)
      .get(`/api/v1/barrels/${tenantBBarrelId}`)
      .set('Cookie', tenantACookie)
      .expect(404);
  });

  it('Tenant B user cannot access Tenant A barrel by ID (should get 404)', async () => {
    const server = app.getHttpServer() as Server;
    await request(server)
      .get(`/api/v1/barrels/${tenantABarrelId}`)
      .set('Cookie', tenantBCookie)
      .expect(404);
  });
});
