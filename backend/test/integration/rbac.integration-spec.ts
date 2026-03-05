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

describe('RBAC — Role-Based Access Control (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;

  let adminCookie: string;
  let managerCookie: string;
  let logisticsCookie: string;
  let maintenanceCookie: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await cleanDatabase(prisma);

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    // Create a barrel for testing read access
    await prisma.barrel.create({
      data: {
        tenantId,
        internalCode: 'KS-BAR-RBAC-000001',
        qrCode: 'QR-RBAC-001',
        capacityLiters: 50,
        status: 'ACTIVE',
      },
    });

    // Create users for each role
    await createTestUser(prisma, tenantId, {
      email: 'rbac-admin@test.com',
      password: 'TestPassword123',
      role: 'ADMIN',
    });
    await createTestUser(prisma, tenantId, {
      email: 'rbac-manager@test.com',
      password: 'TestPassword123',
      role: 'MANAGER',
    });
    await createTestUser(prisma, tenantId, {
      email: 'rbac-logistics@test.com',
      password: 'TestPassword123',
      role: 'LOGISTICS',
    });
    await createTestUser(prisma, tenantId, {
      email: 'rbac-maintenance@test.com',
      password: 'TestPassword123',
      role: 'MAINTENANCE',
    });

    // Login all users
    adminCookie = await getAuthCookie(
      app,
      'rbac-admin@test.com',
      'TestPassword123',
    );
    managerCookie = await getAuthCookie(
      app,
      'rbac-manager@test.com',
      'TestPassword123',
    );
    logisticsCookie = await getAuthCookie(
      app,
      'rbac-logistics@test.com',
      'TestPassword123',
    );
    maintenanceCookie = await getAuthCookie(
      app,
      'rbac-maintenance@test.com',
      'TestPassword123',
    );
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  // =============================================
  // All roles can read barrels (GET /barrels)
  // =============================================

  describe('GET /api/v1/barrels — read access for all roles', () => {
    it('ADMIN can list barrels', async () => {
      const server = app.getHttpServer() as Server;
      const res = await request(server)
        .get('/api/v1/barrels')
        .set('Cookie', adminCookie)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it('MANAGER can list barrels', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .get('/api/v1/barrels')
        .set('Cookie', managerCookie)
        .expect(200);
    });

    it('LOGISTICS can list barrels', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .get('/api/v1/barrels')
        .set('Cookie', logisticsCookie)
        .expect(200);
    });

    it('MAINTENANCE can list barrels', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .get('/api/v1/barrels')
        .set('Cookie', maintenanceCookie)
        .expect(200);
    });
  });

  // =============================================
  // Admin-only endpoints (user management)
  // =============================================

  describe('POST /api/v1/users — admin-only endpoint', () => {
    it('ADMIN can create users', async () => {
      const server = app.getHttpServer() as Server;
      const res = await request(server)
        .post('/api/v1/users')
        .set('Cookie', adminCookie)
        .send({
          name: 'New Test User',
          email: `new-user-${Date.now()}@test.com`,
          password: 'NewUserPass123',
          role: 'LOGISTICS',
        })
        .expect(201);

      expect(res.body.name).toBe('New Test User');
      expect(res.body.role).toBe('LOGISTICS');
    });

    it('MANAGER cannot access admin user endpoint', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .post('/api/v1/users')
        .set('Cookie', managerCookie)
        .send({
          name: 'Unauthorized User',
          email: 'unauthorized@test.com',
          password: 'SomePassword123',
          role: 'LOGISTICS',
        })
        .expect(403);
    });

    it('LOGISTICS cannot access admin user endpoint', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .post('/api/v1/users')
        .set('Cookie', logisticsCookie)
        .send({
          name: 'Unauthorized User',
          email: 'unauthorized2@test.com',
          password: 'SomePassword123',
          role: 'LOGISTICS',
        })
        .expect(403);
    });

    it('MAINTENANCE cannot access admin user endpoint', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .post('/api/v1/users')
        .set('Cookie', maintenanceCookie)
        .send({
          name: 'Unauthorized User',
          email: 'unauthorized3@test.com',
          password: 'SomePassword123',
          role: 'LOGISTICS',
        })
        .expect(403);
    });
  });

  describe('GET /api/v1/users — admin-only endpoint', () => {
    it('ADMIN can list users', async () => {
      const server = app.getHttpServer() as Server;
      const res = await request(server)
        .get('/api/v1/users')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
    });

    it('LOGISTICS cannot list users', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .get('/api/v1/users')
        .set('Cookie', logisticsCookie)
        .expect(403);
    });
  });

  // =============================================
  // Maintenance endpoints
  // =============================================

  describe('GET /api/v1/maintenance/orders — maintenance access', () => {
    it('MAINTENANCE can access maintenance orders', async () => {
      const server = app.getHttpServer() as Server;
      const res = await request(server)
        .get('/api/v1/maintenance/orders')
        .set('Cookie', maintenanceCookie)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('ADMIN can access maintenance orders', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .get('/api/v1/maintenance/orders')
        .set('Cookie', adminCookie)
        .expect(200);
    });

    it('LOGISTICS cannot access maintenance orders', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .get('/api/v1/maintenance/orders')
        .set('Cookie', logisticsCookie)
        .expect(403);
    });
  });

  // =============================================
  // Unauthenticated access
  // =============================================

  describe('Unauthenticated requests', () => {
    it('should return 401 for requests without auth cookie', async () => {
      const server = app.getHttpServer() as Server;
      await request(server).get('/api/v1/barrels').expect(401);
    });

    it('should return 401 for requests with invalid token', async () => {
      const server = app.getHttpServer() as Server;
      await request(server)
        .get('/api/v1/barrels')
        .set('Cookie', 'accessToken=invalid-token-value')
        .expect(401);
    });
  });
});
