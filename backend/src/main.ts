import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SloInterceptor } from './shared/slo/slo.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Production safety: reject insecure JWT secrets and missing CORS
  if (process.env.NODE_ENV === 'production') {
    if (/dev|change|secret|fallback/i.test(process.env.JWT_SECRET || '')) {
      throw new Error(
        'JWT_SECRET inseguro detectado em produção. Gere um secret forte com: openssl rand -base64 32',
      );
    }
    if (!process.env.CORS_ORIGINS) {
      throw new Error(
        'CORS_ORIGINS must be explicitly set in production. ' +
          'Example: CORS_ORIGINS=https://app.kegsafe.com.br,https://admin.kegsafe.com.br',
      );
    }
  }

  // SLO metrics interceptor — registered globally via main.ts (not APP_INTERCEPTOR)
  const sloInterceptor = app.get(SloInterceptor);
  app.useGlobalInterceptors(sloInterceptor);

  // API versioning — all routes under /api/v1/
  app.setGlobalPrefix('api/v1');

  // Graceful shutdown — allow in-flight requests to complete
  app.enableShutdownHooks();

  // Helmet — secure HTTP headers with CSP and HSTS
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Cookie parser — for httpOnly auth cookies
  app.use(cookieParser());

  // CORS — restrict origins from env (production-safe)
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  // Swagger / OpenAPI documentation (disabled in production by default)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER_DOCS === 'true'
  ) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('KegSafe Tech API')
      .setDescription(
        'API de gestão de barris de chopp — rastreamento logístico e manutenção preditiva',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'Bearer',
      )
      .addCookieAuth('accessToken', {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
      })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs available at /api/docs');
  }

  const port = process.env.PORT ?? 3009;
  await app.listen(port);
  logger.log(`KegSafe API running on http://localhost:${port}`);
  logger.log(`All routes available under /api/v1/`);
}
void bootstrap();
