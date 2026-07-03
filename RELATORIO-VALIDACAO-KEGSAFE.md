# 📋 Relatório de Validação Pré-Produção — KegSafe Tech

> **Projeto:** KegSafe Tech — SaaS multi-tenant de gestão de barris (NestJS 11 + Prisma 7 + PostgreSQL 16 + Next.js 16, deploy Azure App Service)
> **Data:** 2026-07-03
> **Base:** pasta `prompts-validacao` v1.1 (23 prompts) cruzada com o código real
> **Tags do projeto:** `[UNIVERSAL]` `[MULTI-TENANT]` `[SUPER-ADMIN]` `[DADOS-PESSOAIS]` · (NÃO se aplicam: `[SENSÍVEL]` `[MENORES]` `[FINANCEIRO]` `[TRANSFERÊNCIA]` — sem CPF/RG, sem dado de saúde, sem IA externa)
> **Método:** 7 análises paralelas, evidência sempre com `arquivo:linha`.

---

## 🚦 VEREDITO: **NÃO APTO PARA PRODUÇÃO**

Regra de bloqueio da pasta de validação: **qualquer ❌ CRÍTICO = não deploya** até correção. Foram encontrados **4 bloqueadores críticos** + **1 bug que quebra o boot em produção**.

> ⚠️ **Nota importante:** isto é um *review de segurança pré-produção*, o padrão mais rigoroso que existe. Um volume alto de apontamentos aqui é **normal e esperado para um primeiro projeto** — e a base técnica do KegSafe é boa (ver seção "O que já está certo"). Nada aqui é irrecuperável; a maioria das correções é objetiva. Não desanime com a contagem: priorize os 4 críticos, depois os ALTOS.

### 🔴 Os 4 bloqueadores CRÍTICOS

| # | Achado | Onde | Por que bloqueia |
|---|--------|------|------------------|
| **C1** | **Credencial viva + PII versionadas no git** — `backend/api_resp.json` contém um **refresh token real** (128 hex, validade 7 dias), um **JWT assinado** e dados de admin real (`admin@petropolis.com.br`, `tenantId`) | `backend/api_resp.json:2-11` (tracked) · e o `.dockerignore` **não** o exclui, então o token iria para a imagem publicada no ACR | Segredo vazado em repositório = incidente de segurança. Qualquer pessoa com acesso ao repo/imagem assume a sessão. |
| **C2** | **Escrita cross-tenant** — `targetTenantId = dto.tenantId ?? tenantId`; o DTO expõe `tenantId` no body e a rota libera `ADMIN/MANAGER`. Um admin comum injeta o `tenantId` de outro cliente e grava dados sob ele | `barrel.service.ts:1673` · `generate-batch.dto.ts:13-15` · `barrel.controller.ts:198` | Quebra o isolamento que é a promessa central do produto multi-tenant. Vazamento/contaminação de dados entre clientes. |
| **C3** | **Contêineres rodam como root** — nenhum `USER` non-root nos Dockerfiles | `backend/Dockerfile` · `frontend/Dockerfile` (sem `adduser`/`USER`) | Escapou do container = root no host. Padrão inaceitável para produção. |
| **C4** | **Banco exposto à internet** — regra de firewall `0.0.0.0 – 255.255.255.255` (o próprio doc admite "aberto pra internet inteira, problema conhecido") + porta `5432` publicada no compose de produção | `instrucao/deploy-azure.md:165` · `docker-compose.prod.yml:54-55` | PostgreSQL acessível de qualquer IP do mundo. Alvo direto de brute-force/exfiltração. (Config de infra — verificar/corrigir no Portal Azure.) |

### 🟠 Bug que quebra o deploy (não-segurança, mas impede subir)
**`PEPPER_SECRET` está ausente do `deploy-azure.yml`.** O `HashingService` lança erro no boot se o pepper faltar → **o backend não sobe em produção**. Adicionar a variável nas app-settings do deploy.

---

## 📊 Sumário de conformidade por prompt

> Contagem indicativa (após calibração de severidade — ver nota abaixo). `~` = itens de alto valor avaliados, não checklist exaustivo.

| # | Prompt | ❌ CRÍT | ❌ ALTO | ❌ MÉD/BAIXO | Destaque |
|---|--------|:------:|:------:|:-----------:|----------|
| 01 | Senhas e Segredos | 1 | 1 | — | ✅ Argon2id+pepper sólido · ❌ C1 (token no git) |
| 02 | .gitignore / Proteção | 1 | 2 | 5 | ❌ C1 + 7 arquivos soltos versionados, sem gitleaks |
| 03 | LGPD / Dados Pessoais | 0 | 6 | 2 | ❌ Sem endpoints de titular, política, DPA, base legal |
| 04 | Cripto / Dados em Repouso | 0 | 2 | 1 | ✅ Hash forte · ❌ TLS do banco não forçado (MITM) |
| 05 | Autenticação e Login | 0 | 3 | 2 | ✅ Cookies/refresh bons · ❌ reset não invalida sessões |
| 06 | RBAC e Multi-Tenancy | 1 | 3 | — | ❌ C2 + sem RLS (isolamento só app-level) |
| 07 | Variáveis de Ambiente | 0 | 0 | 2 | ✅ Validação Zod no boot · ❌ dois `.env.example` divergentes |
| 08 | Docker Seguro | 1 | 3 | 2 | ❌ C3 (root) + sem prune/chown/Trivy |
| 09 | PostgreSQL Hardening | 1 | 5 | 2 | ❌ C4 (firewall) + sem RLS + role única |
| 10 | Azure (App Service) | 0 | 4 | — | ❌ Sem Managed Identity, segredos literais, ACR admin |
| 11 | CI/CD e Deploy | 0 | 4 | 3 | ❌ Sem gitleaks/Trivy/aprovação prod; migrate no startup |
| 12 | API Security | 0 | 2 | 2 | ✅ Helmet/CORS/ValidationPipe · ❌ sem `trust proxy` |
| 13 | Tratamento de Erros | 0 | 0 | 1 | ✅ Muito bom (filtro global, sanitização) |
| 14 | Upload de Arquivos | 0 | 4 | 3 | ❌ Disco local servido estático → XSS/path-traversal |
| 15 | Logging e Auditoria | 0 | 1 | ~5 | ⚠️ Winston configurado mas **desconectado**; login não é logado |
| 16 | Monitoramento e Alertas | 0 | 1 | ~4 | ✅ Health check · ❌ App Insights ausente, SLO só em memória |
| 17 | Backup e DR | 0 | 1 | 1 | ✅ PITR 7 dias · ❌ uploads sem backup; restore não testado |
| 18 | Resposta a Incidentes | 0 | 2 | 1 | ✅ RUNBOOKS.md · ❌ sem plano de incidente/ANPD |
| 19 | Testes de Segurança | 0 | ~6 | 2 | ✅ Testes de isolamento (leitura)/RBAC · ❌ sem teste de escrita cross-tenant |
| 20 | Frontend Seguro | 0 | 1 | 2 | ✅ CSP/cookies httpOnly · ❌ SW cacheia dados de tenant |
| 21 | Documentação | 0 | 1 | 2 | ✅ Docs ricos · ❌ sem CLAUDE.md |
| 22 | Contrato e SLA | 0 | 3 | 2 | ❌ Sem ToS, Política de Privacidade, DPA (jurídico) |
| 23 | Blindar Git | 0 | 3 | 5 | ❌ Sem hooks de proteção, branch protection, tag prod |
| — | **TOTAL** | **4** | **~55** | **~50** | **NÃO APTO** |

**Nota de calibração de severidade (transparência):** ao consolidar, rebaixei 3 itens que os sub-analistas marcaram como CRÍTICO, para ALTO, por não serem exploráveis diretamente como quebra de dados: (a) `trust proxy` ausente [12] — degrada rate-limit, não vaza dado; (b) ausência de RLS [09] — é defesa-em-profundidade, o vazamento real está isolado no C2; (c) ausência de teste de concorrência [19] — no modelo de filtro inline (não `SET` de sessão) o "pool-leak" clássico não se aplica; o risco real é um `where` esquecido. Mantidos os 4 CRÍTICOs que são exposição/exploração concreta.

---

## 1. Camada de Segurança de Dados

### Prompt 01 — Gestão de Senhas e Segredos
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Hashing Argon2id (não MD5/SHA/bcrypt fraco) | ✅ | `hashing.service.ts:21-26` `argon2.argon2id` | — | — |
| memoryCost ≥ OWASP | ✅ | `hashing.service.ts:23` `memoryCost:65536` (64MB), `timeCost:3` | — | — |
| Pepper aplicado, vindo de env, nunca hardcoded | ✅ | `hashing.service.ts:10-20` lê `PEPPER_SECRET`, lança se ausente | — | — |
| Migração lazy de bcrypt→Argon2 no login | ✅ | `auth.service.ts:64-102` | Forçar reset de contas inativas antes de aposentar bcrypt | — |
| Guard de prod rejeita JWT_SECRET fraco | ✅ | `main.ts:16-21` | — | — |
| **Segredo real versionado no git (JWT + refresh vivo + PII)** | ❌ | `backend/api_resp.json:2-11` | **C1** — remover do tracking, revogar token, purgar histórico, tratar como incidente | **CRÍTICO** |
| Rotação de pepper com versionamento (p1$/p2$) | ❌ | `docs/SECRET-ROTATION-RUNBOOK.md:106-150` troca valor direto + `password_hash=NULL` (reset global) | Implementar peppers versionados OU aceitar formalmente o reset global como política | ALTO |
| Key Vault / Managed Identity | 🔍 | RUNBOOK cita `kv-kegsafe-prod`, mas `deploy-azure.yml:107-122` injeta segredos como App Settings literais | Confirmar decisão KV vs GitHub Secrets | — |

### Prompt 02 — .gitignore e Proteção de Código
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| **`api_resp.json` com segredo/PII real (tracked)** | ❌ | `backend/api_resp.json:2-11` JWT + refresh token + email admin | **C1** (ver acima) | **CRÍTICO** |
| **7 arquivos soltos versionados em backend/** | ❌ | tracked: `api_resp.json`, `prisma_error.txt`, `test_prisma.js`, `check_dupes.sql`, `check_dupes_qr.sql`, `fix_drift.sql`, `migrate_fix.sql` | `git rm --cached` nos 7 + padrões no `.gitignore` | ALTO |
| **`.dockerignore` não exclui arquivos soltos** | ❌ | `backend/.dockerignore:1-5` só node_modules/dist/.env/*.log/.git → token iria p/ imagem no ACR | Expandir `.dockerignore` (`*.json` soltos, `*.sql`, `*.txt`, `test_*.js`) | ALTO |
| `test_prisma.js` (script de debug com query real) | ❌ | `test_prisma.js:12,28` query por `admin@petropolis.com.br` | Remover do tracking | MÉDIO |
| Scripts `.sql` de DDL fora de migrations | ❌ | `fix_drift.sql`, `migrate_fix.sql` | Mover p/ `prisma/migrations` ou remover | MÉDIO |
| gitleaks no pre-commit | ❌ | `.husky/pre-commit:1` só `lint-staged`; grep gitleaks = 0 | Adicionar `gitleaks protect --staged` | MÉDIO |
| `.gitignore` cobre chaves/certs (`*.pem`,`*.key`,…) | ❌ | Ausente | Adicionar bloco de chaves/certs | BAIXO |
| `.gitleaks.toml` na raiz | ❌ | Ausente | Criar do template | BAIXO |
| `.dockerignore` existe (backend+frontend) | ✅ | ambos presentes | — | — |
| GitHub Push Protection / Secret Scanning | 🔍 | Config server-side | Confirmar em Settings > Code security | — |

### Prompt 03 — LGPD e Dados Pessoais
> TotalUtiliti = **Operador**; cervejaria (tenant) = **Controlador**. Sem CPF/RG (só CNPJ = PJ), sem dado sensível/menores.

| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Campos PII identificados + soft delete | ✅ | User/Client email/name/phone; `deletedAt` em User/Client/Tenant; `prisma.service.ts:89` | Documentar geolocalização como dado pessoal | — |
| Pseudonimização de PII em logs | ✅ | `request-logger.middleware.ts:28-36` loga só ids | Remover `maskPII`/`LoggingInterceptor` citados em docs mas inexistentes | — |
| Base legal documentada por dado | ❌ | Só menção genérica `DATA-CLASSIFICATION.md:203` | Documentar base legal por atividade de tratamento | ALTO |
| Direito de acesso do titular (endpoint) | ❌ | Nenhum controller LGPD; `DATA-CLASSIFICATION.md:225` pendente | Implementar `POST /api/lgpd/titular/dados` (RBAC + audit) | ALTO |
| Direito de eliminação/portabilidade | ❌ | Inexistente | Implementar eliminação + exportação JSON/CSV | ALTO |
| Política de Privacidade / Termos publicados | ❌ | Nenhum arquivo | Publicar antes do deploy | ALTO |
| DPA modelo (operador↔controlador) | ❌ | Nenhum | Criar DPA modelo (obrigatório como Operador) | ALTO |
| ROPA (registro de tratamento) | ⚠️ Parcial | `DATA-CLASSIFICATION.md:23-93` inventaria PII mas não é ROPA | Elevar a ROPA completo | ALTO |
| Consentimento / aceite de termos (versão/IP/ts) | ❌ | Sem tabela de aceite | Criar tabela imutável de aceite (se houver base de consentimento) | MÉDIO |
| Retenção / expurgo automatizado | ❌ | Nenhum cron de retenção | Job de retenção/anonimização | MÉDIO |
| DPO / Encarregado indicado | ❌ | `DATA-CLASSIFICATION.md:205` "definir responsável" | Indicar Encarregado + canal do titular | MÉDIO |

### Prompt 04 — Criptografia e Dados em Repouso
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Senhas hash forte + pepper dedicado | ✅ | `hashing.service.ts:19-27` Argon2id 65536/3 | — | — |
| HTTPS / HSTS na app | ✅ | `main.ts:44-67` HSTS 1 ano | Garantir `httpsOnly` na infra | — |
| SSE/TDE PostgreSQL (repouso) | ✅ | Azure Flexible = AES-256 SSE sempre; `DATA-CLASSIFICATION.md:222` | Guardar evidência `az` | — |
| **TLS na conexão do banco (sslmode)** | ❌ | `prisma.service.ts:8` Pool sem `ssl`; `.env.example:3` sem `sslmode`; `env.validation.ts:9` não exige | Forçar `sslmode=require` + validar no boot | ALTO |
| **`rejectUnauthorized` desabilitado (MITM)** | ❌ | `instrucao/deploy-azure.md:86` `ssl:{rejectUnauthorized:false}` | Usar CA do Azure + `rejectUnauthorized:true` | ALTO |
| Cripto do disco de uploads local | ❌ | `disposal.service.ts:312-323` grava `process.cwd()/uploads` fora de cripto gerenciada | Migrar p/ Blob (SSE cobre) — ver Prompt 14 | MÉDIO |
| `password_encryption=scram-sha-256` / backup criptografado | 🔍 | Parâmetros de servidor | Confirmar via `az` | — |

---

## 2. Autenticação e Autorização

### Prompt 05 — Autenticação e Login
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Mensagem genérica em falha (sem enumeração) | ✅ | `auth.service.ts:45,92` mesma `InvalidCredentialsException` | — | — |
| Access token curto + refresh 7d hasheado com rotação | ✅ | `auth.module.ts:24` 900s; `auth.service.ts:255-277` randomBytes(64)+SHA-256; `refresh()` revoga o antigo | — | — |
| Cookies httpOnly + sameSite=strict + secure condicional | ✅ | `auth.controller.ts:27-30,64-75` | — | — |
| Rate limit no login (5/min) + lockout 15min | ✅ | `auth.controller.ts:48`; `auth.service.ts:82-91` | — | — |
| tenant_id vem do JWT, não do body | ✅ | `jwt.strategy.ts:42-63` | — | — |
| **Reuso de refresh token não invalida todas as sessões** | ❌ | `auth.service.ts:155-181` só lança `TokenExpiredException` | Ao detectar refresh revogado, revogar todos do `userId` | ALTO |
| **Recuperação de senha self-service ausente** | ❌ | Sem `forgot/reset-password`; só reset admin (`super-admin.controller.ts:104`) | Fluxo por e-mail com token single-use 1h + invalidação de sessões | ALTO |
| **Troca/reset de senha não revoga sessões ativas** | ❌ | `super-admin.service.ts:324-328`, `auth.service.ts:246-250` atualizam hash mas não revogam refresh tokens | `refreshToken.updateMany({where:{userId},data:{revoked:true}})` | ALTO |
| Lockout só por e-mail (sem limiter por IP → DoS de conta) | ❌ | `auth.service.ts:82-91` | Limiter por IP (depende de `trust proxy`) + escalonamento | MÉDIO |
| Audit de login/logout/falhas | ❌ | `AuthController` tem `@SkipAudit()` (`auth.controller.ts:34`); nenhum log | Registrar LOGIN_SUCESSO/FALHA/BLOQUEIO/LOGOUT com IP+UA | MÉDIO |
| MFA/TOTP | ⚠️ N/A | Ausente; §6 classifica como recomendado | Avaliar TOTP p/ ADMIN/SUPER_ADMIN | — |

### Prompt 06 — RBAC e Multi-Tenancy
> **Veredito central:** isolamento é **app-level** (`where:{ tenantId }` inline por query, `tenantId` do JWT via CLS). **Sem RLS no PostgreSQL** (zero `CREATE POLICY`/`set_config` nas 13 migrations), **sem Prisma middleware/$extends** (Prisma 7 removeu `$use`/`$extends`). O helper `withTenantFilter()` é **código morto** (0 usos). Isolamento depende 100% da disciplina do dev, fail-open.

| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Guard global AuthGuard + RolesGuard (deny-by-default) | ✅ | `app.module.ts:76-78` APP_GUARD; `roles.guard.ts:27-29` nega sem `@Roles` | — | — |
| RolesGuard `getAllAndOverride` (handler+classe) + respeita `@Public()` (achado C4 do runbook resolvido) | ✅ | `roles.guard.ts:15-24`; `jwt-auth.guard.ts:15-22` | — | — |
| IDOR em update/delete validado contra tenant | ✅ | `barrel.service.ts:262-266` `findById(tenantId,id)` filtra `{id,tenantId,deletedAt:null}` (padrão em todos os módulos) | — | — |
| Super Admin bypassa filtro de forma controlada e **auditada** | ✅ | `super-admin.service.ts` cross-tenant por design; toda ação → `SuperAdminAuditLog` (`:691`) | — | — |
| **`tenant_id` aceito do body (escrita cross-tenant)** | ❌ | `barrel.service.ts:1673` `dto.tenantId ?? tenantId`; `generate-batch.dto.ts:13-15`; rota `barrel.controller.ts:198` `@Roles(ADMIN,MANAGER,SUPER_ADMIN)` | **C2** — remover `tenantId` do DTO e restringir a `SUPER_ADMIN`, ou `if(dto.tenantId && role!==SUPER_ADMIN) throw` | **CRÍTICO** |
| **RLS habilitado + `FORCE ROW LEVEL SECURITY`** | ❌ | 0 policies nas migrations | Habilitar RLS + policy `USING/WITH CHECK current_setting('app.tenant_id',true)` nas ~15 tabelas OU aceitar formalmente app-level com lint anti-vazamento | ALTO |
| Contexto de tenant via `set_config(...,true)` na transação | ❌ | `prisma.service.ts:8-19` pool puro; CLS setado mas só consumido por audit/logger | Interceptor por request se adotar RLS | ALTO |
| Audit log append-only garantido no banco | ⚠️ | Convenção da app; nada impede UPDATE/DELETE | `REVOKE UPDATE,DELETE` em `audit_logs` p/ app_user | ALTO |

### Prompt 07 — Variáveis de Ambiente
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| **Validação Zod no boot** (app não sobe sem vars críticas) | ✅ | `config/env.validation.ts:7-58`; `app.module.ts:36-40` | — | — |
| Vars críticas validadas (DATABASE_URL, JWT_SECRET.min(32), PEPPER_SECRET.min(32)) | ✅ | `env.validation.ts:9-24` | — | — |
| `.env` fora do git, `.env.example` documentado | ✅ | só `.env.example` tracked | — | — |
| **Dois `.env.example` divergentes** (raiz vs backend) | ❌ | raiz usa `JWT_EXPIRES_IN`/SENDGRID/FIREBASE; backend usa `JWT_EXPIRATION`/`PEPPER_SECRET` | Consolidar; raiz não reflete o schema Zod real | MÉDIO |
| `JWT_REFRESH_SECRET` documentado obrigatório mas `.optional()` e não usado | ❌ | `env.validation.ts:18`; refresh usa `randomBytes` | Remover a var ou implementar assinatura | BAIXO |

---

## 3. Infraestrutura e Deploy

### Prompt 08 — Docker Seguro
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Multi-stage + base alpine pinada + NODE_ENV=production | ✅ | `backend/Dockerfile:7,17,27,30`; `frontend` idem | Pinar por digest seria ideal | — |
| Prisma generate no build; não copia `.env` | ✅ | `backend/Dockerfile:23`; `.dockerignore` exclui `.env` | — | — |
| **Usuário non-root** | ❌ | Nenhum `USER`/`adduser` — ambos rodam como **root** | **C3** — criar user + `USER` no runner | **CRÍTICO** |
| Prune de devDependencies no runtime | ❌ | `backend/Dockerfile:34` copia node_modules inteiro | Stage `npm ci --omit=dev` | ALTO |
| `COPY --chown` p/ usuário da app | ❌ | Todos COPY sem `--chown` | Adicionar após criar non-root | ALTO |
| Scan Trivy antes do push | ❌ | `deploy-azure.yml:52-59` push sem scan | `trivy image --exit-code 1 --severity CRITICAL` | ALTO |
| HEALTHCHECK no Dockerfile | ❌ | Ausente; endpoint `/health` existe | Adicionar HEALTHCHECK | MÉDIO |
| docker-compose dev sem senha hardcoded | ❌ | `docker-compose.yml:9-11` postgres/postgres | Mover p/ `.env` (baixo — é dev) | BAIXO |

### Prompt 09 — PostgreSQL Hardening
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Backup automático / PITR | ✅ | `docs/INFRASTRUCTURE.md:120` 7 dias PITR | Confirmar retenção/geo-redundância | — |
| **Firewall sem `0.0.0.0/0` + não publicar 5432** | ❌ | `instrucao/deploy-azure.md:165` range aberto; `docker-compose.prod.yml:54-55` expõe 5432 | **C4** — Private Endpoint/VNet; remover regra aberta e a porta pública | **CRÍTICO** |
| RLS + `FORCE ROW LEVEL SECURITY` em tabelas tenant | ❌ | 0 `ROW LEVEL SECURITY` nas migrations; schema:27 afirma "RLS" falsamente | Habilitar RLS (defesa-em-profundidade do C2) | ALTO |
| DUAS roles (migrations owner ≠ app DML) | ❌ | `prisma.service.ts:8` role única; `backend/Dockerfile:44` migrate com a mesma string | Criar `app_migrations` + `app_user` | ALTO |
| App user não-superuser | 🔍→ALTO | `instrucao/deploy-azure.md:69` conecta como `kegsafe_admin` (nome de owner) | Confirmar/criar `app_user` mínimo | ALTO |
| `sslmode=require` na URL de produção | ❌ | Docs usam, mas scripts usam `rejectUnauthorized:false` | `sslmode=require`/`verify-full` + CA | ALTO |
| Contexto tenant via `set_config(...,true)` | ❌ | grep `set_config`=0 | Vem com RLS | ALTO |
| `ALTER DEFAULT PRIVILEGES` / `REVOKE CREATE ON SCHEMA public` | ❌ | 0 nas migrations | Adicionar (decorre da separação de roles) | MÉDIO |
| `require_secure_transport`/`password_encryption`/`log_*` | 🔍 | Parâmetros de servidor | `az ... parameter show` | MÉDIO |
| Connection pooling/PgBouncer | ⚠️ | `pg.Pool` sem `connection_limit`; `docs/ARCHITECTURE-AUDIT.md:128` pendência | Definir `connection_limit`; avaliar PgBouncer | MÉDIO |

### Prompt 10 — Azure (deploy real = App Service, não ACA)
> Comandos ACA do prompt são N/A; os conceitos (HTTPS, MI, Key Vault, probes) valem.

| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| HTTPS only comprovado | ❌ | `httpsOnly` não ligado explicitamente | `az webapp update --https-only true` | ALTO |
| Managed Identity | ❌ | SP JSON (`deploy-azure.yml:99`) + ACR admin (`:49-50`) | Habilitar system-assigned MI + OIDC no CI | ALTO |
| Segredos via Key Vault reference | ❌ | `deploy-azure.yml:112-121` app-settings literais | `@Microsoft.KeyVault(...)` p/ todos os segredos | ALTO |
| ACR pull via MI (não admin) | ❌ | `deploy-azure.yml:48-50,73-75` admin creds | Desabilitar admin do ACR; `AcrPull` à MI | ALTO |
| Health probe → `/health` | ⚠️→MÉDIO | `/health` existe (`health.controller.ts:21`) mas sem probe configurado | Configurar health-check-path | MÉDIO |
| CORS explícito (não `*`) / resource limits / custom domain | 🔍 | `CORS_ORIGINS` env; plan/domínio fora do repo | Confirmar allowlist e limites | — |
| Consistência do alvo de hospedagem entre docs | ❌ | prod = App Service (`INFRASTRUCTURE.md`, `ADR-003`) vs dev = **Container Apps** (`instrucao/deploy-azure.md:15-27`) — recovery em `DISASTER-RECOVERY.md` usa `az webapp` que não valeria p/ ACA | Alinhar docs; padronizar o alvo por ambiente | MÉDIO |

### Prompt 11 — CI/CD e Deploy Seguro
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Lint + testes no pipeline | ✅ | `ci.yml:61-62,70-74` | — | — |
| Logs de deploy sem segredos | ✅ | via `${{ secrets.* }}` mascarados | — | — |
| gitleaks (scan de segredos) no CI | ❌ | 0 no repo | `gitleaks-action` como gate (hook é pulável com `--no-verify`) | ALTO |
| Trivy (scan de imagem) | ❌ | push sem scan | Trivy pós-build/pré-push | ALTO |
| Deploy order: migrate gated antes do deploy | ❌ | migrate roda no startup do container (`backend/Dockerfile:44`), não gated; sem health pós-deploy | Extrair `migrate deploy` p/ step de CI; remover do CMD | ALTO |
| Aprovação manual p/ produção | ❌ | `deploy-azure.yml:27-29` auto em push main, sem environment protection | GitHub Environment `production` com required reviewers | ALTO |
| npm audit | ❌ | só em doc | `npm audit --audit-level=high` no CI | MÉDIO |
| Rollback documentado | ❌ | usa `:latest` além do SHA | Automatizar rollback p/ SHA anterior | MÉDIO |
| Health check pós-deploy (smoke) | ❌ | ausente | `curl -f .../health` com falha do job | MÉDIO |
| **Migrations DESSINCRONIZADAS do schema (drift confirmado em runtime)** | ❌ | Rodando `prisma migrate deploy` (CMD do `backend/Dockerfile:44`), a coluna `barrels.chassisNumber` + o unique `[tenantId,chassisNumber]` **não são criados** — confirmado no Docker: o seed quebrou com `P2022 ColumnNotFound` e só passou após `prisma db push`. Em produção, qualquer query de barril daria **500**. `README.md:114` ainda instrui `db push` | Gerar a migration faltante (`prisma migrate dev`), commitar e usar só `migrate deploy` em prod | ALTO |

---

## 4. Aplicação e API

### Prompt 12 — API Security
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Helmet (HSTS+CSP) + CORS explícito + falha boot se ausente | ✅ | `main.ts:44-86`, `:22-27` | — | — |
| **ValidationPipe global** (whitelist+forbidNonWhitelisted+transform) | ✅ | `app.module.ts:67-75` APP_PIPE | — | — |
| Rate limit global + por rota + tracker por tenant:ip | ✅ | `app.module.ts:43`; `tenant-throttler.guard.ts:11-13` | — | — |
| Error handler global sem stack ao cliente; queries parametrizadas | ✅ | `GlobalExceptionFilter`; Prisma | — | — |
| **`trust proxy` ausente** (atrás do App Service, `req.ip` = IP do proxy) | ❌ | grep sem match; `main.ts` não chama | `app.getHttpAdapter().getInstance().set('trust proxy',1)` | ALTO |
| Throttler colapsa cota de anônimos (login) sem trust proxy | ❌ | `tenant-throttler.guard.ts` `tenantId='anonymous'` | Corrige junto com trust proxy | ALTO |
| Timeout global (30s) | ❌ | ausente | `connect-timeout` + rotas pesadas (relatórios/Excel) | MÉDIO |
| Request size limit explícito | ❌ | default 100kb | `express.json({limit})` + limite por upload | BAIXO |

### Prompt 13 — Tratamento de Erros
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Exception filter global; sem stack ao usuário; 5xx genérico | ✅ | `shared.module.ts:26-27`; `http-exception.filter.ts:86-100` | — | — |
| Body sensível sanitizado nos logs; traceId em toda resposta | ✅ | `sanitizeBody:134-153`; `:31-35` | (sanitização é rasa/1 nível — melhorar) | — |
| Graceful shutdown sem double-close | ✅ | `main.ts:41` `enableShutdownHooks()`; sem SIGTERM manual | — | — |
| Pool `pg` fechado no shutdown | ❌ | `prisma.service.ts` `$disconnect()` mas nunca `pool.end()` | `await pool.end()` no shutdown | BAIXO |

### Prompt 14 — Upload e Processamento de Arquivos
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Limite de tamanho + organização por tenant | ✅ | `disposal.controller.ts:108` 5MB; path inclui `tenantId` | — | — |
| Não executa uploads | ✅ | sem eval/exec | — | — |
| **Validação por magic bytes (conteúdo, não Content-Type)** | ❌ | sem `fileTypeFromBuffer`; `disposal.service.ts:305-323` grava buffer sem inspecionar | Validar magic bytes antes de gravar | ALTO |
| **Armazenamento em Blob (não filesystem local efêmero)** | ❌ | `disposal.service.ts:312-323` grava `process.cwd()/uploads`; sem `@azure/storage-blob` | Migrar p/ Azure Blob (disco do container = perda de dados) | ALTO |
| **Uploads servidos estáticos → stored XSS** | ❌ | `main.ts:35` `useStaticAssets(uploads)` público sem validação → HTML/SVG malicioso sob domínio da API | Endpoint autenticado com `Content-Disposition:attachment`, ou Blob+SAS | ALTO |
| Path traversal sanitizado | ⚠️→ALTO | `@Param('id')` cru concatenado em filePath (`disposal.service.ts:321-322`); ext de `originalname` | Validar id UUID + allowlist de extensão | ALTO |
| Validação de MIME declarado (pré-filtro) | ❌ | `FileInterceptor` sem `fileFilter` (`disposal.controller.ts:107-109`) | Adicionar `fileFilter` allowlist | MÉDIO |
| Retenção/expurgo de imagens | ❌ | `disposal.service.ts:323` permanente | Definir prazo + job | MÉDIO |
| Scan antivírus | ❌ | sem ClamAV/Defender | Integrar (recomendado) | BAIXO |

---

## 5. Observabilidade e Operação

### Prompt 15 — Logging e Auditoria
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Correlação por request id (CLS + middleware) | ✅ | `request-logger.middleware.ts:18-21`; `shared.module.ts:15-18` | — | — |
| `AuditLog`/`SuperAdminAuditLog` imutáveis (write-only na prática) | ✅ | `schema.prisma:1272,1324`; sem update/delete no código | `REVOKE UPDATE,DELETE` reforçaria no banco | — |
| Auditoria por interceptor global (mutações) | ✅ | `shared.module.ts:29-32`; `audit.interceptor.ts:130` | — | — |
| **Winston/StructuredLogger configurado mas DESCONECTADO** | ❌ | `logger.service.ts:20-38` nunca injetado; sistema usa `Logger` nativo (texto simples, sem JSON/mascaramento) | Ligar via `app.useLogger(...)` ou `nest-winston` (hoje é dep morta) | ALTO |
| Login/logout/falha **não são logados nem auditados** | ❌ | `auth.service.ts` sem `Logger`; `AuthController` `@SkipAudit()` (`:34`) | Logar/auditar eventos de auth com IP+UA | MÉDIO |
| Mascaramento de PII no fluxo ativo | ⚠️ | `sanitize()` completo está no código morto; ativo é só `sanitizeBody` (raso, 1 nível, sem headers) | Aplicar mascaramento recursivo no logger ativo | MÉDIO |
| Endpoint de consulta a `AuditLog` (tenant) | ❌ | nenhum controller lê `auditLog.findMany` | Expor consulta ao ADMIN do tenant | MÉDIO |
| Retenção/TTL dos audit logs | ❌ | sem cron; crescem indefinidamente | Job de arquivamento/purge com política | BAIXO |

### Prompt 16 — Monitoramento e Alertas
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Health check com ping real ao banco (terminus) | ✅ | `health.controller.ts:11-27` `GET /api/v1/health` público | — | — |
| SLO instrumentado (P50/P95/P99, error budget) | ✅ | `shared/slo/*` interceptor global; alvo 99.5%/500ms | — | — |
| **Application Insights ausente no código** | ❌ | sem dependência/import/init (só placeholder no `.env.example` raiz) | Integrar App Insights ou Prometheus (o próprio SLO admite migração pendente) | ALTO |
| Métricas SLO só em memória (perdidas no restart) | ❌ | `slo.service.ts:3-4` nota explícita | Persistir/exportar | MÉDIO |
| Alertas (5xx/uptime/budget/CPU) como código | ❌ | sem Bicep/ARM; só docs em `RUNBOOKS.md` | Definir Action Groups/alertas (IaC ou Portal) | MÉDIO |
| Error budget baixo só emite `logger.warn` (não alerta) | ❌ | `slo.service.ts:119-137` | Ligar a alerta real | MÉDIO |
| Liveness vs readiness separados | ❌ | endpoint único combinado | Separar `/health/live` e `/health/ready` | BAIXO |

### Prompt 17 — Backup e Disaster Recovery
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Backup PostgreSQL / PITR documentado | ✅ | `docs/INFRASTRUCTURE.md:120` + `DISASTER-RECOVERY.md:27-31` 7 dias PITR (Flexible Server) | Confirmar retenção/geo real no Azure (não há IaC) | — |
| Plano de DR + runbooks + níveis SEV | ✅ | `docs/DISASTER-RECOVERY.md` (369 l., cenários + SEV-1..4) + `docs/RUNBOOKS.md` (602 l.) | — | — |
| **DR internamente CONTRADITÓRIO (RPO/RTO e estratégia)** | ❌ | `DISASTER-RECOVERY.md:15-16` RPO 5min/RTO 30min vs `ARCHITECTURE.md:473-474` RPO 15min/RTO 4h + backup em camadas até 5 anos/GRS — nenhum marcado como vigente | Eleger fonte-de-verdade única e arquivar/corrigir o outro | MÉDIO |
| **Backup dos uploads (fotos em disco efêmero)** | ❌ | uploads no disco do container (`disposal.service.ts:312`) sem backup | Migrar p/ Blob (backup/versionamento) | ALTO |
| **Teste de restore executado** | ❌ | só calendários propostos com checklists desmarcados (`DISASTER-RECOVERY.md:333-353`); zero execuções | Executar 1 restore PITR real e documentar antes de produção | MÉDIO |
| Backup/DR em IaC versionado | ❌ | 0 `.bicep`/`.tf`/ARM; tudo provisionado manualmente | Versionar infra (retenção, geo) como IaC | BAIXO |

### Prompt 18 — Plano de Resposta a Incidentes
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Runbooks operacionais | ✅ | `docs/RUNBOOKS.md` substancial (banco, container, cert, escala) | — | — |
| Runbook de rotação de segredos + checklist de vazamento | ✅ Parcial | `docs/SECRET-ROTATION-RUNBOOK.md:333-348` "Checklist de Emergência (Vazamento de Secret)" cobre rotacionar/revogar/analisar audit — **use já para o C1** | Estender p/ vazamento no git (BFG/git-filter-repo, scan de histórico) | — |
| **Plano de resposta a incidente de segurança (acesso indevido, cliente reportando)** | ❌ | só o checklist de secret acima; sem playbook p/ acesso indevido/breach de dados | Criar playbook (detecção→contenção→erradicação→recuperação→post-mortem) | ALTO |
| **Notificação LGPD/ANPD (prazo, template, titulares)** | ❌ | não encontrado; e o C1 já é um incidente reportável | Criar procedimento de notificação ANPD/titular | ALTO |
| Template de post-mortem + contatos de emergência | ❌ | não encontrado | Criar template e lista de escalonamento | BAIXO |

---

## 6. Qualidade e Maturidade

### Prompt 19 — Testes de Segurança
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Sem token → 401; token inválido → 401 | ✅ | `rbac.integration-spec.ts:253-264`; `app.e2e-spec.ts:171-190` | — | — |
| RBAC: cada role só acessa o que deve (403) | ✅ | `rbac.integration-spec.ts:152-192,207-245` | — | — |
| Isolamento cross-tenant — LEITURA + acesso por ID (IDOR→404) | ✅ | `tenant-isolation.integration-spec.ts:89-127` | — | — |
| Input: campos extras rejeitados (forbidNonWhitelisted) | ✅ | `app.e2e-spec.ts:140-149` | — | — |
| **Teste de ESCRITA cross-tenant (PUT/PATCH/DELETE → 403/404)** | ❌ | só há GET no spec de isolamento | Adicionar — pegaria o C2 | ALTO |
| Teste de isolamento sob CONCORRÊNCIA | ❌ | testes sequenciais | Adicionar `Promise.all` A/B (menos crítico no modelo inline, mas recomendado) | ALTO |
| Teste de lockout após N tentativas | ❌ | lockout existe no código, sem teste | Escrever teste | ALTO |
| Teste de mensagem genérica (sem enumeração) | ❌ | código OK, sem teste | Comparar body das 2 respostas | ALTO |
| Teste deny-by-default (autenticado + rota sem `@Roles` → 403) | ❌ | não exercitado | Adicionar | MÉDIO |
| Teste de SQLi (payload literal → 200 + vazio) | ❌ | código usa raw parametrizado, sem teste | Adicionar `?search=' OR 1=1 --` | MÉDIO |
| Testes rodam no CI | 🔍 | `jest-integration.json` existe | Confirmar `ci.yml` roda `test:integration` | — |

### Prompt 20 — Frontend Seguro
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Token NÃO em localStorage (cookies httpOnly pelo backend) | ✅ | `lib/auth-store.ts:36-56`; `lib/api.ts:8` `withCredentials` | — | — |
| CSP + security headers do Next corretamente ligados | ✅ | `next.config.ts:4-46` `headers()` + CSP + X-Frame DENY | — | — |
| Sem `dangerouslySetInnerHTML`; sem API key exposta | ✅ | busca global vazia; só `NEXT_PUBLIC_API_URL` | — | — |
| **Service Worker cacheia dados de tenant sem segregação** | ❌ | `sw.js:53-57,99-134` cacheia `/api/v1/(barrels\|clients)` por URL, TTL 1h, sem tenant/user; logout não limpa cache | Excluir APIs de negócio do cache OU incluir identidade na chave OU `caches.delete()` no logout | ALTO |
| Token residual em localStorage p/ download de CSV (código morto) | ❌ | `reports/page.tsx:87-93` `localStorage.getItem('token')` + `?token=` | Remover; usar client `api` com `withCredentials` | MÉDIO |
| `compiler.removeConsole` em produção | ❌ | ausente no `next.config.ts` | Adicionar `removeConsole:{exclude:['error','warn']}` | BAIXO |

### Prompt 21 — Documentação e Onboarding
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| README completo + Swagger + RUNBOOKS + docs ricos | ✅ | `README.md` (295 l.); `main.ts:109`; `ARCHITECTURE.md` (1322 l.), `CRITICAL_FLOWS.md`, `PRD.md`, `STRIDE-THREAT-MODEL.md` | — | — |
| **CLAUDE.md na raiz** | ❌ | não existe em nenhum nível | Criar com contexto, convenções, decisões, referência à pasta de validação | ALTO |
| Changelog mantido | ❌ | nenhum `CHANGELOG*` | Criar (commits já seguem convenção) | BAIXO |
| Credenciais no README desatualizadas (`@petropolis` vs `@kegsafe`) | ❌ | `README.md:138-141` | Atualizar p/ `@kegsafe.com.br` | BAIXO |

### Prompt 22 — Contrato e SLA
> SaaS externo + dados pessoais → DPA é **obrigatório**. Itens jurídicos: severidade de negócio/compliance, não vulnerabilidade técnica. **Exigem advogado.**

| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Termos de Uso | ❌ | nenhum arquivo | Redigir (com revisão jurídica) | ALTO |
| Política de Privacidade | ❌ | nenhuma página/rota | Publicar + registrar aceite (LGPD Art. 9º) | ALTO |
| DPA (processamento de dados) | ❌ | nenhum modelo | Criar (subprocessador Azure Brazil South) | ALTO |
| SLA (uptime/suporte/RPO-RTO) | ❌ | nenhum documento comercial | Formalizar (reusar `DISASTER-RECOVERY.md`) | MÉDIO |
| Resumo de segurança comercial (1 pág.) | ❌ | inexistente | Criar a partir dos controles já implementados | BAIXO |

### Prompt 23 — Blindar Git Contra Regressão
| Item | Status | Evidência | Ação | Severidade |
|------|--------|-----------|------|------------|
| Deploy dispara só em `main` | ✅ | `deploy-azure.yml:27-30` | — | — |
| Hooks Git (pre-commit + pre-push) de proteção | ❌ | só `lint-staged`; sem bloqueio de `.env`/`db push`/DROP (prova: C1 passou) | Adicionar guardas ao husky | ALTO |
| CI como 2ª barreira de segredos (gitleaks) | ❌ | `ci.yml` sem gitleaks | Adicionar job (hooks são puláveis com `--no-verify`) | ALTO |
| Regras de dados destrutivos Prisma (bloqueio em prod) | ❌ | sem CLAUDE.md/hook | Documentar + guarda | ALTO |
| Branch protection na `main` | 🔍 | server-side | Confirmar em Settings > Branches | MÉDIO |
| Workflow `anti-regression.yml` + tag `prod-*` pós-deploy | ❌ | só ci/deploy; usa `:latest`/`:sha` | Criar workflow + step de tag | MÉDIO |
| CLAUDE.md + runbook de deploy com gates | ❌ | ausentes | Criar | MÉDIO |

---

## ✅ O que já está certo (a base é boa)

Para um primeiro projeto, há decisões de segurança acima da média que **devem ser preservadas**:

- **Hashing de senha exemplar:** Argon2id + pepper (`memoryCost:65536`), com migração transparente de bcrypt no login (`hashing.service.ts`, `auth.service.ts:64-102`).
- **Validação de ambiente no boot com Zod** — o app não sobe sem as variáveis críticas (`config/env.validation.ts`).
- **Guardas globais deny-by-default** corretos: `RolesGuard` com `getAllAndOverride` respeitando `@Public()` — exatamente o padrão que o runbook exige (achado C4 do runbook já resolvido).
- **`ValidationPipe` global** com `whitelist`+`forbidNonWhitelisted` (`app.module.ts:67-75`).
- **Helmet (CSP+HSTS)**, CORS por allowlist de env, e verificação que rejeita `JWT_SECRET` fraco em produção (`main.ts`).
- **Cookies httpOnly + sameSite=strict**, refresh tokens opacos hasheados com rotação (`auth.controller.ts`, `auth.service.ts:255-277`).
- **Filtro de exceção global** com sanitização de body e sem stack trace ao cliente (`http-exception.filter.ts`).
- **Proteção contra IDOR em update/delete** via `findById(tenantId, id)` em todos os módulos.
- **Auditoria de ações de super-admin** (`SuperAdminAuditLog`), correlação por request id (CLS), SLO instrumentado, health check com ping real ao banco.
- **Frontend:** CSP corretamente ligado no `next.config.ts`, sem `dangerouslySetInnerHTML`, token fora do localStorage.
- **Testes de isolamento (leitura) e RBAC** existem e passam; docs muito ricos (ARCHITECTURE 1322 linhas, STRIDE, RUNBOOKS, DATA-CLASSIFICATION).

---

## 🛠️ Ordem de correção recomendada

**Fase 0 — Incidente (agora):**
1. Tratar **C1** como vazamento: `git rm --cached backend/api_resp.json` (+ os outros 6 soltos), revogar o refresh token vazado no banco, e **purgar do histórico** (git-filter-repo/BFG). Adicionar padrões ao `.gitignore` e `.dockerignore`.

**Fase 1 — Bloqueadores CRÍTICOS (antes de qualquer deploy):**
2. **C2:** remover `tenantId` do `GenerateBatchDto` e restringir a rota a `SUPER_ADMIN`.
3. **C3:** adicionar usuário non-root nos dois Dockerfiles.
4. **C4:** fechar o firewall do PostgreSQL (Private Endpoint/VNet) e remover a porta 5432 do compose de produção.
5. Adicionar `PEPPER_SECRET` ao `deploy-azure.yml` (senão o app não sobe).

**Fase 2 — ALTOS (antes de clientes reais):** `trust proxy` + gitleaks (hook e CI) + RLS/defesa-em-profundidade + sessões revogadas no reset de senha + upload em Blob com validação de magic bytes + cache do Service Worker segregado por tenant + Managed Identity/Key Vault + aprovação manual de deploy + LGPD (política, DPA, endpoints de titular) + testes de escrita cross-tenant.

**Fase 3 — MÉDIOS/BAIXOS:** logger Winston conectado, timeouts, healthcheck no Dockerfile, CLAUDE.md, changelog, etc.

---

> **Resumo:** projeto **NÃO APTO** por 4 críticos exploráveis/expostos, todos corrigíveis pontualmente. A arquitetura de segurança está bem encaminhada — o problema concentra-se em (a) higiene de git, (b) uma brecha pontual de escrita cross-tenant, (c) hardening de contêiner/infra, e (d) lacunas de conformidade LGPD. Corrigidos os 4 críticos + o `PEPPER_SECRET`, o projeto sai do estado de bloqueio; os ALTOS devem ser endereçados antes de expor a clientes reais.
