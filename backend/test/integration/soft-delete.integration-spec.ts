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

let sdCounter = 0;

/** Generate short codes that fit VarChar(20) for internalCode */
function sdCode(prefix: string): string {
  sdCounter++;
  const suffix = String(sdCounter).padStart(5, '0');
  return `${prefix}${suffix}`;
}

describe('Soft Delete (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authCookie: string;
  let tenantId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await cleanDatabase(prisma);

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    await createTestUser(prisma, tenantId, {
      email: 'admin-sd@test.com',
      password: 'TestPassword123',
      role: 'ADMIN',
    });

    authCookie = await getAuthCookie(
      app,
      'admin-sd@test.com',
      'TestPassword123',
    );
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('should soft-delete a barrel and return 404 on subsequent GET', async () => {
    const server = app.getHttpServer() as Server;

    // Create a barrel
    const barrel = await prisma.barrel.create({
      data: {
        tenantId,
        internalCode: sdCode('KS-BAR-SD'),
        qrCode: sdCode('QR-SD-'),
        capacityLiters: 50,
        status: 'ACTIVE',
      },
    });

    // Verify barrel exists via API
    await request(server)
      .get(`/api/v1/barrels/${barrel.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    // Delete barrel
    await request(server)
      .delete(`/api/v1/barrels/${barrel.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    // GET should now return 404
    await request(server)
      .get(`/api/v1/barrels/${barrel.id}`)
      .set('Cookie', authCookie)
      .expect(404);
  });

  it('should not include deleted barrel in list results', async () => {
    const server = app.getHttpServer() as Server;

    // Create two barrels
    const barrel1 = await prisma.barrel.create({
      data: {
        tenantId,
        internalCode: sdCode('KS-BAR-SD'),
        qrCode: sdCode('QR-SD-'),
        capacityLiters: 30,
        status: 'ACTIVE',
      },
    });

    const barrel2 = await prisma.barrel.create({
      data: {
        tenantId,
        internalCode: sdCode('KS-BAR-SD'),
        qrCode: sdCode('QR-SD-'),
        capacityLiters: 50,
        status: 'ACTIVE',
      },
    });

    // Delete barrel1
    await request(server)
      .delete(`/api/v1/barrels/${barrel1.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    // List barrels — should only contain barrel2 (plus any from earlier test)
    const listRes = await request(server)
      .get('/api/v1/barrels')
      .set('Cookie', authCookie)
      .expect(200);

    const barrelIds = listRes.body.items.map((b: { id: string }) => b.id);
    expect(barrelIds).not.toContain(barrel1.id);
    expect(barrelIds).toContain(barrel2.id);
  });

  it('should still have the barrel in DB with deletedAt set (true soft delete)', async () => {
    const server = app.getHttpServer() as Server;

    // Create barrel
    const barrel = await prisma.barrel.create({
      data: {
        tenantId,
        internalCode: sdCode('KS-BAR-SD'),
        qrCode: sdCode('QR-SD-'),
        capacityLiters: 50,
        status: 'ACTIVE',
      },
    });

    // Delete it via API
    await request(server)
      .delete(`/api/v1/barrels/${barrel.id}`)
      .set('Cookie', authCookie)
      .expect(200);

    // Direct DB query should still find the barrel with deletedAt set
    const dbBarrel = await prisma.barrel.findUnique({
      where: { id: barrel.id },
    });

    expect(dbBarrel).not.toBeNull();
    expect(dbBarrel!.deletedAt).not.toBeNull();
    expect(dbBarrel!.deletedAt).toBeInstanceOf(Date);
  });
});
