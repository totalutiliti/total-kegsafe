# STRIDE Threat Model -- KegSafe Tech API

## Overview

STRIDE is a threat-modeling framework developed by Microsoft that categorizes security threats into six categories:

| Category | Description |
|---|---|
| **S**poofing | Pretending to be someone or something else |
| **T**ampering | Modifying data or code without authorization |
| **R**epudiation | Denying having performed an action |
| **I**nformation Disclosure | Exposing data to unauthorized parties |
| **D**enial of Service | Making a system unavailable |
| **E**levation of Privilege | Gaining capabilities beyond what is authorized |

### Scope

This analysis covers the KegSafe Tech backend API (`backend/`), a multi-tenant NestJS application for beer keg tracking and predictive maintenance. The system handles tenant-isolated data, JWT-based authentication, role-based access control, and logistics operations for barrel management.

---

## S -- Spoofing

### Threat S1: Stolen or forged JWT access tokens

An attacker obtains or crafts a valid JWT to impersonate a legitimate user, gaining access to tenant resources.

**Current mitigations:**
- JWT tokens are signed with a secret validated at startup (`src/main.ts` lines 13-16) -- production rejects weak secrets matching `/dev|change|secret|fallback/i`
- Access tokens expire after 15 minutes (900 seconds, configured in `src/auth/auth.module.ts`)
- Refresh tokens are hashed with SHA-256 before storage and expire after 7 days (`src/auth/auth.service.ts`)
- Token rotation: old refresh tokens are revoked on use (single-use pattern in `auth.service.ts` `refresh()`)

**Gaps and recommendations:**
- Consider adding `jti` (JWT ID) claims and a server-side token denylist for immediate revocation of compromised access tokens
- Implement audience (`aud`) and issuer (`iss`) claims to prevent cross-service token misuse
- Add refresh token family tracking to detect token reuse (potential theft indicator)

### Threat S2: Credential stuffing and brute-force attacks

An attacker uses leaked credential databases to attempt mass login, or brute-forces a single account.

**Current mitigations:**
- Account lockout after 5 failed attempts for 15 minutes (`src/auth/auth.service.ts` lines 80-91)
- Rate limiting via `ThrottlerModule` at 100 req/60s per IP (`src/app.module.ts`)
- Per-tenant+IP throttling via `TenantThrottlerGuard` (`src/shared/guards/tenant-throttler.guard.ts`)
- Password hashing with Argon2id + application-level pepper via `HashingService` (`src/shared/services/hashing.service.ts`)
- Lazy migration from bcrypt to Argon2id on successful login (`src/auth/auth.service.ts` lines 94-101)

**Gaps and recommendations:**
- Auth endpoints should have stricter rate limits (e.g., 5-10 requests per minute) beyond the global 100/60s
- Consider CAPTCHA or proof-of-work challenge after 3 failed attempts before lockout
- Add monitoring/alerting for distributed brute-force patterns across multiple IPs targeting the same account

### Threat S3: Cookie theft via XSS or network interception

An attacker steals authentication cookies through cross-site scripting or man-in-the-middle attacks.

**Current mitigations:**
- Helmet middleware with strict Content-Security-Policy headers (`src/main.ts` lines 34-57)
- HSTS with preload enabled (max-age 31536000, includeSubDomains)
- Cookie parser configured for httpOnly auth cookies (`src/main.ts` line 60)
- CORS restricted to explicit origins from environment (`src/main.ts` lines 63-76)

**Gaps and recommendations:**
- Verify that all auth cookies are set with `httpOnly: true`, `secure: true`, and `sameSite: 'strict'` flags consistently
- Add `__Host-` prefix to cookies for additional origin binding
- Implement Subresource Integrity (SRI) for any external scripts

---

## T -- Tampering

### Threat T1: Concurrent data modification causing race conditions

Multiple users or requests modify the same barrel simultaneously, leading to lost updates or inconsistent state.

**Current mitigations:**
- Optimistic locking via `version` field on barrel updates -- update fails with `OptimisticLockException` if version mismatch (`src/barrel/barrel.service.ts` `update()` method, lines 351-374)
- Serializable transaction isolation for `internalCode` generation with retry logic (`src/barrel/barrel.service.ts` lines 295-349)
- Status transitions are validated against an explicit allowlist before execution (`VALID_TRANSITIONS` map, lines 27-35)

**Gaps and recommendations:**
- Extend optimistic locking to other critical entities (maintenance orders, component cycles)
- Add idempotency keys for all write endpoints beyond those currently covered by `IdempotencyInterceptor`
- Consider pessimistic locking for multi-step workflows like import execution

### Threat T2: Malicious input injection via API payloads

An attacker sends crafted payloads to inject unexpected data, bypass validation, or alter query behavior.

**Current mitigations:**
- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` (`src/app.module.ts` lines 58-65) -- strips unknown properties and rejects unexpected fields
- DTOs use `class-validator` decorators for input validation
- Prisma ORM provides parameterized queries, preventing SQL injection in standard operations
- Raw queries use `Prisma.sql` tagged template literals with parameterized values (`src/barrel/barrel.service.ts` search queries)

**Gaps and recommendations:**
- Audit all `$queryRaw` usages to confirm no string interpolation of user input
- Add request body size limits to prevent oversized payloads
- Consider adding a schema validation layer for file upload contents (Excel/CSV import)

### Threat T3: CSRF attacks on state-changing endpoints

An attacker tricks an authenticated user's browser into making unwanted requests to the API.

**Current mitigations:**
- Cookie-based auth with `sameSite` cookie attributes
- CORS restricted to explicit allowed origins (`src/main.ts` lines 63-76)
- Custom headers required (`Idempotency-Key`, `X-Request-Id` in allowedHeaders) -- custom header requirement provides implicit CSRF protection

**Gaps and recommendations:**
- Explicitly set `sameSite: 'strict'` or `sameSite: 'lax'` on all authentication cookies
- Consider adding an explicit CSRF token mechanism for cookie-based authentication flows
- Document the CSRF protection strategy so developers understand the implicit protection via custom headers

---

## R -- Repudiation

### Threat R1: Users deny performing critical actions (barrel disposal, status changes)

A user modifies or deletes barrels and later denies the action, causing accountability disputes.

**Current mitigations:**
- `AuditLog` Prisma model records `userId`, `tenantId`, `action`, `entityType`, `entityId`, `oldData`, `newData`, `ipAddress`, and `userAgent` (`src/shared/interceptors/audit.interceptor.ts`)
- Audit decorator (`@Audit()`) can be applied to any controller method for automatic logging
- AuditInterceptor captures request body as `oldData` and response as `newData` for change tracking

**Gaps and recommendations:**
- Ensure the `@Audit()` decorator is consistently applied to all state-changing endpoints (create, update, delete, status change)
- Make audit logs append-only (immutable) at the database level -- consider a separate audit database or write-only permissions
- Add periodic audit log integrity checks (e.g., hash chains) to detect tampering with the logs themselves

### Threat R2: Insufficient request tracing across system boundaries

Without correlated request identifiers, tracing a problematic action back to its origin becomes impossible.

**Current mitigations:**
- `RequestLoggerMiddleware` generates or propagates `X-Request-Id` headers and stores them in CLS context (`src/shared/middleware/request-logger.middleware.ts`)
- Request logs include `requestId`, `method`, `path`, `statusCode`, `duration`, `tenantId`, and `userId`
- Error responses include `traceId` for correlation (`src/shared/filters/http-exception.filter.ts`)

**Gaps and recommendations:**
- Persist request logs to durable storage (not just stdout) with retention policies
- Add structured logging with a correlation ID that spans background jobs (e.g., import processing)
- Implement log aggregation and indexing (e.g., ELK stack or cloud logging service) for effective forensic analysis

### Threat R3: Bulk operations lack per-item attribution

Batch operations like barrel import process many items but may not log each individual change.

**Current mitigations:**
- Import validation and execution are tracked via in-memory sessions with progress reporting (`src/barrel/barrel.service.ts`)
- Errors during chunk processing are captured and reported per chunk

**Gaps and recommendations:**
- Log each successfully imported barrel individually in the audit trail
- Track which user initiated each bulk operation with a persistent job record
- Add a bulk operation history endpoint for administrators to review past imports

---

## I -- Information Disclosure

### Threat I1: Sensitive data leakage through error messages and logs

Stack traces, database errors, or internal details appear in API responses or logs.

**Current mitigations:**
- `GlobalExceptionFilter` sanitizes unhandled exceptions, returning a generic message with only a `traceId` for support reference (`src/shared/filters/http-exception.filter.ts` lines 86-98)
- Stack traces are only included in error-level logs, not in HTTP responses
- Request body sanitization redacts `password`, `passwordHash`, `token`, `refreshToken`, `apiKey`, `secret`, `cpf`, `cnpj` before logging (`http-exception.filter.ts` lines 134-153)

**Gaps and recommendations:**
- Audit all custom exception classes to ensure they do not expose internal details in production
- Add PII redaction for query parameters and URL paths in logs (e.g., barrel QR codes in URLs)
- Ensure Swagger/OpenAPI documentation is disabled in production by default (currently conditional, `src/main.ts` lines 79-82)

### Threat I2: Cross-tenant data exposure

A user in one tenant accesses another tenant's barrels, orders, or configurations.

**Current mitigations:**
- CLS (Continuation-Local Storage) propagates `tenantId` through the request lifecycle (`nestjs-cls` in `SharedModule`)
- All service queries include `tenantId` in their `WHERE` clauses (e.g., `barrel.service.ts`, `maintenance.service.ts`)
- Prisma soft-delete middleware filters `deletedAt: null` globally

**Gaps and recommendations:**
- Implement Prisma middleware or extension that automatically injects `tenantId` filter to prevent developer oversights
- Add integration tests that specifically verify cross-tenant isolation (attempt access with tenant A credentials on tenant B resources)
- Consider Row-Level Security (RLS) at the PostgreSQL level as a defense-in-depth measure

### Threat I3: Excessive data exposure through API responses

API responses return more fields than the consumer needs, potentially exposing sensitive attributes.

**Current mitigations:**
- Prisma `select` and `include` are used to control which fields are returned
- `passwordHash` and other sensitive user fields are not included in login response payloads

**Gaps and recommendations:**
- Implement response serialization with `class-transformer` `@Exclude()` decorators to enforce output filtering
- Audit all endpoints returning user data to ensure `passwordHash`, `failedLoginAttempts`, `lockedUntil` are excluded
- Add API response schemas in Swagger to document expected output shapes

---

## D -- Denial of Service

### Threat D1: API resource exhaustion through request flooding

An attacker sends high volumes of requests to overload the API server.

**Current mitigations:**
- Global rate limiting: 100 requests per 60 seconds per IP via `ThrottlerModule` (`src/app.module.ts` line 38)
- Per-tenant+IP throttling via `TenantThrottlerGuard` combining `tenantId` and IP address (`src/shared/guards/tenant-throttler.guard.ts`)
- Guard chain ensures throttling runs for every request (registered as `APP_GUARD`)

**Gaps and recommendations:**
- Add stricter rate limits for expensive endpoints (search with trigram, Excel export/import)
- Implement request queue or circuit breaker for background processing (import chunks)
- Add health check endpoint monitoring and auto-scaling triggers
- Consider a WAF (Web Application Firewall) or API gateway for DDoS mitigation

### Threat D2: Large payload or file upload abuse

An attacker uploads extremely large files to exhaust memory or disk.

**Current mitigations:**
- Import processing uses chunking (`IMPORT_CHUNK_SIZE = 500`) to bound memory usage (`src/barrel/barrel.service.ts`)
- In-memory import sessions have a 30-minute TTL with automatic cleanup (`cleanExpiredSessions()`)

**Gaps and recommendations:**
- Add explicit file size limits on upload endpoints (e.g., 10MB max)
- Limit the number of concurrent import sessions per tenant
- Add request body size limits at the HTTP server level (e.g., `bodyParser.json({ limit: '1mb' })`)
- Consider streaming file parsing instead of loading entire buffers into memory

### Threat D3: Database resource exhaustion through unbounded queries

Queries without pagination or limits return massive result sets, causing memory spikes and slow responses.

**Current mitigations:**
- All list endpoints implement pagination with configurable `page` and `limit` parameters
- Default page size of 20 records, timeline limited to 50 records (`src/barrel/barrel.service.ts`)
- Database queries use `skip` and `take` (Prisma) for efficient pagination

**Gaps and recommendations:**
- Enforce a maximum `limit` value (e.g., 100) to prevent clients from requesting excessive page sizes
- Add query timeout at the database connection level
- Monitor slow queries and add database connection pool limits
- Consider cursor-based pagination for large datasets to improve performance

---

## E -- Elevation of Privilege

### Threat E1: Bypassing role-based access controls

An attacker exploits misconfigured or missing role checks to access admin-only functionality.

**Current mitigations:**
- Deny-by-default RBAC: `RolesGuard` returns `false` when no roles are specified on an endpoint (`src/auth/guards/roles.guard.ts` lines 27-29)
- Guard chain enforced globally: `JwtAuthGuard` -> `RolesGuard` -> `TenantThrottlerGuard` (`src/app.module.ts` lines 66-68)
- `@Roles()` decorator required on every non-public endpoint
- `@Public()` decorator explicitly marks unauthenticated endpoints

**Gaps and recommendations:**
- Add automated tests that verify every controller endpoint has appropriate `@Roles()` or `@Public()` decorators
- Implement a "least privilege" audit: review all endpoints to confirm minimal required role
- Add route-level integration tests asserting that lower-privilege roles receive 403 responses

### Threat E2: Tenant context manipulation

An attacker modifies the tenant context to access resources belonging to another tenant.

**Current mitigations:**
- Tenant ID is derived from the JWT payload (server-signed, not client-controlled) in `JwtPayload` (`src/auth/auth.service.ts`)
- CLS context propagation ensures tenant ID is consistent throughout the request lifecycle
- Tenant active status is checked during login and token refresh (`auth.service.ts` lines 58-60, 166-168)

**Gaps and recommendations:**
- Add middleware or guard that validates the JWT `tenantId` matches the target resource's `tenantId` on every request
- Ensure tenant ID cannot be overridden via request headers, query parameters, or body
- Add automated tests attempting cross-tenant access via manipulated tokens

### Threat E3: Privilege escalation through JWT claim manipulation

An attacker modifies the role claim in their JWT to gain higher privileges.

**Current mitigations:**
- JWT tokens are signed with HMAC (the secret is validated for strength in production)
- Role is read from the signed JWT payload, not from request headers or body
- Account status (active/locked) is verified on token refresh

**Gaps and recommendations:**
- Consider moving to RS256 (asymmetric signing) to limit token creation to the auth service only
- Add role change invalidation: when an admin changes a user's role, all existing tokens for that user should be invalidated
- Implement token binding (e.g., to client fingerprint) to limit token portability

---

## Summary Matrix

| Category | Threats | Mitigations in Place | Priority Gaps |
|---|---|---|---|
| Spoofing | JWT theft, credential stuffing, cookie theft | JWT expiry, account lockout, Argon2id, Helmet/HSTS | Token denylist, stricter auth rate limits |
| Tampering | Race conditions, input injection, CSRF | Optimistic locking, ValidationPipe, CORS/sameSite | Extend locking, explicit CSRF tokens |
| Repudiation | Action denial, tracing gaps, bulk ops | AuditLog, RequestLogger, traceId | Append-only logs, per-item audit |
| Info Disclosure | Error leakage, cross-tenant, over-exposure | Exception filter, PII redaction, CLS tenant | Prisma tenant middleware, response serialization |
| DoS | Request flood, large uploads, unbounded queries | ThrottlerGuard, chunked imports, pagination | File size limits, max page size, WAF |
| Elevation | RBAC bypass, tenant manipulation, JWT claims | Deny-by-default, guard chain, signed JWTs | Route-level tests, RS256, token invalidation |
