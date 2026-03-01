# RULES.md — KegSafe Tech

## Regras Gerais do Projeto

### 1. Multi-Tenancy
- TODA tabela de dados de negócio DEVE ter a coluna `tenantId UUID NOT NULL`
- NUNCA acessar dados sem filtro de tenant — o Prisma middleware injeta `tenantId` em todas as queries
- RLS no PostgreSQL como camada adicional de segurança (defense in depth)
- Dados de um tenant JAMAIS podem vazar para outro tenant

### 2. Autenticação e Autorização
- JWT access token com expiração curta (15 min) + refresh token (7 dias)
- `tenantId` e `role` DEVEM estar no payload do JWT
- Guards de autenticação (`JwtAuthGuard`) em TODOS os endpoints exceto `/auth/login` e `/auth/refresh`
- Guards de role (`RolesGuard`) em TODOS os endpoints com roles específicas
- Senha armazenada com bcrypt (salt rounds >= 10)

### 3. Rastreamento Logístico
- Cada evento de scan DEVE registrar: `barrelId`, `userId`, `tenantId`, `timestamp`, `latitude`, `longitude`, `actionType`
- `actionType` é um enum: `EXPEDITION`, `DELIVERY`, `COLLECTION`, `RECEPTION`
- O timestamp DEVE ser UTC (ISO 8601) gerado no servidor, NÃO no cliente
- Latitude e longitude DEVEM ser validados (lat: -90 a 90, lng: -180 a 180)
- Evento de `RECEPTION` (Input 4) DEVE incrementar o `cycleCount` de todos os componentes do barril

### 4. Manutenção
- Componentes de barril são configuráveis por tenant (cada cervejaria pode ter seus próprios limites)
- Semáforo de saúde: Verde (< 80% do limite), Amarelo (80-99%), Vermelho (>= 100%)
- Barril com QUALQUER componente em Vermelho NÃO pode ser liberado para envase
- Ao registrar manutenção de um componente, o contador de ciclos desse componente é resetado para 0
- Ordens de Serviço automáticas são geradas quando componente atinge 90% do limite

### 5. Alertas
- Alertas são processados por um job CRON que roda diariamente às 06:00 UTC
- Cada tipo de alerta tem prioridade: CRITICAL, HIGH, MEDIUM, LOW
- Alertas CRITICAL geram push notification + e-mail imediatamente
- Alertas não podem ser duplicados (dedup por `barrelId` + `alertType` + `status=ACTIVE`)
- Alerta só é desativado quando a condição é resolvida (não por tempo)

### 6. Geofencing
- Zonas geográficas definidas como polígonos (array de coordenadas) ou círculos (centro + raio)
- Tipos de zona: `FACTORY`, `CLIENT`, `RESTRICTED`
- Scan fora de qualquer zona conhecida gera alerta de segurança
- A inferência de localização (fábrica vs. cliente) é feita por proximidade com zonas cadastradas

### 7. Descarte e Baixa Patrimonial
- Descarte NUNCA é automático — sempre requer aprovação do perfil MANAGER
- O cálculo de TCO acumulado é atualizado a cada registro de manutenção
- Barril com dano estrutural grave marcado por técnico é bloqueado imediatamente
- Registro de destino final (sucata, reciclagem) é obrigatório para completar o descarte

### 8. API e Dados
- Todos os endpoints retornam respostas paginadas (exceto lookups)
- Formato padrão: `{ data: T[], meta: { total, page, pageSize } }`
- Soft delete em todas as entidades principais (campo `deletedAt`)
- Audit trail: todas as ações críticas registradas em tabela `AuditLog`
- Datas sempre em UTC, formatação no frontend

### 9. Performance
- Índices compostos em: `(tenantId, status)`, `(tenantId, barrelId)`, `(tenantId, createdAt)`
- Queries de dashboard utilizam views materializadas ou cache (Redis) com TTL de 5 min
- Upload de imagens com limite de 5MB e tipos permitidos: JPEG, PNG
- Paginação obrigatória em listagens (máximo 100 itens por página)

### 10. Segurança
- CORS configurado apenas para domínios autorizados
- Rate limiting: 100 requests/min por usuário em endpoints gerais, 30/min em auth
- Inputs sanitizados contra XSS
- Queries Prisma protegidas contra injection por design
- Não expor stack traces em produção
- HTTPS obrigatório em todos os ambientes exceto localhost

### 11. Convenções de Nomenclatura
- Banco de dados: snake_case (Prisma mapeia automaticamente)
- API (JSON): camelCase
- Enums: UPPER_SNAKE_CASE
- Rotas: kebab-case e plural (`/barrels`, `/maintenance-orders`)
- Arquivos: kebab-case (`barrel.service.ts`, `create-barrel.dto.ts`)

---

## 12. Regras de Validação de Dados

### 12.1 Validações de Formato

| Campo | Formato | Regex/Regra | Exemplo |
|-------|---------|-------------|---------|
| **CNPJ** | 14 dígitos numéricos | `^\d{14}$` + validação de dígitos verificadores | `12345678000190` |
| **CPF** | 11 dígitos numéricos | `^\d{11}$` + validação de dígitos verificadores | `12345678901` |
| **Email** | RFC 5322 | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `user@kegsafe.tech` |
| **Telefone** | E.164 internacional | `^\+[1-9]\d{6,14}$` | `+5511999999999` |
| **QR Code** | Alfanumérico | `^[A-Za-z0-9-]{6,50}$` | `KS-BAR-00001` |
| **Internal Code** | Padrão KegSafe | `^KS-BAR-\d{5}$` | `KS-BAR-00001` |
| **UUID** | UUID v4 | RFC 4122 | `550e8400-e29b-41d4-a716-446655440000` |
| **Slug** | URL-friendly | `^[a-z0-9-]{3,50}$` | `cervejaria-petropolis` |
| **Latitude** | Decimal | `-90.0000000` a `90.0000000` | `-23.5505199` |
| **Longitude** | Decimal | `-180.0000000` a `180.0000000` | `-46.6333094` |

### 12.2 Validações de Range

| Campo | Tipo | Min | Max | Unidade |
|-------|------|-----|-----|---------|
| **capacityLiters** | Integer | 5 | 100 | litros |
| **tareWeightKg** | Decimal | 1.00 | 50.00 | kg |
| **acquisitionCost** | Decimal | 0.01 | 99999.99 | R$ |
| **maxCycles** | Integer | 1 | 500 | ciclos |
| **maxDays** | Integer | 1 | 3650 | dias |
| **radiusMeters** | Integer | 50 | 10000 | metros |
| **alertThreshold** | Decimal | 0.50 | 0.99 | percentual |
| **rating** | Decimal | 1.00 | 5.00 | nota |
| **pressureTestValue** | Decimal | 0.00 | 20.00 | bar |
| **totalCycles** | Integer | 0 | 99999 | ciclos |
| **gpsAccuracy** | Decimal | 0.00 | 9999.99 | metros |

### 12.3 Validações de Tamanho de String

| Campo | Min | Max | Obrigatório |
|-------|-----|-----|-------------|
| **name** (User) | 2 | 150 | Sim |
| **name** (Tenant) | 3 | 200 | Sim |
| **email** | 5 | 255 | Sim |
| **password** | 8 | 100 | Sim |
| **description** | 0 | 1000 | Não |
| **notes** | 0 | 500 | Não |
| **address** | 10 | 500 | Não |
| **generalNotes** | 0 | 1000 | Não |

### 12.4 Validações de Senha

```typescript
// Regras de senha
const passwordRules = {
  minLength: 8,
  maxLength: 100,
  requireUppercase: true,     // Pelo menos 1 letra maiúscula
  requireLowercase: true,     // Pelo menos 1 letra minúscula
  requireNumber: true,        // Pelo menos 1 número
  requireSpecialChar: false,  // Caractere especial opcional
  forbiddenPatterns: [
    '123456',
    'password',
    'qwerty',
    'admin',
  ],
};

// Regex de validação
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,100}$/;
```

### 12.5 Validações de Transição de Status

```typescript
// Transições válidas de BarrelStatus
const validStatusTransitions: Record<BarrelStatus, BarrelStatus[]> = {
  ACTIVE: ['IN_TRANSIT', 'IN_MAINTENANCE', 'BLOCKED'],
  IN_TRANSIT: ['ACTIVE', 'AT_CLIENT', 'BLOCKED'],
  AT_CLIENT: ['IN_TRANSIT', 'BLOCKED', 'LOST'],
  IN_MAINTENANCE: ['ACTIVE', 'BLOCKED', 'DISPOSED'],
  BLOCKED: ['ACTIVE', 'IN_MAINTENANCE', 'DISPOSED'],
  DISPOSED: [],  // Estado final, sem transições
  LOST: ['ACTIVE'],  // Pode ser recuperado
};

// Validação de transição
function isValidTransition(from: BarrelStatus, to: BarrelStatus): boolean {
  return validStatusTransitions[from].includes(to);
}
```

### 12.6 Validações de Negócio

```typescript
// Regras de validação de negócio
const businessValidations = {
  // Barril só pode ser expedido se estiver ACTIVE
  expedition: {
    requiredStatus: 'ACTIVE',
    errorCode: 'BARREL_NOT_READY_FOR_EXPEDITION',
  },
  
  // Entrega só pode ocorrer se barril estiver IN_TRANSIT
  delivery: {
    requiredStatus: 'IN_TRANSIT',
    errorCode: 'BARREL_NOT_IN_TRANSIT',
  },
  
  // Coleta só pode ocorrer se barril estiver AT_CLIENT
  collection: {
    requiredStatus: 'AT_CLIENT',
    errorCode: 'BARREL_NOT_AT_CLIENT',
  },
  
  // Recebimento só pode ocorrer se barril estiver IN_TRANSIT
  reception: {
    requiredStatus: 'IN_TRANSIT',
    errorCode: 'BARREL_NOT_IN_TRANSIT',
  },
  
  // Barril com componente RED não pode ser liberado para envase
  filling: {
    forbiddenHealthScore: 'RED',
    errorCode: 'BARREL_HAS_CRITICAL_COMPONENT',
  },
  
  // Descarte só pode ser aprovado por MANAGER
  disposalApproval: {
    requiredRole: 'MANAGER',
    errorCode: 'INSUFFICIENT_PERMISSIONS',
  },
};
```

---

## 13. Regras de Cache

### 13.1 Estratégia de Cache

```typescript
// Configuração de cache por tipo de dado
const cacheConfig = {
  // Cache de leitura frequente, mudança rara
  static: {
    tenantSettings: { ttl: '1h', invalidateOn: ['TENANT_UPDATED'] },
    componentConfigs: { ttl: '30m', invalidateOn: ['COMPONENT_CONFIG_UPDATED'] },
    geofences: { ttl: '15m', invalidateOn: ['GEOFENCE_CREATED', 'GEOFENCE_UPDATED', 'GEOFENCE_DELETED'] },
  },
  
  // Cache de leitura frequente, mudança moderada
  moderate: {
    barrelDetail: { ttl: '5m', invalidateOn: ['BARREL_UPDATED', 'LOGISTICS_EVENT', 'MAINTENANCE_LOGGED'] },
    userProfile: { ttl: '10m', invalidateOn: ['USER_UPDATED'] },
    clientList: { ttl: '10m', invalidateOn: ['CLIENT_CREATED', 'CLIENT_UPDATED'] },
  },
  
  // Cache de agregações (dashboard)
  aggregations: {
    fleetHealth: { ttl: '5m', refreshJob: 'CacheRefresh', staleWhileRevalidate: true },
    costPerLiter: { ttl: '5m', refreshJob: 'CacheRefresh', staleWhileRevalidate: true },
    alertsSummary: { ttl: '2m', invalidateOn: ['ALERT_CREATED', 'ALERT_RESOLVED'] },
    barrelLocations: { ttl: '1m', invalidateOn: ['LOGISTICS_EVENT'] },
  },
  
  // Sem cache (sempre do banco)
  noCache: [
    'auditLogs',
    'refreshTokens',
    'maintenanceLogs', // Precisa ser sempre atual
  ],
};
```

### 13.2 Padrões de Chave de Cache

```typescript
// Padrão de nomenclatura de chaves Redis
const cacheKeyPatterns = {
  // Dados por entidade
  barrel: 'barrel:{tenantId}:{barrelId}',
  barrelHealth: 'barrel:{tenantId}:{barrelId}:health',
  user: 'user:{tenantId}:{userId}',
  client: 'client:{tenantId}:{clientId}',
  
  // Listas/coleções
  barrelsByStatus: 'barrels:{tenantId}:status:{status}',
  geofencesByTenant: 'geofences:{tenantId}',
  alertsByTenant: 'alerts:{tenantId}:active',
  
  // Agregações de dashboard
  dashboard: 'dashboard:{tenantId}:{metric}',
  fleetHealth: 'dashboard:{tenantId}:fleet-health',
  costPerLiter: 'dashboard:{tenantId}:cost-per-liter',
  
  // Sessões e tokens
  refreshToken: 'refresh:{tokenHash}',
  userSessions: 'sessions:{userId}',
  
  // Rate limiting
  rateLimit: 'ratelimit:{userId}:{endpoint}',
  rateLimitAuth: 'ratelimit:auth:{ip}',
};
```

### 13.3 Invalidação de Cache

```typescript
// Eventos que disparam invalidação
const cacheInvalidationRules = {
  // Quando um barril é atualizado
  BARREL_UPDATED: [
    'barrel:{tenantId}:{barrelId}',
    'barrel:{tenantId}:{barrelId}:health',
    'dashboard:{tenantId}:fleet-health',
  ],
  
  // Quando um evento logístico é registrado
  LOGISTICS_EVENT: [
    'barrel:{tenantId}:{barrelId}',
    'barrel:{tenantId}:{barrelId}:health',
    'dashboard:{tenantId}:fleet-health',
    'dashboard:{tenantId}:barrel-locations',
  ],
  
  // Quando manutenção é registrada
  MAINTENANCE_LOGGED: [
    'barrel:{tenantId}:{barrelId}',
    'barrel:{tenantId}:{barrelId}:health',
    'dashboard:{tenantId}:fleet-health',
    'dashboard:{tenantId}:cost-per-liter',
  ],
  
  // Quando alerta é criado/resolvido
  ALERT_CREATED: ['alerts:{tenantId}:active'],
  ALERT_RESOLVED: ['alerts:{tenantId}:active'],
  
  // Quando geofence muda
  GEOFENCE_UPDATED: ['geofences:{tenantId}'],
};

// Função de invalidação
async function invalidateCache(event: string, context: CacheContext): Promise<void> {
  const patterns = cacheInvalidationRules[event] || [];
  
  for (const pattern of patterns) {
    const key = interpolateKey(pattern, context);
    await redis.del(key);
    
    // Log para debug
    logger.debug(`Cache invalidated: ${key}`, { event, context });
  }
}
```

### 13.4 Cache-Aside Pattern

```typescript
// Implementação do padrão cache-aside
async function getBarrelWithCache(tenantId: string, barrelId: string): Promise<Barrel> {
  const cacheKey = `barrel:${tenantId}:${barrelId}`;
  
  // 1. Tentar obter do cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. Se não encontrou, buscar do banco
  const barrel = await prisma.barrel.findUnique({
    where: { id: barrelId, tenantId },
    include: { componentCycles: true },
  });
  
  if (!barrel) {
    throw new NotFoundException('Barrel not found');
  }
  
  // 3. Salvar no cache com TTL
  await redis.setex(cacheKey, 300, JSON.stringify(barrel)); // 5 min
  
  return barrel;
}
```

### 13.5 Stale-While-Revalidate

```typescript
// Para métricas de dashboard que podem ser ligeiramente desatualizadas
async function getFleetHealthWithSWR(tenantId: string): Promise<FleetHealth> {
  const cacheKey = `dashboard:${tenantId}:fleet-health`;
  
  // Obter do cache (mesmo que stale)
  const cached = await redis.get(cacheKey);
  const ttl = await redis.ttl(cacheKey);
  
  if (cached) {
    // Se TTL < 60s, revalidar em background
    if (ttl < 60) {
      setImmediate(() => revalidateFleetHealth(tenantId, cacheKey));
    }
    return JSON.parse(cached);
  }
  
  // Cache miss - calcular e armazenar
  return revalidateFleetHealth(tenantId, cacheKey);
}

async function revalidateFleetHealth(tenantId: string, cacheKey: string): Promise<FleetHealth> {
  const health = await calculateFleetHealth(tenantId);
  await redis.setex(cacheKey, 300, JSON.stringify(health));
  return health;
}
```

---

## 14. Regras de Logging

### 14.1 Níveis de Log

| Nível | Quando Usar | Exemplos |
|-------|-------------|----------|
| **ERROR** | Falhas que impedem operação | Exception não tratada, falha de conexão DB, timeout |
| **WARN** | Situações anômalas mas recuperáveis | Retry de operação, rate limit atingido, validação falhou |
| **INFO** | Eventos de negócio importantes | Login, scan de barril, manutenção registrada, alerta criado |
| **DEBUG** | Informações para troubleshooting | Query executada, cache hit/miss, request/response |

### 14.2 Estrutura de Log

```typescript
// Estrutura obrigatória de log
interface LogEntry {
  // Campos obrigatórios
  timestamp: string;      // ISO 8601 com timezone
  level: LogLevel;        // error, warn, info, debug
  message: string;        // Descrição do evento
  service: string;        // kegsafe-api, kegsafe-web, kegsafe-mobile
  
  // Correlação
  traceId: string;        // ID de rastreamento (OpenTelemetry)
  spanId?: string;        // Span ID
  requestId?: string;     // ID único da requisição
  
  // Contexto de negócio
  tenantId?: string;      // ID do tenant
  userId?: string;        // ID do usuário
  barrelId?: string;      // ID do barril (se aplicável)
  
  // Contexto de request
  httpMethod?: string;
  httpPath?: string;
  httpStatus?: number;
  latencyMs?: number;
  
  // Erro (se aplicável)
  errorCode?: string;
  errorMessage?: string;
  errorStack?: string;    // Apenas em dev/staging
  
  // Dados adicionais
  metadata?: Record<string, unknown>;
}
```

### 14.3 O Que Logar

```typescript
// Eventos que DEVEM ser logados
const mandatoryLogEvents = {
  // Autenticação
  AUTH: ['LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'TOKEN_REFRESH', 'PASSWORD_RESET'],
  
  // Eventos de negócio críticos
  LOGISTICS: ['EXPEDITION', 'DELIVERY', 'COLLECTION', 'RECEPTION', 'BATCH_SCAN'],
  MAINTENANCE: ['CHECKLIST_COMPLETED', 'TRIAGE_PERFORMED', 'OS_CREATED', 'OS_COMPLETED'],
  ALERTS: ['ALERT_CREATED', 'ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED'],
  DISPOSAL: ['DISPOSAL_REQUESTED', 'DISPOSAL_APPROVED', 'DISPOSAL_COMPLETED'],
  
  // Operações administrativas
  ADMIN: ['USER_CREATED', 'USER_UPDATED', 'USER_DISABLED', 'TENANT_CONFIG_CHANGED'],
  
  // Erros e exceções
  ERRORS: ['UNHANDLED_EXCEPTION', 'VALIDATION_ERROR', 'AUTHORIZATION_DENIED', 'RATE_LIMITED'],
};

// Eventos que NÃO devem ser logados (ou apenas em debug)
const debugOnlyEvents = [
  'HEALTH_CHECK',
  'CACHE_HIT',
  'CACHE_MISS',
  'DB_QUERY_EXECUTED',
];
```

### 14.4 PII Masking

```typescript
// Campos que devem ser mascarados
const piiFields = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'apiKey',
  'secret',
];

// Campos que devem ser parcialmente mascarados
const partialMaskFields = {
  email: (value: string) => {
    const [local, domain] = value.split('@');
    return `${local[0]}***@${domain}`;
  },
  phone: (value: string) => {
    return value.replace(/\d(?=\d{4})/g, '*');
  },
  cnpj: (value: string) => {
    return `**.***.***/${value.slice(8, 12)}-**`;
  },
  cpf: (value: string) => {
    return `***.***.${value.slice(6, 9)}-**`;
  },
};

// Função de sanitização
function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  
  for (const field of piiFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  for (const [field, maskFn] of Object.entries(partialMaskFields)) {
    if (field in sanitized && typeof sanitized[field] === 'string') {
      sanitized[field] = maskFn(sanitized[field] as string);
    }
  }
  
  return sanitized;
}
```

### 14.5 Exemplos de Log

```json
// Login bem-sucedido
{
  "timestamp": "2026-02-28T10:30:00.123Z",
  "level": "info",
  "message": "User logged in successfully",
  "service": "kegsafe-api",
  "traceId": "abc123def456",
  "requestId": "req-789",
  "tenantId": "tenant-uuid",
  "userId": "user-uuid",
  "httpMethod": "POST",
  "httpPath": "/api/auth/login",
  "httpStatus": 200,
  "latencyMs": 142,
  "metadata": {
    "email": "j***@email.com",
    "role": "LOGISTICS",
    "ipAddress": "192.168.1.100"
  }
}

// Evento logístico
{
  "timestamp": "2026-02-28T10:35:00.456Z",
  "level": "info",
  "message": "Logistics event created",
  "service": "kegsafe-api",
  "traceId": "def456ghi789",
  "requestId": "req-790",
  "tenantId": "tenant-uuid",
  "userId": "user-uuid",
  "barrelId": "barrel-uuid",
  "httpMethod": "POST",
  "httpPath": "/api/logistics/delivery",
  "httpStatus": 201,
  "latencyMs": 89,
  "metadata": {
    "actionType": "DELIVERY",
    "clientId": "client-uuid",
    "location": { "lat": -23.5505, "lng": -46.6333 },
    "inferredZone": "CLIENT"
  }
}

// Erro de validação
{
  "timestamp": "2026-02-28T10:40:00.789Z",
  "level": "warn",
  "message": "Validation failed",
  "service": "kegsafe-api",
  "traceId": "ghi789jkl012",
  "requestId": "req-791",
  "tenantId": "tenant-uuid",
  "userId": "user-uuid",
  "httpMethod": "POST",
  "httpPath": "/api/barrels",
  "httpStatus": 400,
  "latencyMs": 12,
  "errorCode": "VALIDATION_ERROR",
  "errorMessage": "Invalid barrel data",
  "metadata": {
    "validationErrors": [
      { "field": "capacityLiters", "message": "must be one of: 10, 20, 30, 50" },
      { "field": "qrCode", "message": "already exists" }
    ]
  }
}
```

---

## 15. Regras de Rate Limiting

### 15.1 Configuração por Tipo de Endpoint

```typescript
// Configuração de rate limiting
const rateLimitConfig = {
  // Endpoints de autenticação (mais restritivos)
  auth: {
    login: {
      windowMs: 60 * 1000,      // 1 minuto
      maxRequests: 5,           // 5 tentativas
      keyGenerator: (req) => req.ip,  // Por IP
      handler: 'AUTH_RATE_LIMITED',
    },
    refresh: {
      windowMs: 60 * 1000,
      maxRequests: 10,
      keyGenerator: (req) => req.ip,
      handler: 'AUTH_RATE_LIMITED',
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hora
      maxRequests: 3,
      keyGenerator: (req) => req.body.email,
      handler: 'AUTH_RATE_LIMITED',
    },
  },
  
  // Endpoints de escrita (moderados)
  write: {
    createBarrel: {
      windowMs: 60 * 1000,
      maxRequests: 30,
      keyGenerator: (req) => `${req.tenantId}:${req.userId}`,
      handler: 'WRITE_RATE_LIMITED',
    },
    logisticsEvent: {
      windowMs: 60 * 1000,
      maxRequests: 100,  // Scan em lote pode ser alto
      keyGenerator: (req) => `${req.tenantId}:${req.userId}`,
      handler: 'WRITE_RATE_LIMITED',
    },
    maintenanceLog: {
      windowMs: 60 * 1000,
      maxRequests: 20,
      keyGenerator: (req) => `${req.tenantId}:${req.userId}`,
      handler: 'WRITE_RATE_LIMITED',
    },
  },
  
  // Endpoints de leitura (mais permissivos)
  read: {
    listBarrels: {
      windowMs: 60 * 1000,
      maxRequests: 60,
      keyGenerator: (req) => `${req.tenantId}:${req.userId}`,
      handler: 'READ_RATE_LIMITED',
    },
    dashboard: {
      windowMs: 60 * 1000,
      maxRequests: 30,
      keyGenerator: (req) => `${req.tenantId}:${req.userId}`,
      handler: 'READ_RATE_LIMITED',
    },
    exportPdf: {
      windowMs: 60 * 60 * 1000, // 1 hora
      maxRequests: 10,
      keyGenerator: (req) => `${req.tenantId}:${req.userId}`,
      handler: 'EXPORT_RATE_LIMITED',
    },
  },
  
  // Rate limit global por tenant (proteção DDoS)
  tenant: {
    windowMs: 60 * 1000,
    maxRequests: 1000,
    keyGenerator: (req) => req.tenantId,
    handler: 'TENANT_RATE_LIMITED',
  },
};
```

### 15.2 Headers de Rate Limit

```typescript
// Headers retornados em cada resposta
const rateLimitHeaders = {
  'X-RateLimit-Limit': '100',          // Limite máximo
  'X-RateLimit-Remaining': '95',       // Requisições restantes
  'X-RateLimit-Reset': '1709123456',   // Timestamp de reset (epoch)
  'Retry-After': '60',                 // Segundos até liberar (quando bloqueado)
};
```

### 15.3 Resposta de Rate Limit Excedido

```typescript
// HTTP 429 Too Many Requests
const rateLimitResponse = {
  statusCode: 429,
  error: 'Too Many Requests',
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'You have exceeded the rate limit. Please try again later.',
  retryAfter: 60,  // segundos
  limit: 100,
  remaining: 0,
  resetAt: '2026-02-28T10:31:00.000Z',
};
```

### 15.4 Implementação com Redis

```typescript
// Algoritmo: Sliding Window Log
import { Redis } from 'ioredis';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

async function checkRateLimit(
  redis: Redis,
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const multi = redis.multi();
  
  // Remover entradas antigas
  multi.zremrangebyscore(key, 0, windowStart);
  
  // Adicionar requisição atual
  multi.zadd(key, now, `${now}-${Math.random()}`);
  
  // Contar requisições na janela
  multi.zcard(key);
  
  // Definir expiração
  multi.pexpire(key, windowMs);
  
  const results = await multi.exec();
  const requestCount = results[2][1] as number;
  
  const allowed = requestCount <= maxRequests;
  const remaining = Math.max(0, maxRequests - requestCount);
  const resetAt = new Date(now + windowMs);
  
  return { allowed, remaining, resetAt };
}
```

### 15.5 Exceções de Rate Limit

```typescript
// Endpoints isentos de rate limiting
const rateLimitExemptions = [
  '/health',           // Health check
  '/metrics',          // Prometheus metrics
  '/.well-known/*',    // ACME challenges
];

// IPs/ranges isentos (interno/monitoramento)
const exemptIpRanges = [
  '10.0.0.0/8',        // Rede interna
  '172.16.0.0/12',     // Rede interna
  '127.0.0.1/32',      // Localhost
];
```
