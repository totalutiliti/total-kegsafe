# SKILL.md — KegSafe Tech

## Descrição

Este projeto é um **sistema SaaS multi-tenant de gestão de ativos (barris de chopp)** para cervejarias. Combina rastreamento logístico passivo e manutenção preditiva/preventiva.

## Habilidades Requeridas

### Backend (NestJS + Prisma + PostgreSQL)
- Arquitetura modular NestJS com guards, interceptors e decorators customizados
- Prisma ORM com migrations, middleware de tenant isolation (RLS)
- PostgreSQL Row-Level Security para isolamento multi-tenant
- Autenticação JWT com RBAC (4 perfis: LOGISTICS, MAINTENANCE, MANAGER, ADMIN)
- Scheduled jobs (CRON) para alertas preditivos e relatórios
- Upload de imagens para Azure Blob Storage
- Geração de PDF para relatórios executivos
- Validação de DTOs com class-validator e class-transformer
- Documentação automática de API via Swagger

### Frontend Web (Next.js + Tailwind + shadcn/ui)
- Dashboard com gráficos (recharts ou chart.js) para métricas de frota
- Mapa de geolocalização para visualização de barris
- Tabelas com filtros, ordenação e paginação server-side
- Componentes de semáforo (verde/amarelo/vermelho) para status de saúde
- Sistema de notificações em tempo real (polling ou SSE)

### App Mobile (React Native + Expo)
- Scanner de QR Code nativo com captura automática de geolocalização
- Interface simplificada para operadores com luvas (botões grandes, toque único)
- Modo offline com sincronização posterior
- Push notifications (Firebase Cloud Messaging)
- Checklist interativo com checkboxes para manutenção "zero digitação"

### Infraestrutura
- Docker + Docker Compose para desenvolvimento local
- Azure Container Apps para deploy de produção
- CI/CD com GitHub Actions
- Variáveis de ambiente via Azure Key Vault ou .env

## Padrões de Código

### Estrutura de Módulos NestJS
```
src/
├── modules/
│   ├── tenant/          # Gestão de tenants (cervejarias)
│   ├── auth/            # Autenticação e autorização
│   ├── user/            # Gestão de usuários e perfis
│   ├── barrel/          # Cadastro e ciclo de vida de barris
│   ├── component/       # Componentes de barril e configuração
│   ├── logistics/       # 4 inputs de movimentação logística
│   ├── maintenance/     # Central de manutenção e OS
│   ├── alert/           # Sistema de alertas inteligentes
│   ├── dashboard/       # Métricas e relatórios gerenciais
│   ├── geofence/        # Zonas geográficas e cercas virtuais
│   ├── supplier/        # Fornecedores e prestadores
│   └── disposal/        # Gestão de descarte e baixa patrimonial
├── common/
│   ├── decorators/      # @CurrentUser, @Roles, @TenantId
│   ├── guards/          # JwtGuard, RolesGuard, TenantGuard
│   ├── interceptors/    # TenantInterceptor, LoggingInterceptor
│   ├── filters/         # HttpExceptionFilter
│   └── pipes/           # ValidationPipe customizado
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── config/
    ├── database.config.ts
    └── azure.config.ts
```

### Padrão de Service
```typescript
@Injectable()
export class BarrelService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: BarrelFilterDto) {
    return this.prisma.barrel.findMany({
      where: { tenantId, ...this.buildWhere(filters) },
      include: { components: true, lastLocation: true },
    });
  }
}
```

### Padrão de Controller
```typescript
@Controller('barrels')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('Barrels')
export class BarrelController {
  @Get()
  @Roles(Role.MANAGER, Role.ADMIN)
  async findAll(
    @TenantId() tenantId: string,
    @Query() filters: BarrelFilterDto,
  ) {
    return this.barrelService.findAll(tenantId, filters);
  }
}
```

## Regras de Qualidade

1. Toda entidade DEVE ter `tenantId` e participar do RLS
2. Todo endpoint DEVE ter decorator de `@Roles()` especificando perfis autorizados
3. Todo scan de QR Code DEVE capturar metadata (timestamp + GPS) automaticamente
4. Testes unitários obrigatórios para services com regras de negócio
5. DTOs de entrada SEMPRE validados com class-validator
6. Respostas de API SEMPRE documentadas com decorators Swagger
7. Logs estruturados (JSON) para observabilidade
8. Tratamento de erros centralizado via ExceptionFilter

---

## Padrões de Tratamento de Erro

### Hierarquia de Exceções Customizadas

```typescript
// src/common/exceptions/base.exception.ts

/**
 * Exceção base para todos os erros de domínio do KegSafe
 * Todas as exceções customizadas DEVEM estender esta classe
 */
export abstract class KegSafeException extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
  
  toResponse(): ErrorResponse {
    return {
      statusCode: this.statusCode,
      error: this.getHttpErrorName(),
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
  
  private getHttpErrorName(): string {
    const httpErrors: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    return httpErrors[this.statusCode] || 'Error';
  }
}

// Interface de resposta de erro
interface ErrorResponse {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
  timestamp: string;
}
```

### Exceções de Autenticação

```typescript
// src/common/exceptions/auth.exceptions.ts

export class InvalidCredentialsException extends KegSafeException {
  readonly statusCode = 401;
  readonly code = 'AUTH_INVALID_CREDENTIALS';
  
  constructor() {
    super('Invalid email or password');
  }
}

export class TokenExpiredException extends KegSafeException {
  readonly statusCode = 401;
  readonly code = 'AUTH_TOKEN_EXPIRED';
  
  constructor() {
    super('Access token has expired');
  }
}

export class TokenInvalidException extends KegSafeException {
  readonly statusCode = 401;
  readonly code = 'AUTH_TOKEN_INVALID';
  
  constructor(reason?: string) {
    super(reason || 'Invalid or malformed token');
  }
}

export class InsufficientRoleException extends KegSafeException {
  readonly statusCode = 403;
  readonly code = 'AUTH_INSUFFICIENT_ROLE';
  
  constructor(required: string[], current: string) {
    super(`Insufficient permissions. Required: ${required.join(' or ')}, Current: ${current}`);
  }
}

export class AccountDisabledException extends KegSafeException {
  readonly statusCode = 403;
  readonly code = 'AUTH_ACCOUNT_DISABLED';
  
  constructor() {
    super('Account has been disabled');
  }
}

export class AccountLockedException extends KegSafeException {
  readonly statusCode = 403;
  readonly code = 'AUTH_ACCOUNT_LOCKED';
  
  constructor(unlockAt: Date) {
    super(`Account temporarily locked until ${unlockAt.toISOString()}`);
  }
}
```

### Exceções de Recurso

```typescript
// src/common/exceptions/resource.exceptions.ts

export class ResourceNotFoundException extends KegSafeException {
  readonly statusCode = 404;
  readonly code = 'RESOURCE_NOT_FOUND';
  
  constructor(resource: string, identifier?: string) {
    super(identifier 
      ? `${resource} with ID '${identifier}' not found` 
      : `${resource} not found`
    );
  }
}

export class ResourceAlreadyExistsException extends KegSafeException {
  readonly statusCode = 409;
  readonly code = 'RESOURCE_ALREADY_EXISTS';
  
  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`, {
      field,
      value,
    });
  }
}

export class ResourceDeletedException extends KegSafeException {
  readonly statusCode = 410;
  readonly code = 'RESOURCE_DELETED';
  
  constructor(resource: string) {
    super(`${resource} has been deleted`);
  }
}
```

### Exceções de Barril

```typescript
// src/common/exceptions/barrel.exceptions.ts

export class BarrelNotFoundException extends ResourceNotFoundException {
  readonly code = 'BARREL_NOT_FOUND';
  
  constructor(identifier?: string) {
    super('Barrel', identifier);
  }
}

export class BarrelQrCodeExistsException extends ResourceAlreadyExistsException {
  readonly code = 'BARREL_QR_CODE_EXISTS';
  
  constructor(qrCode: string) {
    super('Barrel', 'QR code', qrCode);
  }
}

export class BarrelInvalidStatusTransitionException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_INVALID_STATUS_TRANSITION';
  
  constructor(currentStatus: string, targetStatus: string, allowedTransitions: string[]) {
    super(`Invalid status transition from ${currentStatus} to ${targetStatus}`, {
      currentStatus,
      targetStatus,
      allowedTransitions,
    });
  }
}

export class BarrelNotReadyForExpeditionException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_NOT_READY_FOR_EXPEDITION';
  
  constructor(currentStatus: string) {
    super(`Barrel cannot be expedited. Current status: ${currentStatus}`, {
      currentStatus,
      requiredStatus: 'ACTIVE',
    });
  }
}

export class BarrelHasCriticalComponentException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_HAS_CRITICAL_COMPONENT';
  
  constructor(barrelId: string, components: string[]) {
    super('Barrel has critical components requiring maintenance', {
      barrelId,
      criticalComponents: components,
    });
  }
}
```

### Exception Filter Global

```typescript
// src/common/filters/http-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { KegSafeException } from '../exceptions/base.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Extrair trace ID do request
    const traceId = request.headers['x-request-id'] as string || 
                    this.generateTraceId();

    let errorResponse: ErrorResponse;

    // Tratamento de exceções KegSafe customizadas
    if (exception instanceof KegSafeException) {
      errorResponse = {
        ...exception.toResponse(),
        traceId,
      };
      
      this.logError(exception, request, traceId, 'warn');
    }
    // Tratamento de HttpException do NestJS
    else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      errorResponse = {
        statusCode: status,
        error: this.getHttpErrorName(status),
        code: this.mapHttpStatusToCode(status),
        message: typeof exceptionResponse === 'string' 
          ? exceptionResponse 
          : (exceptionResponse as any).message || 'An error occurred',
        details: typeof exceptionResponse === 'object' 
          ? (exceptionResponse as any).details 
          : undefined,
        traceId,
        timestamp: new Date().toISOString(),
      };
      
      this.logError(exception, request, traceId, 'warn');
    }
    // Tratamento de erros não esperados
    else {
      errorResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        code: 'SYSTEM_INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please contact support.',
        traceId,
        timestamp: new Date().toISOString(),
      };
      
      // Log completo para erros internos
      this.logError(exception, request, traceId, 'error');
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private logError(
    exception: unknown,
    request: Request,
    traceId: string,
    level: 'warn' | 'error',
  ) {
    const logData = {
      traceId,
      method: request.method,
      path: request.url,
      userId: (request as any).user?.id,
      tenantId: (request as any).user?.tenantId,
      body: this.sanitizeBody(request.body),
      error: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
        stack: level === 'error' ? exception.stack : undefined,
      } : exception,
    };

    if (level === 'error') {
      this.logger.error('Unhandled exception', logData);
    } else {
      this.logger.warn('Request error', logData);
    }
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sensitiveFields = ['password', 'token', 'refreshToken', 'apiKey'];
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getHttpErrorName(status: number): string {
    const names: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return names[status] || 'Error';
  }

  private mapHttpStatusToCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'VALIDATION_FAILED',
      401: 'AUTH_TOKEN_INVALID',
      403: 'AUTH_INSUFFICIENT_ROLE',
      404: 'RESOURCE_NOT_FOUND',
      409: 'RESOURCE_CONFLICT',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'SYSTEM_INTERNAL_ERROR',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }
}

interface ErrorResponse {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: any;
  traceId: string;
  timestamp: string;
}
```

### Uso nos Services

```typescript
// Exemplo de uso em BarrelService
@Injectable()
export class BarrelService {
  async findById(tenantId: string, barrelId: string): Promise<Barrel> {
    const barrel = await this.prisma.barrel.findFirst({
      where: { id: barrelId, tenantId, deletedAt: null },
    });
    
    if (!barrel) {
      throw new BarrelNotFoundException(barrelId);
    }
    
    return barrel;
  }

  async createExpedition(tenantId: string, dto: ExpeditionDto): Promise<LogisticsEvent> {
    const barrel = await this.findById(tenantId, dto.barrelId);
    
    // Validar status
    if (barrel.status !== 'ACTIVE') {
      throw new BarrelNotReadyForExpeditionException(barrel.status);
    }
    
    // Verificar componentes críticos
    const criticalComponents = await this.getCriticalComponents(barrel.id);
    if (criticalComponents.length > 0) {
      throw new BarrelHasCriticalComponentException(
        barrel.id,
        criticalComponents.map(c => c.name),
      );
    }
    
    // ... restante da lógica
  }
}
```

---

## Padrões de Logging Estruturado

### Configuração do Logger

```typescript
// src/common/logger/logger.service.ts

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

interface LogContext {
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  barrelId?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLogger implements LoggerService {
  private context?: string;

  constructor(private readonly cls: ClsService) {}

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: LogContext) {
    this.writeLog('info', message, context);
  }

  error(message: string, trace?: string, context?: LogContext) {
    this.writeLog('error', message, { ...context, stack: trace });
  }

  warn(message: string, context?: LogContext) {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      this.writeLog('debug', message, context);
    }
  }

  private writeLog(level: string, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'kegsafe-api',
      context: this.context,
      
      // Contexto de correlação (do CLS)
      traceId: this.cls.get('traceId') || context?.traceId,
      spanId: this.cls.get('spanId') || context?.spanId,
      requestId: this.cls.get('requestId'),
      
      // Contexto de negócio
      tenantId: this.cls.get('tenantId') || context?.tenantId,
      userId: this.cls.get('userId') || context?.userId,
      
      // Contexto adicional
      ...this.sanitize(context),
    };

    // Output JSON para stdout
    console.log(JSON.stringify(logEntry));
  }

  private sanitize(context?: LogContext): LogContext {
    if (!context) return {};
    
    const sensitiveFields = ['password', 'token', 'refreshToken', 'apiKey', 'secret'];
    const piiFields = ['email', 'phone', 'cnpj', 'cpf'];
    
    const sanitized = { ...context };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    for (const field of piiFields) {
      if (field in sanitized && typeof sanitized[field] === 'string') {
        sanitized[field] = this.maskPii(field, sanitized[field] as string);
      }
    }
    
    return sanitized;
  }

  private maskPii(field: string, value: string): string {
    switch (field) {
      case 'email':
        const [local, domain] = value.split('@');
        return `${local[0]}***@${domain}`;
      case 'phone':
        return value.replace(/\d(?=\d{4})/g, '*');
      case 'cnpj':
        return `**.***.***/${value.slice(8, 12)}-**`;
      case 'cpf':
        return `***.***.${value.slice(6, 9)}-**`;
      default:
        return '[MASKED]';
    }
  }
}
```

### Logging Interceptor

```typescript
// src/common/interceptors/logging.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { StructuredLogger } from '../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers } = request;
    
    // Gerar ou extrair IDs de correlação
    const requestId = headers['x-request-id'] || uuidv4();
    const traceId = headers['x-trace-id'] || uuidv4();
    
    // Armazenar no CLS para acesso global
    this.cls.set('requestId', requestId);
    this.cls.set('traceId', traceId);
    
    const startTime = Date.now();

    // Log de entrada
    this.logger.log('Incoming request', {
      httpMethod: method,
      httpPath: url,
      userAgent: headers['user-agent'],
      contentLength: headers['content-length'],
    });

    return next.handle().pipe(
      tap((response) => {
        const latencyMs = Date.now() - startTime;
        const httpStatus = context.switchToHttp().getResponse().statusCode;
        
        // Log de sucesso
        this.logger.log('Request completed', {
          httpMethod: method,
          httpPath: url,
          httpStatus,
          latencyMs,
          responseSize: JSON.stringify(response)?.length,
        });
      }),
      catchError((error) => {
        const latencyMs = Date.now() - startTime;
        
        // Log de erro (detalhes no exception filter)
        this.logger.warn('Request failed', {
          httpMethod: method,
          httpPath: url,
          latencyMs,
          errorName: error.name,
          errorCode: error.code,
        });
        
        throw error;
      }),
    );
  }
}
```

### Decorator para Logging de Métodos

```typescript
// src/common/decorators/log-method.decorator.ts

export function LogMethod(options?: { level?: 'info' | 'debug' }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const level = options?.level || 'debug';

    descriptor.value = async function (...args: any[]) {
      const logger = this.logger as StructuredLogger;
      const className = target.constructor.name;
      
      logger[level](`${className}.${propertyKey} started`, {
        args: args.map((arg, i) => ({
          index: i,
          type: typeof arg,
          // Não logar valores sensíveis
        })),
      });

      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        
        logger[level](`${className}.${propertyKey} completed`, {
          latencyMs: Date.now() - startTime,
          hasResult: result !== undefined,
        });
        
        return result;
      } catch (error) {
        logger.warn(`${className}.${propertyKey} failed`, {
          latencyMs: Date.now() - startTime,
          errorName: error.name,
          errorMessage: error.message,
        });
        throw error;
      }
    };

    return descriptor;
  };
}

// Uso:
@Injectable()
export class BarrelService {
  @LogMethod()
  async findById(tenantId: string, barrelId: string) {
    // ...
  }
}
```

---

## Padrões de Cache

### Cache Service com Decorators

```typescript
// src/common/cache/cache.service.ts

import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { StructuredLogger } from '../logger/logger.service';

interface CacheOptions {
  ttl?: number;        // Segundos
  prefix?: string;
  serialize?: boolean;
}

@Injectable()
export class CacheService {
  constructor(
    private readonly redis: Redis,
    private readonly logger: StructuredLogger,
  ) {
    this.logger.setContext('CacheService');
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      
      if (value) {
        this.logger.debug('Cache hit', { key });
        return JSON.parse(value) as T;
      }
      
      this.logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      this.logger.warn('Cache get error', { key, error: error.message });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      this.logger.debug('Cache set', { key, ttl });
    } catch (error) {
      this.logger.warn('Cache set error', { key, error: error.message });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug('Cache deleted', { key });
    } catch (error) {
      this.logger.warn('Cache delete error', { key, error: error.message });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug('Cache pattern deleted', { pattern, count: keys.length });
      }
    } catch (error) {
      this.logger.warn('Cache pattern delete error', { pattern, error: error.message });
    }
  }

  // Método para invalidação por evento
  async invalidateOnEvent(event: string, context: Record<string, string>): Promise<void> {
    const patterns = CACHE_INVALIDATION_RULES[event];
    if (!patterns) return;
    
    for (const pattern of patterns) {
      const key = this.interpolateKey(pattern, context);
      await this.delete(key);
    }
  }

  private interpolateKey(pattern: string, context: Record<string, string>): string {
    return pattern.replace(/\{(\w+)\}/g, (_, key) => context[key] || '*');
  }
}

// Regras de invalidação
const CACHE_INVALIDATION_RULES: Record<string, string[]> = {
  BARREL_UPDATED: [
    'barrel:{tenantId}:{barrelId}',
    'dashboard:{tenantId}:fleet-health',
  ],
  LOGISTICS_EVENT: [
    'barrel:{tenantId}:{barrelId}',
    'dashboard:{tenantId}:*',
  ],
  MAINTENANCE_LOGGED: [
    'barrel:{tenantId}:{barrelId}',
    'dashboard:{tenantId}:fleet-health',
    'dashboard:{tenantId}:cost-per-liter',
  ],
};
```

### Cache Decorator

```typescript
// src/common/decorators/cacheable.decorator.ts

import { SetMetadata } from '@nestjs/common';

export interface CacheableOptions {
  key: string | ((...args: any[]) => string);
  ttl: number;         // Segundos
  refreshOnAccess?: boolean;
}

export const CACHEABLE_KEY = 'cacheable';

export function Cacheable(options: CacheableOptions) {
  return SetMetadata(CACHEABLE_KEY, options);
}

// Interceptor para processar o decorator
@Injectable()
export class CacheableInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const options = this.reflector.get<CacheableOptions>(
      CACHEABLE_KEY,
      context.getHandler(),
    );
    
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const cacheKey = this.buildKey(options.key, context, request);
    
    // Tentar obter do cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      if (options.refreshOnAccess) {
        // Refresh TTL em background
        setImmediate(() => this.refreshInBackground(cacheKey, options.ttl, next));
      }
      return of(cached);
    }

    // Executar handler e cachear resultado
    return next.handle().pipe(
      tap(result => {
        this.cache.set(cacheKey, result, options.ttl);
      }),
    );
  }

  private buildKey(
    key: string | Function,
    context: ExecutionContext,
    request: any,
  ): string {
    if (typeof key === 'function') {
      return key(request.params, request.query, request.user);
    }
    
    // Interpolação simples de variáveis
    return key
      .replace('{tenantId}', request.user?.tenantId || '')
      .replace('{userId}', request.user?.id || '')
      .replace('{id}', request.params?.id || '');
  }
}

// Uso:
@Injectable()
export class DashboardService {
  @Cacheable({
    key: 'dashboard:{tenantId}:fleet-health',
    ttl: 300, // 5 minutos
    refreshOnAccess: true,
  })
  async getFleetHealth(tenantId: string): Promise<FleetHealth> {
    // Cálculo pesado...
  }
}
```

### Cache Invalidation Decorator

```typescript
// src/common/decorators/cache-invalidate.decorator.ts

export interface CacheInvalidateOptions {
  patterns: string[];
}

export const CACHE_INVALIDATE_KEY = 'cacheInvalidate';

export function CacheInvalidate(options: CacheInvalidateOptions) {
  return SetMetadata(CACHE_INVALIDATE_KEY, options);
}

// Uso:
@Injectable()
export class BarrelService {
  @CacheInvalidate({
    patterns: [
      'barrel:{tenantId}:{id}',
      'dashboard:{tenantId}:fleet-health',
    ],
  })
  async update(tenantId: string, id: string, dto: UpdateBarrelDto) {
    // ...
  }
}
```

---

## Padrões de Validação de Input

### DTOs com Validação

```typescript
// src/modules/barrel/dto/create-barrel.dto.ts

import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
  Length,
  Matches,
  IsDate,
  ValidateNested,
  IsDecimal,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBarrelDto {
  @ApiProperty({
    description: 'QR Code único do barril',
    example: 'KS-BAR-00001',
    pattern: '^[A-Za-z0-9-]{6,50}$',
  })
  @IsString()
  @Length(6, 50)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'qrCode must contain only alphanumeric characters and hyphens',
  })
  qrCode: string;

  @ApiPropertyOptional({
    description: 'Código de barras adicional (backup)',
    example: '7891234567890',
  })
  @IsOptional()
  @IsString()
  @Length(6, 50)
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Fabricante do barril',
    example: 'Franke',
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  manufacturer?: string;

  @ApiPropertyOptional({
    description: 'Modelo da válvula',
    enum: ValveModel,
  })
  @IsOptional()
  @IsEnum(ValveModel)
  valveModel?: ValveModel;

  @ApiProperty({
    description: 'Capacidade em litros',
    example: 50,
    enum: [10, 20, 30, 50],
  })
  @IsInt()
  @IsIn([10, 20, 30, 50], {
    message: 'capacityLiters must be one of: 10, 20, 30, 50',
  })
  capacityLiters: number;

  @ApiPropertyOptional({
    description: 'Peso da tara em kg',
    example: 12.5,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(50)
  tareWeightKg?: number;

  @ApiProperty({
    description: 'Material do barril',
    enum: BarrelMaterial,
    default: BarrelMaterial.INOX_304,
  })
  @IsEnum(BarrelMaterial)
  material: BarrelMaterial = BarrelMaterial.INOX_304;

  @ApiPropertyOptional({
    description: 'Data de compra (ISO 8601)',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  purchaseDate?: Date;

  @ApiPropertyOptional({
    description: 'Custo de aquisição em R$',
    example: 850.00,
    minimum: 0.01,
    maximum: 99999.99,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999.99)
  acquisitionCost?: number;
}
```

### Validação de GPS

```typescript
// src/common/validators/gps.validator.ts

import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ name: 'isLatitude', async: false })
export class IsLatitudeConstraint implements ValidatorConstraintInterface {
  validate(value: number): boolean {
    return typeof value === 'number' && value >= -90 && value <= 90;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'latitude must be between -90 and 90';
  }
}

@ValidatorConstraint({ name: 'isLongitude', async: false })
export class IsLongitudeConstraint implements ValidatorConstraintInterface {
  validate(value: number): boolean {
    return typeof value === 'number' && value >= -180 && value <= 180;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'longitude must be between -180 and 180';
  }
}

export function IsLatitude(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsLatitudeConstraint,
    });
  };
}

export function IsLongitude(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsLongitudeConstraint,
    });
  };
}

// Uso:
export class LogisticsEventDto {
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}
```

### Validação de CNPJ

```typescript
// src/common/validators/cnpj.validator.ts

import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ name: 'isCnpj', async: false })
export class IsCnpjConstraint implements ValidatorConstraintInterface {
  validate(cnpj: string): boolean {
    if (!cnpj) return false;
    
    // Remover caracteres não numéricos
    const cleaned = cnpj.replace(/\D/g, '');
    
    // Verificar tamanho
    if (cleaned.length !== 14) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cleaned)) return false;
    
    // Validar dígitos verificadores
    return this.validateDigits(cleaned);
  }

  private validateDigits(cnpj: string): boolean {
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    const calcDigit = (str: string, weights: number[]): number => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += parseInt(str[i]) * weights[i];
      }
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    
    const digit1 = calcDigit(cnpj, weights1);
    const digit2 = calcDigit(cnpj, weights2);
    
    return (
      digit1 === parseInt(cnpj[12]) &&
      digit2 === parseInt(cnpj[13])
    );
  }

  defaultMessage(): string {
    return 'Invalid CNPJ';
  }
}

export function IsCnpj(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCnpjConstraint,
    });
  };
}
```

### Validation Pipe Customizado

```typescript
// src/common/pipes/validation.pipe.ts

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true,
    });
    
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const details = this.formatErrors(errors);
      
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: ValidationError[]): ValidationErrorDetail[] {
    const result: ValidationErrorDetail[] = [];
    
    for (const error of errors) {
      if (error.constraints) {
        for (const message of Object.values(error.constraints)) {
          result.push({
            field: error.property,
            message,
            value: this.sanitizeValue(error.value),
          });
        }
      }
      
      // Erros de propriedades aninhadas
      if (error.children?.length) {
        const nestedErrors = this.formatErrors(error.children);
        for (const nested of nestedErrors) {
          nested.field = `${error.property}.${nested.field}`;
          result.push(nested);
        }
      }
    }
    
    return result;
  }

  private sanitizeValue(value: unknown): unknown {
    // Não expor valores sensíveis
    if (typeof value === 'string' && value.length > 100) {
      return `${value.substring(0, 50)}...[truncated]`;
    }
    return value;
  }
}
```

---

## Resumo dos Padrões

| Área | Padrão | Implementação |
|------|--------|---------------|
| **Erros** | Exceções tipadas | Hierarquia de `KegSafeException` |
| **Erros** | Filter global | `GlobalExceptionFilter` |
| **Erros** | Códigos padronizados | Enum `ErrorCode` por categoria |
| **Logging** | Estruturado JSON | `StructuredLogger` |
| **Logging** | PII masking | Sanitização automática |
| **Logging** | Correlação | TraceId/RequestId via CLS |
| **Cache** | Cache-aside | `CacheService` |
| **Cache** | Decorator | `@Cacheable`, `@CacheInvalidate` |
| **Cache** | Invalidação por evento | `CACHE_INVALIDATION_RULES` |
| **Validação** | DTOs com decorators | class-validator + Swagger |
| **Validação** | Validadores custom | CNPJ, GPS, etc. |
| **Validação** | Pipe customizado | `CustomValidationPipe` |
