import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Server } from 'http';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/auth/auth.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { TenantThrottlerGuard } from './../src/shared/guards/tenant-throttler.guard';

/**
 * Integration tests for KegSafe API.
 * Mocks AuthService and PrismaService to avoid database dependency.
 */
describe('KegSafe API (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let authServiceMock: Partial<AuthService>;

  const mockUser = {
    id: 'user-1',
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'ADMIN',
    tenantId: 'tenant-1',
    tenantName: 'Test Brewery',
  };

  const mockLoginResult = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: mockUser,
    expiresIn: '15m',
  };

  beforeAll(async () => {
    authServiceMock = {
      login: jest.fn().mockResolvedValue(mockLoginResult),
      refresh: jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: '15m',
      }),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    const prismaServiceMock = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      getCurrentTenantId: jest.fn().mockReturnValue('tenant-1'),
      getCurrentUserId: jest.fn().mockReturnValue('user-1'),
      withTenantFilter: jest.fn((where: Record<string, any>) => ({
        ...where,
        tenantId: 'tenant-1',
        deletedAt: null,
      })),
      softDeleteData: jest.fn().mockReturnValue({ deletedAt: new Date() }),
    };

    // Disable rate limiting in tests to avoid 429 errors
    const noopThrottlerGuard = { canActivate: () => true };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideGuard(TenantThrottlerGuard)
      .useValue(noopThrottlerGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(helmet());
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Auth Endpoints ───────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials and set cookies', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin@123' })
        .expect(200);

      const body = res.body as { user: { email: string }; expiresIn: string };
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('admin@test.com');
      expect(body.expiresIn).toBe('15m');

      // Verify httpOnly cookies were set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).toContain('accessToken');
      expect(cookieStr).toContain('refreshToken');
      expect(cookieStr).toContain('HttpOnly');
    });

    it('should reject login with invalid email format', async () => {
      await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'Admin@123' })
        .expect(400);
    });

    it('should reject login with short password', async () => {
      await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'short' })
        .expect(400);
    });

    it('should reject login with missing fields', async () => {
      await request(httpServer).post('/api/v1/auth/login').send({}).expect(400);
    });

    it('should reject extra fields (forbidNonWhitelisted)', async () => {
      await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Admin@123',
          malicious: 'payload',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token from cookie', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=mock-refresh-token')
        .expect(200);

      const body = res.body as { expiresIn: string };
      expect(body.expiresIn).toBe('15m');
    });

    it('should return 401 without refresh token', async () => {
      await request(httpServer).post('/api/v1/auth/refresh').expect(401);
    });
  });

  // ─── Protected Endpoints (Guards) ─────────────────────────────

  describe('GET /api/v1/auth/me (Protected)', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(httpServer).get('/api/v1/auth/me').expect(401);

      const body = res.body as { statusCode: number };
      expect(body.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout (Protected)', () => {
    it('should return 401 without authentication', async () => {
      await request(httpServer).post('/api/v1/auth/logout').expect(401);
    });
  });

  // ─── RBAC Enforcement ─────────────────────────────────────────

  describe('RBAC deny-by-default', () => {
    it('should deny access to protected barrel endpoints without JWT', async () => {
      await request(httpServer).get('/api/v1/barrels').expect(401);
    });
  });

  // ─── Security Headers ─────────────────────────────────────────

  describe('Security Headers', () => {
    it('should return proper security headers on any response', async () => {
      const res = await request(httpServer).get('/api/v1/nonexistent');

      // Helmet headers are applied to all responses
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  // ─── 404 / Prefix Handling ────────────────────────────────────

  describe('Routing', () => {
    it('should return 404 for unknown routes under /api/v1/', async () => {
      await request(httpServer).get('/api/v1/nonexistent').expect(404);
    });

    it('should not respond without /api/v1/ prefix', async () => {
      await request(httpServer).get('/barrels').expect(404);
    });
  });
});
