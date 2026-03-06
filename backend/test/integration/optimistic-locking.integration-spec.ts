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

let barrelCounter = 0;

describe('Optimistic Locking (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authCookie: string;
  let barrelId: string;
  let tenantId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await cleanDatabase(prisma);

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    await createTestUser(prisma, tenantId, {
      email: 'admin-lock@test.com',
      password: 'TestPassword123',
      role: 'ADMIN',
    });

    authCookie = await getAuthCookie(
      app,
      'admin-lock@test.com',
      'TestPassword123',
    );
  });

  beforeEach(async () => {
    barrelCounter++;
    const suffix = String(barrelCounter).padStart(5, '0');
    // Create a fresh barrel for each test — codes must fit VarChar(20) / VarChar(50)
    const barrel = await prisma.barrel.create({
      data: {
        tenantId,
        internalCode: `KS-BAR-LK${suffix}`,
        qrCode: `QR-LOCK-${suffix}`,
        capacityLiters: 50,
        status: 'ACTIVE',
        version: 1,
      },
    });
    barrelId = barrel.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('should update barrel when version matches', async () => {
    const server = app.getHttpServer() as Server;

    // Get barrel to confirm initial version
    const getRes = await request(server)
      .get(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(getRes.body.version).toBe(1);

    // Update with correct version
    const updateRes = await request(server)
      .patch(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .send({
        version: 1,
        manufacturer: 'Updated Manufacturer',
      })
      .expect(200);

    // Version should have incremented
    expect(updateRes.body.version).toBe(2);
    expect(updateRes.body.manufacturer).toBe('Updated Manufacturer');
  });

  it('should return 409 Conflict when version is stale', async () => {
    const server = app.getHttpServer() as Server;

    // First update succeeds (version 1 -> 2)
    await request(server)
      .patch(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .send({
        version: 1,
        manufacturer: 'First Update',
      })
      .expect(200);

    // Second update with stale version (still sending version 1) should fail
    const conflictRes = await request(server)
      .patch(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .send({
        version: 1,
        manufacturer: 'Stale Update',
      })
      .expect(409);

    expect(conflictRes.body.code).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  it('should preserve correct data after successful update', async () => {
    const server = app.getHttpServer() as Server;

    // Update barrel
    await request(server)
      .patch(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .send({
        version: 1,
        manufacturer: 'Franke',
        capacityLiters: 30,
      })
      .expect(200);

    // Verify data via GET
    const verifyRes = await request(server)
      .get(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(verifyRes.body.manufacturer).toBe('Franke');
    expect(verifyRes.body.capacityLiters).toBe(30);
    expect(verifyRes.body.version).toBe(2);
  });

  it('should allow sequential updates with correct versions', async () => {
    const server = app.getHttpServer() as Server;

    // Update 1: version 1 -> 2
    const res1 = await request(server)
      .patch(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .send({ version: 1, manufacturer: 'Update 1' })
      .expect(200);
    expect(res1.body.version).toBe(2);

    // Update 2: version 2 -> 3
    const res2 = await request(server)
      .patch(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .send({ version: 2, manufacturer: 'Update 2' })
      .expect(200);
    expect(res2.body.version).toBe(3);

    // Update 3: version 3 -> 4
    const res3 = await request(server)
      .patch(`/api/v1/barrels/${barrelId}`)
      .set('Cookie', authCookie)
      .send({ version: 3, manufacturer: 'Update 3' })
      .expect(200);
    expect(res3.body.version).toBe(4);
  });
});
