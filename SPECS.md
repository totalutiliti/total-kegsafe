# SPECS.md — KegSafe Tech — Especificações Técnicas

## 1. Visão Geral da Arquitetura

```
┌────┐     ┌────┐     ┌────┐
│  App Mobile      │     │  Dashboard Web   │     │   Jobs/CRON      │
│  (React Native)  │     │  (Next.js)       │     │  (NestJS Worker) │
└────┬────┘     └────┬────┘     └────┬────┘
         │                    │                    │
         └────┬────┘                    │
                    ▼                    ▼
              ┌────┐                    ┌────┐
              │  API Gateway │◄────│  Alert Engine │
              │  (NestJS)    │                    │  (Scheduled)  │
              └────┬────┘                    └────┬────┘
                    │                    │
                    ▼                    ▼
              ┌────┐     ┌────┐   ┌────┐
              │  PostgreSQL  │◄────│  Redis   │   │ Azure Blob │
              │  (RLS)       │     │  (Cache) │   │ Storage    │
              └────┘     └────┘   └────┘
```

## 2. Módulos e Endpoints da API

### 2.1 Auth (`/api/auth`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| POST | `/login` | Login com email/senha | Público | 5/min por IP |
| POST | `/refresh` | Renovar access token | Público (com refresh token) | 10/min por IP |
| POST | `/logout` | Invalidar refresh token | Autenticado | 30/min |
| GET | `/me` | Dados do usuário logado | Autenticado | 60/min |

### 2.2 Barrels (`/api/barrels`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| GET | `/` | Listar barris (paginado, filtros) | MANAGER, ADMIN | 60/min |
| GET | `/:id` | Detalhe do barril com histórico | Todos | 60/min |
| POST | `/` | Cadastrar novo barril | ADMIN | 30/min |
| PATCH | `/:id` | Atualizar dados do barril | ADMIN | 30/min |
| DELETE | `/:id` | Soft delete do barril | ADMIN | 10/min |
| GET | `/:id/health` | Status de saúde (semáforo) | Todos | 60/min |
| GET | `/:id/timeline` | Timeline completa de eventos | MANAGER, ADMIN | 30/min |
| POST | `/:id/scan` | Registrar scan de QR Code | LOGISTICS, MAINTENANCE | 100/min |

### 2.3 Logistics (`/api/logistics`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| POST | `/expedition` | Input 1 — Saída da fábrica | LOGISTICS | 100/min |
| POST | `/delivery` | Input 2 — Entrega no cliente | LOGISTICS | 100/min |
| POST | `/collection` | Input 3 — Coleta no cliente | LOGISTICS | 100/min |
| POST | `/reception` | Input 4 — Retorno à fábrica | LOGISTICS | 100/min |
| POST | `/batch-scan` | Scan em lote (modo metralhadora) | LOGISTICS | 30/min |
| GET | `/active-shipments` | Barris em trânsito | MANAGER | 60/min |

### 2.4 Maintenance (`/api/maintenance`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| GET | `/orders` | Listar ordens de serviço | MAINTENANCE, MANAGER | 60/min |
| GET | `/orders/:id` | Detalhe da OS | MAINTENANCE, MANAGER | 60/min |
| POST | `/orders` | Criar OS manual | MAINTENANCE | 20/min |
| POST | `/checklist` | Registrar checklist de manutenção | MAINTENANCE | 20/min |
| POST | `/triage` | Triagem rápida no recebimento | MAINTENANCE, LOGISTICS | 60/min |
| GET | `/components/config` | Configuração de componentes | ADMIN | 30/min |
| PATCH | `/components/config/:id` | Atualizar config de componente | ADMIN | 10/min |

### 2.5 Alerts (`/api/alerts`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| GET | `/` | Listar alertas ativos | MANAGER, ADMIN | 60/min |
| GET | `/:id` | Detalhe do alerta | MANAGER, ADMIN | 60/min |
| PATCH | `/:id/acknowledge` | Marcar alerta como visto | MANAGER | 30/min |
| PATCH | `/:id/resolve` | Resolver alerta | MANAGER, ADMIN | 30/min |

### 2.6 Dashboard (`/api/dashboard`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| GET | `/fleet-health` | Saúde da frota (semáforo geral) | MANAGER | 30/min |
| GET | `/cost-per-liter` | Métrica: custo de manutenção/litro | MANAGER | 30/min |
| GET | `/asset-turnover` | Giro de ativos (ciclo médio) | MANAGER | 30/min |
| GET | `/loss-report` | Prejuízo estimado por extravio | MANAGER | 30/min |
| GET | `/supplier-ranking` | Ranking de prestadores | MANAGER | 30/min |
| GET | `/capex-forecast` | Previsão de investimento | MANAGER | 30/min |
| POST | `/export-pdf` | Gerar relatório executivo PDF | MANAGER | 10/hora |

### 2.7 Geofences (`/api/geofences`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| GET | `/` | Listar zonas cadastradas | MANAGER, ADMIN | 60/min |
| POST | `/` | Criar zona geográfica | ADMIN | 20/min |
| PATCH | `/:id` | Atualizar zona | ADMIN | 20/min |
| DELETE | `/:id` | Remover zona | ADMIN | 10/min |

### 2.8 Disposal (`/api/disposals`)
| Método | Rota | Descrição | Acesso | Rate Limit |
|--------|------|-----------|--------|------------|
| GET | `/suggestions` | Barris com sugestão de descarte | MANAGER | 30/min |
| POST | `/` | Iniciar processo de descarte | MAINTENANCE | 10/min |
| PATCH | `/:id/approve` | Aprovar baixa patrimonial | MANAGER | 10/min |
| PATCH | `/:id/complete` | Registrar destino final | ADMIN | 10/min |

---

## 3. Headers Obrigatórios

### 3.1 Headers de Request

| Header | Obrigatório | Descrição | Exemplo |
|--------|-------------|-----------|---------|
| `Authorization` | Sim* | JWT Bearer token | `Bearer eyJhbGciOiJIUzI1NiIs...` |
| `Content-Type` | Sim (POST/PATCH) | Tipo do corpo | `application/json` |
| `Accept` | Recomendado | Tipo de resposta aceito | `application/json` |
| `Accept-Language` | Opcional | Idioma preferido | `pt-BR` |
| `X-Request-ID` | Opcional | ID para correlação | `550e8400-e29b-41d4-a716-446655440000` |
| `X-Client-Version` | Recomendado | Versão do app mobile | `1.2.3` |
| `X-Device-ID` | Recomendado (mobile) | ID único do dispositivo | `device-uuid-here` |

*Exceto endpoints públicos: `/auth/login`, `/auth/refresh`, `/health`

### 3.2 Headers de Response

| Header | Sempre Presente | Descrição | Exemplo |
|--------|-----------------|-----------|---------|
| `Content-Type` | Sim | Tipo do corpo | `application/json; charset=utf-8` |
| `X-Request-ID` | Sim | ID de correlação | `550e8400-e29b-41d4-a716-446655440000` |
| `X-RateLimit-Limit` | Sim | Limite de requests | `100` |
| `X-RateLimit-Remaining` | Sim | Requests restantes | `95` |
| `X-RateLimit-Reset` | Sim | Timestamp de reset | `1709123456` |
| `X-Response-Time` | Sim | Tempo de resposta | `142ms` |
| `Cache-Control` | Condicional | Política de cache | `private, max-age=300` |
| `ETag` | Condicional | Hash do recurso | `"abc123def456"` |

---

## 4. Códigos de Erro Padronizados

### 4.1 Estrutura de Erro

```typescript
interface ErrorResponse {
  statusCode: number;           // HTTP status code
  error: string;               // Nome do erro HTTP
  code: string;                // Código interno padronizado
  message: string;             // Mensagem legível
  details?: ValidationError[]; // Detalhes de validação (se aplicável)
  traceId?: string;            // ID para suporte
  timestamp: string;           // ISO 8601
}

interface ValidationError {
  field: string;               // Campo com erro
  message: string;             // Descrição do erro
  value?: unknown;             // Valor inválido (sem PII)
}
```

### 4.2 Códigos de Erro por Categoria

#### Autenticação (AUTH_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password | Login com credenciais erradas |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token has expired | JWT expirado |
| `AUTH_TOKEN_INVALID` | 401 | Invalid or malformed token | JWT inválido |
| `AUTH_REFRESH_EXPIRED` | 401 | Refresh token has expired | Refresh token expirado |
| `AUTH_REFRESH_REVOKED` | 401 | Refresh token has been revoked | Token foi invalidado |
| `AUTH_ACCOUNT_DISABLED` | 403 | Account has been disabled | Usuário desativado |
| `AUTH_ACCOUNT_LOCKED` | 403 | Account temporarily locked | Muitas tentativas falhas |
| `AUTH_INSUFFICIENT_ROLE` | 403 | Insufficient permissions for this action | Role não autorizada |
| `AUTH_TENANT_MISMATCH` | 403 | Resource belongs to different tenant | Tentativa de acessar outro tenant |

#### Validação (VALIDATION_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `VALIDATION_FAILED` | 400 | Validation failed | Erro genérico de validação |
| `VALIDATION_REQUIRED_FIELD` | 400 | Field is required | Campo obrigatório ausente |
| `VALIDATION_INVALID_FORMAT` | 400 | Invalid format | Formato inválido (email, CNPJ, etc) |
| `VALIDATION_OUT_OF_RANGE` | 400 | Value out of allowed range | Valor fora do range permitido |
| `VALIDATION_INVALID_ENUM` | 400 | Invalid enum value | Valor não existe no enum |
| `VALIDATION_STRING_TOO_LONG` | 400 | String exceeds maximum length | String maior que o permitido |
| `VALIDATION_INVALID_UUID` | 400 | Invalid UUID format | UUID malformado |
| `VALIDATION_INVALID_DATE` | 400 | Invalid date format | Data inválida |

#### Recursos (RESOURCE_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `RESOURCE_NOT_FOUND` | 404 | Resource not found | Entidade não existe |
| `RESOURCE_ALREADY_EXISTS` | 409 | Resource already exists | Violação de unique constraint |
| `RESOURCE_DELETED` | 410 | Resource has been deleted | Entidade soft-deleted |
| `RESOURCE_CONFLICT` | 409 | Resource state conflict | Conflito de estado |

#### Barril (BARREL_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `BARREL_NOT_FOUND` | 404 | Barrel not found | Barril não existe |
| `BARREL_QR_CODE_EXISTS` | 409 | QR code already registered | QR Code já vinculado |
| `BARREL_INVALID_STATUS_TRANSITION` | 400 | Invalid status transition | Transição de status inválida |
| `BARREL_NOT_READY_FOR_EXPEDITION` | 400 | Barrel not ready for expedition | Status não é ACTIVE |
| `BARREL_NOT_IN_TRANSIT` | 400 | Barrel is not in transit | Status não é IN_TRANSIT |
| `BARREL_NOT_AT_CLIENT` | 400 | Barrel is not at client | Status não é AT_CLIENT |
| `BARREL_HAS_CRITICAL_COMPONENT` | 400 | Barrel has critical component | Componente RED |
| `BARREL_BLOCKED` | 400 | Barrel is blocked | Barril bloqueado |
| `BARREL_DISPOSED` | 400 | Barrel has been disposed | Barril descartado |

#### Manutenção (MAINTENANCE_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `MAINTENANCE_ORDER_NOT_FOUND` | 404 | Maintenance order not found | OS não existe |
| `MAINTENANCE_ORDER_ALREADY_COMPLETED` | 400 | Order already completed | OS já finalizada |
| `MAINTENANCE_ORDER_CANCELLED` | 400 | Order has been cancelled | OS cancelada |
| `MAINTENANCE_INVALID_COMPONENT` | 400 | Invalid component for this barrel | Componente não existe |
| `MAINTENANCE_PRESSURE_TEST_REQUIRED` | 400 | Pressure test is required | Teste de pressão obrigatório |

#### Alerta (ALERT_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `ALERT_NOT_FOUND` | 404 | Alert not found | Alerta não existe |
| `ALERT_ALREADY_RESOLVED` | 400 | Alert already resolved | Alerta já resolvido |
| `ALERT_CANNOT_ACKNOWLEDGE` | 400 | Alert cannot be acknowledged | Estado não permite |

#### Geofence (GEOFENCE_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `GEOFENCE_NOT_FOUND` | 404 | Geofence not found | Zona não existe |
| `GEOFENCE_VIOLATION` | 400 | Location outside known zones | Scan fora de zona |
| `GEOFENCE_OVERLAPPING` | 400 | Geofence overlaps existing zone | Zonas sobrepostas |

#### Rate Limiting (RATE_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Rate limit atingido |
| `RATE_LIMIT_AUTH` | 429 | Too many authentication attempts | Rate limit de auth |
| `RATE_LIMIT_EXPORT` | 429 | Export limit exceeded | Muitas exportações |

#### Sistema (SYSTEM_*)

| Código | HTTP | Mensagem | Quando |
|--------|------|----------|--------|
| `SYSTEM_INTERNAL_ERROR` | 500 | Internal server error | Erro não tratado |
| `SYSTEM_SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Serviço fora |
| `SYSTEM_DATABASE_ERROR` | 500 | Database operation failed | Erro de DB |
| `SYSTEM_EXTERNAL_SERVICE_ERROR` | 502 | External service error | Erro em serviço externo |

---

## 5. Exemplos de Responses de Erro

### 5.1 Erro de Autenticação (401)

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "code": "AUTH_TOKEN_EXPIRED",
  "message": "Access token has expired",
  "traceId": "abc123def456",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 5.2 Erro de Validação (400)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [
    {
      "field": "capacityLiters",
      "message": "must be one of: 10, 20, 30, 50",
      "value": 25
    },
    {
      "field": "qrCode",
      "message": "must match pattern ^[A-Za-z0-9-]{6,50}$"
    }
  ],
  "traceId": "def456ghi789",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 5.3 Erro de Recurso Não Encontrado (404)

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "code": "BARREL_NOT_FOUND",
  "message": "Barrel not found",
  "traceId": "ghi789jkl012",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 5.4 Erro de Conflito de Estado (400)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "BARREL_NOT_READY_FOR_EXPEDITION",
  "message": "Barrel is not ready for expedition. Current status: AT_CLIENT",
  "details": [
    {
      "field": "status",
      "message": "expected ACTIVE, got AT_CLIENT",
      "value": "AT_CLIENT"
    }
  ],
  "traceId": "jkl012mno345",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 5.5 Erro de Permissão (403)

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "code": "AUTH_INSUFFICIENT_ROLE",
  "message": "Insufficient permissions. Required: ADMIN, Current: LOGISTICS",
  "traceId": "mno345pqr678",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 5.6 Erro de Rate Limit (429)

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 60,
  "limit": 100,
  "remaining": 0,
  "resetAt": "2026-02-28T10:31:00.000Z",
  "traceId": "pqr678stu901",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 5.7 Erro Interno (500)

```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "code": "SYSTEM_INTERNAL_ERROR",
  "message": "An unexpected error occurred. Please contact support with the trace ID.",
  "traceId": "stu901vwx234",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

---

## 6. Payloads Principais

### 6.1 Scan de QR Code (Input Logístico)
```json
{
  "barrelQrCode": "KS-BAR-00001",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "actionType": "EXPEDITION",
  "notes": "string (opcional)"
}
```
**Response de Sucesso (201):**
```json
{
  "eventId": "uuid",
  "barrelId": "uuid",
  "barrel": {
    "internalCode": "KS-BAR-00001",
    "capacity": 50,
    "status": "IN_TRANSIT",
    "healthScore": "GREEN"
  },
  "timestamp": "2026-02-28T10:30:00Z",
  "location": { "lat": -23.5505, "lng": -46.6333 },
  "inferredZone": "FACTORY"
}
```

**Response de Erro - Barril não encontrado (404):**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "code": "BARREL_NOT_FOUND",
  "message": "Barrel with QR code 'KS-BAR-99999' not found",
  "traceId": "trace-123",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

**Response de Erro - Status inválido (400):**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "BARREL_NOT_READY_FOR_EXPEDITION",
  "message": "Barrel cannot be expedited. Current status: AT_CLIENT",
  "details": [
    {
      "field": "status",
      "message": "Expected status ACTIVE for EXPEDITION action",
      "value": "AT_CLIENT"
    }
  ],
  "traceId": "trace-124",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

**Response de Erro - Geofence violation (400):**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "GEOFENCE_VIOLATION",
  "message": "Location is outside all known zones",
  "details": [
    {
      "field": "location",
      "message": "Coordinates do not match any registered geofence",
      "value": { "lat": -23.5505, "lng": -46.6333 }
    }
  ],
  "traceId": "trace-125",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 6.2 Checklist de Manutenção
```json
{
  "barrelId": "uuid",
  "maintenanceType": "PREVENTIVE",
  "components": [
    { "componentConfigId": "uuid", "action": "REPLACED", "notes": "" },
    { "componentConfigId": "uuid", "action": "INSPECTED", "notes": "Sem desgaste visível" }
  ],
  "pressureTestOk": true,
  "washCompleted": true,
  "generalNotes": "Barril em bom estado geral"
}
```

**Response de Sucesso (201):**
```json
{
  "maintenanceLogId": "uuid",
  "barrelId": "uuid",
  "timestamp": "2026-02-28T10:30:00Z",
  "updatedComponents": [
    {
      "componentConfigId": "uuid",
      "name": "O-Ring",
      "action": "REPLACED",
      "previousHealthScore": "YELLOW",
      "newHealthScore": "GREEN",
      "cyclesReset": true
    }
  ],
  "barrelHealthScore": "GREEN"
}
```

**Response de Erro - Barril não encontrado (404):**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "code": "BARREL_NOT_FOUND",
  "message": "Barrel not found",
  "traceId": "trace-126",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

**Response de Erro - Teste de pressão obrigatório (400):**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "MAINTENANCE_PRESSURE_TEST_REQUIRED",
  "message": "Pressure test confirmation is required for this maintenance type",
  "details": [
    {
      "field": "pressureTestOk",
      "message": "Field is required and must be true"
    }
  ],
  "traceId": "trace-127",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

### 6.3 Triagem Rápida
```json
{
  "barrelId": "uuid",
  "intact": false,
  "damageType": "STRUCTURAL",
  "damageNotes": "Amassado no chimb inferior",
  "photoUrl": "https://images.shootingsportsman.com/wp-content/uploads/2026/02/Barrel-Dents-1.webp"
}
```

**Response de Sucesso (201):**
```json
{
  "triageId": "uuid",
  "barrelId": "uuid",
  "result": "BLOCKED",
  "barrelNewStatus": "BLOCKED",
  "alertCreated": true,
  "alertId": "alert-uuid",
  "timestamp": "2026-02-28T10:30:00Z"
}
```

**Response de Erro - Tipo de dano obrigatório (400):**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [
    {
      "field": "damageType",
      "message": "damageType is required when intact is false"
    }
  ],
  "traceId": "trace-128",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

---

## 7. Enums do Sistema

```typescript
enum BarrelStatus {
  ACTIVE = 'ACTIVE',
  IN_TRANSIT = 'IN_TRANSIT',
  AT_CLIENT = 'AT_CLIENT',
  IN_MAINTENANCE = 'IN_MAINTENANCE',
  BLOCKED = 'BLOCKED',
  DISPOSED = 'DISPOSED',
  LOST = 'LOST',
}

enum LogisticsAction {
  EXPEDITION = 'EXPEDITION',     // Input 1
  DELIVERY = 'DELIVERY',         // Input 2
  COLLECTION = 'COLLECTION',     // Input 3
  RECEPTION = 'RECEPTION',       // Input 4
}

enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  PREDICTIVE = 'PREDICTIVE',
}

enum ComponentAction {
  INSPECTED = 'INSPECTED',
  REPLACED = 'REPLACED',
  REPAIRED = 'REPAIRED',
}

enum HealthScore {
  GREEN = 'GREEN',     // < 80% do limite
  YELLOW = 'YELLOW',   // 80-99% do limite
  RED = 'RED',         // >= 100% do limite
}

enum AlertType {
  COMPONENT_END_OF_LIFE = 'COMPONENT_END_OF_LIFE',
  MANDATORY_INSPECTION = 'MANDATORY_INSPECTION',
  IDLE_AT_CLIENT = 'IDLE_AT_CLIENT',
  IDLE_AT_FACTORY = 'IDLE_AT_FACTORY',
  GEOFENCE_VIOLATION = 'GEOFENCE_VIOLATION',
  AFTER_HOURS_MOVEMENT = 'AFTER_HOURS_MOVEMENT',
  SUPPLIER_SLA_BREACH = 'SUPPLIER_SLA_BREACH',
  DISPOSAL_SUGGESTED = 'DISPOSAL_SUGGESTED',
}

enum AlertPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

enum GeofenceType {
  FACTORY = 'FACTORY',
  CLIENT = 'CLIENT',
  RESTRICTED = 'RESTRICTED',
}

enum Role {
  LOGISTICS = 'LOGISTICS',
  MAINTENANCE = 'MAINTENANCE',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
}

enum DisposalStatus {
  SUGGESTED = 'SUGGESTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

enum DisposalDestination {
  SCRAP_SALE = 'SCRAP_SALE',
  RECYCLING = 'RECYCLING',
  DONATION = 'DONATION',
}
```

---

## 8. Regras de Cálculo

### 8.1 Custo de Manutenção por Litro (CL)
```
CL = Σ(custo_peças + custo_mão_de_obra) / Σ(volume_litros_entregues)
Período: mensal, com comparativo trimestral
```

### 8.2 Health Score por Componente
```
percentual = (ciclos_desde_ultima_manutencao / vida_util_ciclos) * 100
OU
percentual = (dias_desde_ultima_manutencao / vida_util_dias) * 100

Usar o MAIOR dos dois percentuais.

GREEN:  percentual < 80
YELLOW: 80 <= percentual < 100
RED:    percentual >= 100
```

### 8.3 TCO Acumulado para Descarte
```
SE custo_manutencao_acumulado >= custo_barril_novo * K (K = 0.65)
ENTÃO sugerir descarte no próximo defeito

OU

SE manutencoes_corretivas_12_meses > 3
ENTÃO sugerir descarte
```

### 8.4 Giro de Ativo (Ciclo Médio)
```
ciclo_medio = media(data_reception - data_expedition) para últimos 90 dias
Meta: medir eficiência logística
```

---

## 9. Jobs Agendados (CRON)

| Job | Schedule | Descrição |
|----|----|----|
| `AlertHealthCheck` | Diário 06:00 UTC | Verifica componentes próximos do limite |
| `AlertIdleBarrels` | Diário 08:00 UTC | Detecta barris ociosos (cliente e pátio) |
| `AlertGeofence` | A cada 1 hora | Verifica violações de geofencing |
| `ReportWeekly` | Semanal (segunda 07:00) | Gera e envia relatório executivo PDF |
| `DisposalSuggestion` | Semanal (quarta 06:00) | Calcula TCO e sugere descartes |
| `CacheRefresh` | A cada 5 min | Atualiza métricas do dashboard |

---

## 10. Componentes Padrão de Barril (Seed)

| Componente | Vida Útil (Ciclos) | Vida Útil (Dias) | Criticidade |
|----|----|----|----|
| Sifão (Tubo Extrator) | 40 | 730 | HIGH |
| O-Ring (Vedação do Sifão) | 15 | 180 | HIGH |
| Válvula Principal (Bocal) | 60 | 1095 | CRITICAL |
| Corpo do Barril (Inox) | 200 | 1825 | CRITICAL |
| Chimb (Base e Alças) | 100 | 1825 | MEDIUM |
| Válvula de Segurança | 50 | 365 | CRITICAL |
