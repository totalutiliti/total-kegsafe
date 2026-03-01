# 🔍 KegSafe — Auditoria Completa e Reutilizável (v3)

> **Objetivo:** Este prompt é um framework de auditoria completo para o projeto KegSafe. Deve ser executado sempre que houver alterações no código, antes de deploys, ou como validação periódica. Ele cobre TODOS os aspectos do sistema: autenticação, RBAC, CRUD, fluxos de negócio, segurança, performance, UX, multi-tenancy, e infraestrutura.
>
> **Como usar:** Envie este prompt inteiro ao Antigravity AI. Ele deve executar cada bloco sequencialmente, documentando resultados em formato de tabela. No final, gerar um relatório consolidado com score e lista de pendências.
>
> **Tempo estimado:** ~30-45 minutos para execução completa.

---

## INSTRUÇÕES GERAIS PARA O AUDITOR

Você é o auditor do projeto KegSafe. Execute TODOS os blocos abaixo de forma sequencial e metódica.

### Regras de Execução

1. **Ambiente:** Backend NestJS rodando em `localhost:3009`, Frontend Next.js em `localhost:3000`, PostgreSQL em `localhost:5439`
2. **Antes de começar:** Verificar que os 3 serviços estão rodando. Se não estiverem, iniciar com `docker compose up -d` (PostgreSQL) e `npm run start:dev` em backend/ e frontend/
3. **Seed:** Executar `npx prisma db seed` antes dos testes (o seed deve ser idempotente)
4. **Para cada item:** Executar o teste, registrar o resultado (✅ PASS / ❌ FAIL / ⚠️ WARN / ℹ️ INFO / ⏭️ SKIP), e incluir observação
5. **Se um teste falhar:** Documentar a causa raiz, continuar os próximos testes (não parar)
6. **Evidências:** Para testes via curl, incluir o HTTP status code. Para testes via browser, incluir screenshot ou descrição do resultado
7. **Ao final:** Gerar o relatório consolidado no formato especificado no BLOCO FINAL

### Credenciais de Teste

| Perfil       | Email                          | Senha          | Role        |
|-------------|--------------------------------|----------------|-------------|
| Admin       | admin@petropolis.com.br        | Admin@123      | ADMIN       |
| Gestor      | gestor@petropolis.com.br       | Gestor@123     | MANAGER     |
| Logística   | logistica@petropolis.com.br    | Logistica@123  | LOGISTICS   |
| Manutenção  | manutencao@petropolis.com.br   | Manutencao@123 | MAINTENANCE |

### Variáveis Auxiliares

Durante a execução, armazene IDs e tokens para reutilização:

```bash
# Armazenar após login
ADMIN_TOKEN=""
MANAGER_TOKEN=""
LOGISTICS_TOKEN=""
MAINTENANCE_TOKEN=""

# Armazenar após criação
BARREL_ACTIVE_ID=""
BARREL_CREATED_ID=""
CLIENT_ID=""
GEOFENCE_ID=""
MAINTENANCE_ORDER_ID=""
DISPOSAL_ID=""
ALERT_ID=""
USER_CREATED_ID=""
```

---

## BLOCO 0 — PRÉ-REQUISITOS E AMBIENTE

### 0.1 Serviços

| Item | Teste | Esperado |
|------|-------|----------|
| 0.1.1 | `curl -s http://localhost:3009/api/health` | `{"status":"ok","database":"connected",...}` |
| 0.1.2 | `curl -s http://localhost:3000` (ou abrir browser) | Página de login renderiza |
| 0.1.3 | `psql` ou conexão ao PostgreSQL porta 5439 | Conexão OK |

### 0.2 Build Limpo

| Item | Teste | Esperado |
|------|-------|----------|
| 0.2.1 | `cd backend && npm run build` | Exit 0, sem erros |
| 0.2.2 | `cd frontend && npm run build` | Exit 0, sem erros |
| 0.2.3 | `cd backend && npx tsc --noEmit` | 0 erros TypeScript |

### 0.3 Código Limpo

| Item | Teste | Esperado |
|------|-------|----------|
| 0.3.1 | `grep -rn "console\.\(log\|error\|warn\|debug\)" backend/src/` | 0 ocorrências |
| 0.3.2 | `grep -rn "console\.\(log\|error\|warn\|debug\)" frontend/app/ frontend/components/ frontend/lib/` | 0 ocorrências |
| 0.3.3 | `grep -rn "TODO\|FIXME\|HACK\|XXX" backend/src/ frontend/app/ frontend/components/` | 0 ocorrências |

### 0.4 Seed Idempotente

| Item | Teste | Esperado |
|------|-------|----------|
| 0.4.1 | `cd backend && npx prisma db seed` (1ª vez) | Sucesso, dados criados |
| 0.4.2 | `cd backend && npx prisma db seed` (2ª vez) | Sucesso, "already exists" para cada entidade |
| 0.4.3 | Verificar contagens após seed duplo | Tenant=1, Users=4, Barrels=50, Configs=6, Geofences=5, Clients=3 |

---

## BLOCO 1 — AUTENTICAÇÃO

### 1.1 Login

| Item | Teste | Esperado |
|------|-------|----------|
| 1.1.1 | POST /api/auth/login com admin@petropolis.com.br / Admin@123 | HTTP 200 + cookies accessToken e refreshToken |
| 1.1.2 | POST /api/auth/login com gestor@petropolis.com.br / Gestor@123 | HTTP 200 |
| 1.1.3 | POST /api/auth/login com logistica@petropolis.com.br / Logistica@123 | HTTP 200 |
| 1.1.4 | POST /api/auth/login com manutencao@petropolis.com.br / Manutencao@123 | HTTP 200 |
| 1.1.5 | POST /api/auth/login com email errado | HTTP 401 "Credenciais inválidas" (não revelar se email existe) |
| 1.1.6 | POST /api/auth/login com senha errada | HTTP 401 "Credenciais inválidas" (mesma mensagem do 1.1.5) |
| 1.1.7 | POST /api/auth/login com body vazio | HTTP 400 (validação) |
| 1.1.8 | POST /api/auth/login com email inválido ("naoeumemail") | HTTP 400 (validação email) |

### 1.2 Sessão e Token

| Item | Teste | Esperado |
|------|-------|----------|
| 1.2.1 | GET /api/auth/me com token válido | HTTP 200 com dados do usuário (id, name, email, role, tenantId) |
| 1.2.2 | GET /api/auth/me sem token | HTTP 401 |
| 1.2.3 | GET /api/auth/me com token inválido/expirado | HTTP 401 |
| 1.2.4 | POST /api/auth/refresh com refreshToken cookie válido | HTTP 200 + novo accessToken |
| 1.2.5 | POST /api/auth/logout com token válido | HTTP 200 + cookies limpos |
| 1.2.6 | GET /api/auth/me após logout (usando token antigo) | HTTP 401 (token revogado) |

### 1.3 Rate Limiting no Login

| Item | Teste | Esperado |
|------|-------|----------|
| 1.3.1 | 5 POST /api/auth/login rápidos em sequência | Primeiros OK, após 5 → HTTP 429 |
| 1.3.2 | Aguardar 60s e tentar novamente | HTTP 200 (rate limit resetado) |

### 1.4 Account Locking

| Item | Teste | Esperado |
|------|-------|----------|
| 1.4.1 | 5 tentativas com senha errada para o mesmo email | Após 5ª, conta bloqueada por 15min |
| 1.4.2 | Tentar login correto com conta bloqueada | Rejeitado (conta bloqueada) |

> **⚠️ NOTA:** Testar 1.3 e 1.4 por último para não bloquear as credenciais usadas nos outros testes. Usar um email de teste separado se possível.

---

## BLOCO 2 — RBAC (Controle de Acesso Baseado em Roles)

### 2.1 Acesso a Endpoints por Role

Para cada endpoint abaixo, testar com os 4 tokens (ADMIN, MANAGER, LOGISTICS, MAINTENANCE):

| Endpoint | ADMIN | MANAGER | LOGISTICS | MAINTENANCE |
|----------|-------|---------|-----------|-------------|
| GET /api/barrels | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| POST /api/barrels | ✅ 201 | ✅ 201 | ❌ 403 | ❌ 403 |
| GET /api/logistics/* | ✅ 200 | ✅ 200 | ✅ 200 | ❌ 403 |
| POST /api/logistics/expedition | ✅ 200 | ✅ 200 | ✅ 200 | ❌ 403 |
| GET /api/maintenance/orders | ✅ 200 | ✅ 200 | ❌ 403 | ✅ 200 |
| POST /api/maintenance/orders | ✅ 201 | ✅ 201 | ❌ 403 | ✅ 201 |
| GET /api/alerts | ✅ 200 | ✅ 200 | ❌ 403 | ✅ 200 |
| GET /api/clients | ✅ 200 | ✅ 200 | ❌ 403 | ❌ 403 |
| POST /api/clients | ✅ 201 | ✅ 201 | ❌ 403 | ❌ 403 |
| GET /api/disposals/* | ✅ 200 | ✅ 200 | ❌ 403 | ✅ 200 |
| POST /api/disposals | ✅ 201 | ✅ 201 | ❌ 403 | ✅ 201 |
| GET /api/users | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |
| POST /api/users | ✅ 201 | ❌ 403 | ❌ 403 | ❌ 403 |
| PATCH /api/components/:id | ✅ 200 | ❌ 403 | ❌ 403 | ❌ 403 |

> **Procedimento:** Para cada linha, fazer a requisição com cada token e verificar que o HTTP status corresponde ao esperado. Documentar qualquer divergência.
>
> **IMPORTANTE:** Adaptar os endpoints exatos conforme a estrutura real da API (verificar controllers). Os endpoints acima são baseados nas auditorias anteriores. Se um endpoint não existir ou tiver rota diferente, documentar.

### 2.2 Frontend — Sidebar por Role

Abrir o frontend no browser com cada perfil e verificar o menu lateral:

| Menu Item | ADMIN | MANAGER | LOGISTICS | MAINTENANCE |
|-----------|-------|---------|-----------|-------------|
| Dashboard | ✅ | ✅ | ❌ | ❌ |
| Barris | ✅ | ✅ | ✅ | ✅ |
| Logística | ✅ | ✅ | ✅ | ❌ |
| Manutenção | ✅ | ✅ | ❌ | ✅ |
| Alertas | ✅ | ✅ | ❌ | ❌ |
| Clientes | ✅ | ✅ | ❌ | ❌ |
| Geofences | ✅ | ✅ | ❌ | ❌ |
| Descarte | ✅ | ✅ | ❌ | ❌ |
| Relatórios | ✅ | ✅ | ❌ | ❌ |
| Config > Usuários | ✅ | ❌ | ❌ | ❌ |
| Config > Componentes | ✅ | ❌ | ❌ | ❌ |

### 2.3 Frontend — Acesso Direto por URL

| Item | Teste | Esperado |
|------|-------|----------|
| 2.3.1 | LOGISTICS navega para /settings/users | Tela 403 "Acesso Negado" com botão voltar |
| 2.3.2 | MAINTENANCE navega para /logistics | Tela 403 |
| 2.3.3 | Usuário não autenticado navega para /dashboard | Redirect para /login |

---

## BLOCO 3 — CRUD DE BARRIS

### 3.1 Listar Barris

| Item | Teste | Esperado |
|------|-------|----------|
| 3.1.1 | GET /api/barrels | HTTP 200, array com 50 barris do seed |
| 3.1.2 | GET /api/barrels?search=KS-BAR-00001 | 1 resultado |
| 3.1.3 | GET /api/barrels?status=ACTIVE | Apenas barris com status ACTIVE |
| 3.1.4 | GET /api/barrels?search=INEXISTENTE | 0 resultados, mensagem adequada |
| 3.1.5 | GET /api/barrels?page=1&limit=20 | 20 resultados + metadados de paginação (total, page, totalPages) |
| 3.1.6 | GET /api/barrels?page=3&limit=20 | 10 resultados (50 total, página 3) |

### 3.2 Criar Barril

| Item | Teste | Esperado |
|------|-------|----------|
| 3.2.1 | POST /api/barrels com body válido `{"capacity":50,"material":"STAINLESS_STEEL","valveModel":"TYPE_S","manufacturer":"Franke"}` | HTTP 201, barril criado com internalCode auto-gerado (KS-BAR-00051) |
| 3.2.2 | Verificar que 6 componentCycles foram auto-criados para o novo barril | GET /api/barrels/:id retorna componentes |
| 3.2.3 | POST /api/barrels com capacidade negativa `{"capacity":-10,...}` | HTTP 400 |
| 3.2.4 | POST /api/barrels com capacidade 0 | HTTP 400 |
| 3.2.5 | POST /api/barrels sem campos obrigatórios (body vazio) | HTTP 400 |
| 3.2.6 | POST /api/barrels com campos extras não permitidos | HTTP 400 (forbidNonWhitelisted) |

### 3.3 Detalhe do Barril

| Item | Teste | Esperado |
|------|-------|----------|
| 3.3.1 | GET /api/barrels/:id (ID válido) | HTTP 200 com todos os dados do barril |
| 3.3.2 | GET /api/barrels/:id (ID inexistente/UUID random) | HTTP 404 |
| 3.3.3 | GET /api/barrels/:id/timeline | HTTP 200 com timeline do barril |

### 3.4 Frontend — Lista de Barris

| Item | Teste | Esperado |
|------|-------|----------|
| 3.4.1 | Acessar /barrels | Tabela com colunas: Código, QR Code, Capacidade, Ciclos, Saúde, Status |
| 3.4.2 | Header mostra total "{N} barris cadastrados" | Total correto |
| 3.4.3 | Código interno clicável (cor amber) | Link navega para /barrels/:id |
| 3.4.4 | Semáforo de saúde (●) com cores verde/amarelo/vermelho | Cores corretas por health score |
| 3.4.5 | Badges de status com cores distintas | 7 status com cores diferentes |
| 3.4.6 | Busca por código funciona | Filtro aplicado, resultados atualizados |
| 3.4.7 | Dropdown de status funciona | Filtra por status selecionado |
| 3.4.8 | Paginação aparece se > 20 barris | Botões próxima/anterior, indicador de página |
| 3.4.9 | Busca sem resultados mostra mensagem | "Nenhum barril encontrado" |

### 3.5 Frontend — Criar Barril via Dialog

| Item | Teste | Esperado |
|------|-------|----------|
| 3.5.1 | Botão "Novo Barril" visível para ADMIN/MANAGER | Botão presente |
| 3.5.2 | Click abre dialog com formulário | Campos: Capacidade, Material, Fabricante, Modelo da Válvula |
| 3.5.3 | Submeter com dados válidos | Toast de sucesso + barril aparece na lista |
| 3.5.4 | Submeter com dados inválidos | Mensagem de erro / validação no formulário |

---

## BLOCO 4 — FLUXO COMPLETO DE LOGÍSTICA

> **Este é o teste mais crítico.** Cobre o ciclo completo de vida de um barril.

### 4.1 Preparação

```bash
# Obter um barril ACTIVE para o fluxo
BARREL_ACTIVE_ID=$(curl -s GET http://localhost:3009/api/barrels?status=ACTIVE \
  -H "Cookie: accessToken=$ADMIN_TOKEN" | jq -r '.data[0].id')

# Obter um cliente para a entrega
CLIENT_ID=$(curl -s GET http://localhost:3009/api/clients \
  -H "Cookie: accessToken=$ADMIN_TOKEN" | jq -r '.data[0].id')
```

### 4.2 Ciclo Completo

| Item | Teste | Esperado |
|------|-------|----------|
| 4.2.1 | POST /api/logistics/expedition `{"barrelId":"$BARREL_ACTIVE_ID"}` | HTTP 200/201. Barril muda de ACTIVE → IN_TRANSIT |
| 4.2.2 | GET /api/barrels/$BARREL_ACTIVE_ID — verificar status | status: "IN_TRANSIT" |
| 4.2.3 | POST /api/logistics/delivery `{"barrelId":"$BARREL_ACTIVE_ID","clientId":"$CLIENT_ID"}` | HTTP 200/201. Barril muda de IN_TRANSIT → AT_CLIENT |
| 4.2.4 | GET /api/barrels/$BARREL_ACTIVE_ID — verificar status | status: "AT_CLIENT" |
| 4.2.5 | POST /api/logistics/collection `{"barrelId":"$BARREL_ACTIVE_ID"}` | HTTP 200/201. Barril muda de AT_CLIENT → IN_TRANSIT |
| 4.2.6 | GET /api/barrels/$BARREL_ACTIVE_ID — verificar status | status: "IN_TRANSIT" |
| 4.2.7 | POST /api/logistics/reception `{"barrelId":"$BARREL_ACTIVE_ID"}` | HTTP 200/201. Barril muda de IN_TRANSIT → ACTIVE |
| 4.2.8 | GET /api/barrels/$BARREL_ACTIVE_ID — verificar status | status: "ACTIVE" |
| 4.2.9 | Verificar que totalCycles incrementou +1 | totalCycles = valor_anterior + 1 |
| 4.2.10 | Verificar que componentCycles incrementaram +1 | currentCycles = valor_anterior + 1 para cada componente |
| 4.2.11 | GET /api/barrels/$BARREL_ACTIVE_ID/timeline | Mostra 4 eventos: expedition, delivery, collection, reception |

### 4.3 Transições Inválidas

| Item | Teste | Esperado |
|------|-------|----------|
| 4.3.1 | POST /api/logistics/expedition com barril IN_TRANSIT | HTTP 400 (transição inválida) |
| 4.3.2 | POST /api/logistics/expedition com barril AT_CLIENT | HTTP 400 |
| 4.3.3 | POST /api/logistics/delivery com barril ACTIVE | HTTP 400 (precisa ser IN_TRANSIT) |
| 4.3.4 | POST /api/logistics/collection com barril ACTIVE | HTTP 400 (precisa ser AT_CLIENT) |
| 4.3.5 | POST /api/logistics/reception com barril ACTIVE | HTTP 400 (precisa ser IN_TRANSIT) |
| 4.3.6 | POST /api/logistics/expedition com barrelId inexistente | HTTP 404 |

### 4.4 Bloqueio por Componente Crítico

| Item | Teste | Esperado |
|------|-------|----------|
| 4.4.1 | Se existir barril com componente CRITICAL + healthScore RED: tentar expedição | HTTP 400 (BarrelBlockedCriticalComponentException) |

> **Nota:** Se o seed não gera barris nessa condição, criar manualmente ou documentar como ℹ️

### 4.5 Ciclo Repetido (2º ciclo no mesmo barril)

| Item | Teste | Esperado |
|------|-------|----------|
| 4.5.1 | Repetir 4.2.1 a 4.2.8 no mesmo barril | Tudo passa novamente |
| 4.5.2 | totalCycles incrementou mais +1 (agora +2 do original) | Correto |

---

## BLOCO 5 — FLUXO COMPLETO DE MANUTENÇÃO

### 5.1 Criar Ordem de Manutenção

| Item | Teste | Esperado |
|------|-------|----------|
| 5.1.1 | POST /api/maintenance/orders `{"barrelId":"$BARREL_ID","type":"PREVENTIVE","description":"Manutenção preventiva trimestral"}` | HTTP 201, ordem criada |
| 5.1.2 | Verificar status do barril | Barril mudou para IN_MAINTENANCE |
| 5.1.3 | Verificar status da ordem | status: "OPEN" ou "IN_PROGRESS" |

### 5.2 Registrar Checklist

| Item | Teste | Esperado |
|------|-------|----------|
| 5.2.1 | POST /api/maintenance/checklist com itens de checklist para a ordem criada | HTTP 200/201 |
| 5.2.2 | Verificar se componentCycles foram resetados (se ação = REPLACED/REPAIRED) | currentCycles resetado conforme ação |
| 5.2.3 | Verificar se healthScore dos componentes foi recalculado | Health scores atualizados |

### 5.3 Triagem

| Item | Teste | Esperado |
|------|-------|----------|
| 5.3.1 | POST /api/maintenance/triage com resultado INTACT | Barril volta a ACTIVE |
| 5.3.2 | POST /api/maintenance/triage com resultado DAMAGED | Cria OS automática (SENT_TO_MAINTENANCE) |
| 5.3.3 | POST /api/maintenance/triage com resultado STRUCTURAL_DAMAGE | Barril muda para BLOCKED |

> **Nota:** Testar cada resultado de triagem em barris diferentes. Usar barris do seed que não foram usados no fluxo logístico.

### 5.4 RBAC Manutenção

| Item | Teste | Esperado |
|------|-------|----------|
| 5.4.1 | MAINTENANCE cria ordem de manutenção | HTTP 201 (permitido) |
| 5.4.2 | LOGISTICS tenta GET /api/maintenance/orders | HTTP 403 (bloqueado) |
| 5.4.3 | LOGISTICS tenta POST /api/maintenance/orders | HTTP 403 (bloqueado) |

---

## BLOCO 6 — ALERTAS E CRON JOBS

### 6.1 Endpoints de Alertas

| Item | Teste | Esperado |
|------|-------|----------|
| 6.1.1 | GET /api/alerts | HTTP 200, lista (pode ser vazia em ambiente recém-seedado) |
| 6.1.2 | GET /api/alerts/counts | HTTP 200, `{"total":N,"pending":N,"critical":N}` |
| 6.1.3 | GET /api/alerts?type=COMPONENT_HEALTH | Filtro por tipo funciona |
| 6.1.4 | GET /api/alerts?resolved=false | Filtro por status funciona |

### 6.2 Acknowledge e Resolve (se houver alertas)

| Item | Teste | Esperado |
|------|-------|----------|
| 6.2.1 | POST /api/alerts/:id/acknowledge | HTTP 200, status muda para ACKNOWLEDGED |
| 6.2.2 | POST /api/alerts/:id/resolve | HTTP 200, status muda para RESOLVED |

> **Se 0 alertas:** Marcar como ℹ️ e documentar que alertas são gerados pelos cron jobs. Sugerir: trigger manual dos cron jobs ou aguardar schedule.

### 6.3 Cron Jobs Registrados

| Item | Teste (Code Review) | Esperado |
|------|---------------------|----------|
| 6.3.1 | checkComponentHealth registrado | Cron schedule presente (ex: 06:00) |
| 6.3.2 | checkIdleBarrels registrado | Schedule presente |
| 6.3.3 | checkMaintenanceOverdue registrado | Schedule presente |
| 6.3.4 | checkLostBarrels registrado | Schedule presente |
| 6.3.5 | checkGeofenceViolations registrado | Schedule presente |
| 6.3.6 | checkGpsOffline registrado (stub OK) | Schedule presente, log informativo |
| 6.3.7 | refreshCache registrado | Schedule presente |

---

## BLOCO 7 — CLIENTES

### 7.1 CRUD

| Item | Teste | Esperado |
|------|-------|----------|
| 7.1.1 | GET /api/clients | HTTP 200, 3 clientes do seed |
| 7.1.2 | POST /api/clients `{"tradeName":"Novo Bar","legalName":"Novo Bar LTDA","cnpj":"11222333000181","contactPhone":"11999998888","latitude":-22.51,"longitude":-43.18}` | HTTP 201, cliente criado |
| 7.1.3 | Verificar se geofence automática foi criada (se coordenadas fornecidas) | Geofence tipo CLIENT existe para o novo cliente |
| 7.1.4 | PATCH /api/clients/:id `{"tradeName":"Bar Atualizado"}` | HTTP 200, nome atualizado |
| 7.1.5 | DELETE /api/clients/:id (o criado no 7.1.2) | HTTP 200, soft delete (deletedAt preenchido) |
| 7.1.6 | GET /api/clients — cliente deletado não aparece | Lista não inclui o cliente com deletedAt |

### 7.2 Validações

| Item | Teste | Esperado |
|------|-------|----------|
| 7.2.1 | POST /api/clients com CNPJ duplicado | HTTP 400/409 |
| 7.2.2 | POST /api/clients com CNPJ de 13 dígitos | HTTP 400 |
| 7.2.3 | POST /api/clients com CNPJ de 15 dígitos | HTTP 400 |
| 7.2.4 | POST /api/clients sem campos obrigatórios | HTTP 400 |

---

## BLOCO 8 — GEOFENCES

### 8.1 CRUD

| Item | Teste | Esperado |
|------|-------|----------|
| 8.1.1 | GET /api/geofences | HTTP 200, geofences do seed (fábrica + clientes) |
| 8.1.2 | POST /api/geofences `{"name":"Depósito Teste","type":"FACTORY","latitude":-22.50,"longitude":-43.17,"radiusMeters":1000}` | HTTP 201 |
| 8.1.3 | PATCH /api/geofences/:id `{"name":"Depósito Atualizado"}` | HTTP 200 |
| 8.1.4 | DELETE /api/geofences/:id | HTTP 200 |

### 8.2 Validações

| Item | Teste | Esperado |
|------|-------|----------|
| 8.2.1 | POST /api/geofences sem nome | HTTP 400 |
| 8.2.2 | POST /api/geofences com raio negativo | HTTP 400 |
| 8.2.3 | POST /api/geofences sem coordenadas | HTTP 400 |

---

## BLOCO 9 — DESCARTE

### 9.1 Fluxo Completo

| Item | Teste | Esperado |
|------|-------|----------|
| 9.1.1 | GET /api/disposals/suggestions | HTTP 200 (pode ser vazio se TCO < threshold) |
| 9.1.2 | POST /api/disposals `{"barrelId":"$BARREL_ID","reason":"Desgaste excessivo","destination":"RECYCLING"}` | HTTP 201, status PENDING_APPROVAL |
| 9.1.3 | POST /api/disposals/:id/approve (MANAGER/ADMIN) | HTTP 200, status → APPROVED |
| 9.1.4 | POST /api/disposals/:id/complete (ADMIN) | HTTP 200, status → COMPLETED |
| 9.1.5 | GET /api/barrels/:id — verificar status do barril | status: "DISPOSED" |
| 9.1.6 | POST /api/logistics/expedition com barril DISPOSED | HTTP 400 (barril descartado) |

### 9.2 RBAC Descarte

| Item | Teste | Esperado |
|------|-------|----------|
| 9.2.1 | MAINTENANCE cria solicitação de descarte | HTTP 201 (permitido) |
| 9.2.2 | LOGISTICS tenta criar descarte | HTTP 403 (bloqueado) |
| 9.2.3 | MAINTENANCE tenta aprovar | HTTP 403 (apenas MANAGER/ADMIN) |

---

## BLOCO 10 — CONFIGURAÇÕES

### 10.1 Usuários (ADMIN only)

| Item | Teste | Esperado |
|------|-------|----------|
| 10.1.1 | GET /api/users (com ADMIN token) | HTTP 200, lista de usuários |
| 10.1.2 | POST /api/users `{"name":"Teste","email":"teste@petropolis.com.br","password":"Teste@123","role":"LOGISTICS"}` | HTTP 201 |
| 10.1.3 | Login com o novo usuário | HTTP 200 |
| 10.1.4 | POST /api/users com email duplicado | HTTP 400/409 |
| 10.1.5 | POST /api/users com senha < 6 caracteres | HTTP 400 |
| 10.1.6 | PATCH /api/users/:adminId `{"role":"LOGISTICS"}` (tentar mudar role do último admin) | HTTP 400 (proteção último admin) |
| 10.1.7 | DELETE /api/users/:adminId (tentar deletar último admin) | HTTP 400 (proteção último admin) |
| 10.1.8 | DELETE /api/users/:id (deletar usuário criado no 10.1.2) | HTTP 200, soft delete |
| 10.1.9 | GET /api/users com MANAGER token | HTTP 403 |
| 10.1.10 | GET /api/users com LOGISTICS token | HTTP 403 |

### 10.2 Componentes (ADMIN only)

| Item | Teste | Esperado |
|------|-------|----------|
| 10.2.1 | GET /api/components | HTTP 200, 6 configs do seed |
| 10.2.2 | PATCH /api/components/:id `{"maxCycles":200}` | HTTP 200, atualizado |
| 10.2.3 | PATCH /api/components/:id com MANAGER token | HTTP 403 |

---

## BLOCO 11 — MULTI-TENANCY

### 11.1 Isolamento

| Item | Teste | Esperado |
|------|-------|----------|
| 11.1.1 | Todas as queries filtram por tenantId (code review) | Verificar nos services |
| 11.1.2 | TenantId extraído do JWT, nunca do body | @TenantId() decorator em todos os controllers |
| 11.1.3 | GET barril com UUID inexistente (outro tenant) | HTTP 404 (não 403) |
| 11.1.4 | Enviar tenantId no body de POST /api/barrels — deve ser ignorado | TenantId do barril criado = tenantId do JWT |
| 11.1.5 | Soft delete: registros com deletedAt != null não aparecem nas listagens | Verificar queries incluem deletedAt: null |

---

## BLOCO 12 — DASHBOARD E RELATÓRIOS

### 12.1 Endpoints do Dashboard

| Item | Teste | Esperado |
|------|-------|----------|
| 12.1.1 | GET /api/dashboard/fleet-health | HTTP 200, dados da frota (total, por status, por saúde) |
| 12.1.2 | GET /api/dashboard/cost-per-liter | HTTP 200, custo por litro calculado |
| 12.1.3 | GET /api/dashboard/asset-turnover | HTTP 200, giro médio de ativos |
| 12.1.4 | GET /api/dashboard/loss-report | HTTP 200, relatório de perdas |

### 12.2 Frontend — Dashboard

| Item | Teste | Esperado |
|------|-------|----------|
| 12.2.1 | 4 KPI cards renderizam com dados | Total Barris, Custo/Litro, Giro Médio, Alertas Ativos |
| 12.2.2 | Gráfico de rosca "Distribuição da Frota" | Renderiza com cores por status |
| 12.2.3 | Gráfico de barras "Saúde dos Componentes" | Renderiza com verde/amarelo/vermelho |
| 12.2.4 | 6 mini-cards de status na parte inferior | Em Trânsito, No Cliente, Manutenção, Bloqueados, Descartados, Perdidos |
| 12.2.5 | Skeleton de loading durante carregamento | DashboardSkeleton visível antes dos dados |
| 12.2.6 | Tooltips nos gráficos ao hover | Tooltip dark theme aparece |

---

## BLOCO 13 — UX, DESIGN E ACESSIBILIDADE

### 13.1 Tela de Login

| Item | Teste | Esperado |
|------|-------|----------|
| 13.1.1 | Design premium com gradientes amber/orange | Visual conforme spec |
| 13.1.2 | Logo KegSafe visível | Logo com ícone Package + gradiente |
| 13.1.3 | Métricas na lateral (99.2%, -35%, +48%) | KPIs marketeiros visíveis em desktop |
| 13.1.4 | Campo email com validação HTML5 | type="email" + required |
| 13.1.5 | Toggle visibilidade da senha | Ícone Eye/EyeOff funciona |
| 13.1.6 | Credenciais de teste visíveis | 4 credenciais listadas |
| 13.1.7 | Erro de login mostra mensagem no card | "Credenciais inválidas" sem revelar existência do email |
| 13.1.8 | Enter submete o formulário | form onSubmit funciona |
| 13.1.9 | Loading spinner durante autenticação | Spinner visível entre submit e redirect |

### 13.2 Sidebar

| Item | Teste | Esperado |
|------|-------|----------|
| 13.2.1 | Logo KegSafe com ícone laranja no topo | Gradiente amber-to-orange |
| 13.2.2 | Ícones Lucide em cada menu | Ícone presente e correto para cada seção |
| 13.2.3 | Item ativo destacado em amber | bg-amber-500/10 text-amber-500 |
| 13.2.4 | Separador entre MENU e CONFIGURAÇÕES | Separator visível |
| 13.2.5 | Labels "MENU" e "CONFIGURAÇÕES" em uppercase | Estilo uppercase com tracking |
| 13.2.6 | Avatar com iniciais do usuário | Iniciais corretas |
| 13.2.7 | Nome e role visíveis no footer da sidebar | Nome + role em zinc-500 |
| 13.2.8 | Botão logout funcional | Click → logout → redirect para /login |

### 13.3 Tema

| Item | Teste | Esperado |
|------|-------|----------|
| 13.3.1 | Toggle Sol/Lua alterna tema | Dark → Light e vice-versa |
| 13.3.2 | Label "Modo Claro" / "Modo Escuro" alterna | Texto correto conforme tema |
| 13.3.3 | Tema persiste após recarregar página | localStorage mantém preferência |
| 13.3.4 | Tema escuro: bg-zinc-950, cards bg-zinc-900/50, border-zinc-800 | Cores consistentes |
| 13.3.5 | Cores amber/orange para CTAs e destaques | Botões e links em amber |

### 13.4 Responsividade

| Item | Teste | Esperado |
|------|-------|----------|
| 13.4.1 | Login: split-screen em desktop, single-column em mobile | Layout adapta em 768px |
| 13.4.2 | KPIs: 4 colunas em desktop, empilham em mobile | grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 |
| 13.4.3 | Tabelas: scroll horizontal em telas menores | overflow-x-auto funciona |
| 13.4.4 | Sidebar: menu estático em desktop, overlay com hamburger em mobile | Toggle funciona, backdrop aparece |
| 13.4.5 | Sem scroll horizontal indesejado | Nenhum overflow não controlado |

### 13.5 Feedback Visual

| Item | Teste | Esperado |
|------|-------|----------|
| 13.5.1 | Toast de sucesso em ações CRUD | Sonner toast aparece no canto superior direito |
| 13.5.2 | Toast de erro em falhas | Toast vermelho com mensagem de erro |
| 13.5.3 | Loading states em páginas | Skeleton/spinner durante carregamento |
| 13.5.4 | Hover effects nos cards e botões | hover:bg-zinc-800/50, cores mudam |
| 13.5.5 | Cursor pointer em elementos clicáveis | cursor-pointer aplicado |

### 13.6 Acessibilidade

| Item | Teste | Esperado |
|------|-------|----------|
| 13.6.1 | Inputs com labels (htmlFor) | Label associado ao input |
| 13.6.2 | Tab navigation funciona | Foco percorre elementos lógicos |
| 13.6.3 | aria-labels em ícones e botões | Toggle senha, menu, logout, sidebar |
| 13.6.4 | Contraste texto/fundo ≥ 4.5:1 | Texto branco em fundo zinc-950 (~19.5:1) |

### 13.7 Tipografia

| Item | Teste | Esperado |
|------|-------|----------|
| 13.7.1 | Fonte Inter carregada | DevTools → body → font-family: Inter |

---

## BLOCO 14 — SEGURANÇA

### 14.1 Headers e Proteções

| Item | Teste | Esperado |
|------|-------|----------|
| 14.1.1 | Helmet headers presentes | X-Content-Type-Options, X-Frame-Options, etc. |
| 14.1.2 | Content-Security-Policy configurado | CSP header presente na response |
| 14.1.3 | CORS restrito | Origin não autorizada é bloqueada |
| 14.1.4 | httpOnly cookies para tokens | Set-Cookie com HttpOnly flag |
| 14.1.5 | sameSite=strict nos cookies | Verificar Set-Cookie header |
| 14.1.6 | secure=true em produção (code review) | Verificar na config de cookies |

### 14.2 Proteção de Dados

| Item | Teste | Esperado |
|------|-------|----------|
| 14.2.1 | Senhas armazenadas com bcrypt salt 10 | Code review do UserService |
| 14.2.2 | PII masking nos logs (password, token, apiKey) | Code review do GlobalExceptionFilter |
| 14.2.3 | Stack traces não vazam para o cliente | Erro 500 retorna mensagem genérica, não stack |
| 14.2.4 | Swagger desabilitado em produção (code review) | Condicional NODE_ENV !== 'production' |

### 14.3 JWT e Configuração

| Item | Teste | Esperado |
|------|-------|----------|
| 14.3.1 | JWT_SECRET não tem fallback inseguro (code review) | Sem 'fallback-secret' no jwt.strategy.ts |
| 14.3.2 | Produção rejeita JWT_SECRET com padrão /dev\|change\|secret\|fallback/i | Code review de main.ts |
| 14.3.3 | Produção rejeita CORS wildcard | Code review de main.ts |
| 14.3.4 | Access token expira em 15min | JWT_EXPIRATION=15m |
| 14.3.5 | Refresh token expira em 7 dias | JWT_REFRESH_EXPIRATION=7d |

### 14.4 Rate Limiting

| Item | Teste | Esperado |
|------|-------|----------|
| 14.4.1 | Global: 100 req/60s | @nestjs/throttler configurado |
| 14.4.2 | Login: 5 req/60s | Rate limit específico no endpoint |
| 14.4.3 | Refresh: 10 req/60s | Rate limit específico |
| 14.4.4 | Health endpoint sem rate limiting | @SkipThrottle() aplicado |

---

## BLOCO 15 — INFRAESTRUTURA E DEVOPS

### 15.1 Banco de Dados

| Item | Teste | Esperado |
|------|-------|----------|
| 15.1.1 | PostgreSQL 16 rodando | Docker container healthy |
| 15.1.2 | Volume persistido | kegsafe_pgdata montado |
| 15.1.3 | Health check configurado | pg_isready funciona |
| 15.1.4 | 16 modelos Prisma com UUID PK | Code review do schema |
| 15.1.5 | 50+ indexes compostos | Code review do schema |
| 15.1.6 | Campos de auditoria (createdAt, updatedAt, deletedAt) em todos os modelos | Code review |
| 15.1.7 | Enums definidos corretamente | 16+ enums no schema |

### 15.2 Configuração

| Item | Teste | Esperado |
|------|-------|----------|
| 15.2.1 | .env no .gitignore | Verificar .gitignore |
| 15.2.2 | .env.example completo | Todas as variáveis documentadas |
| 15.2.3 | Git inicializado na raiz do projeto | .git/ na raiz |

### 15.3 Monitoramento

| Item | Teste | Esperado |
|------|-------|----------|
| 15.3.1 | Winston logger configurado | nest-winston no package.json |
| 15.3.2 | Global exception filter com @Catch() | Captura todas exceções |
| 15.3.3 | Health endpoint público | GET /api/health sem auth + sem rate limit |
| 15.3.4 | Swagger docs em dev | /api/docs acessível |
| 15.3.5 | 7 cron jobs registrados e logam execução | Code review |

---

## BLOCO FINAL — RELATÓRIO CONSOLIDADO

Após executar TODOS os blocos acima, gerar o relatório no seguinte formato:

```
══════════════════════════════════════════════
   KEGSAFE — RELATÓRIO DE AUDITORIA v3
   Data: [DATA]
   Auditor: Antigravity AI
══════════════════════════════════════════════

RESUMO EXECUTIVO
────────────────
Total de itens testados:    [N]
✅ PASS:                     [N] ([%]%)
❌ FAIL:                     [N] ([%]%)
⚠️ WARN:                     [N] ([%]%)
ℹ️ INFO:                     [N] ([%]%)
⏭️ SKIP:                     [N] ([%]%)

Score de Produção:          [N]%

RESULTADO POR BLOCO
────────────────────
Bloco 0  — Pré-requisitos:    [X/Y] ✅
Bloco 1  — Autenticação:      [X/Y] ✅
Bloco 2  — RBAC:              [X/Y] ✅
Bloco 3  — Barris:            [X/Y] ✅
Bloco 4  — Logística:         [X/Y] ✅
Bloco 5  — Manutenção:        [X/Y] ✅
Bloco 6  — Alertas:           [X/Y] ✅
Bloco 7  — Clientes:          [X/Y] ✅
Bloco 8  — Geofences:         [X/Y] ✅
Bloco 9  — Descarte:          [X/Y] ✅
Bloco 10 — Configurações:     [X/Y] ✅
Bloco 11 — Multi-tenancy:     [X/Y] ✅
Bloco 12 — Dashboard:         [X/Y] ✅
Bloco 13 — UX/Design:         [X/Y] ✅
Bloco 14 — Segurança:         [X/Y] ✅
Bloco 15 — Infraestrutura:    [X/Y] ✅

BUGS CRÍTICOS (Impedem produção)
────────────────────────────────
[Lista ou "Nenhum identificado"]

BUGS MODERADOS (Corrigir antes de produção)
───────────────────────────────────────────
[Lista com prioridade]

MELHORIAS SUGERIDAS
───────────────────
[Lista com categoria e impacto]

ITENS NÃO TESTÁVEIS
───────────────────
[Lista com motivo e como testar manualmente]

COMPARATIVO COM AUDITORIA ANTERIOR
───────────────────────────────────
[O que melhorou, o que regrediu, o que é novo]

AÇÕES IMEDIATAS
───────────────
[Lista ordenada por prioridade]

VEREDICTO FINAL
───────────────
[APROVADO PARA PRODUÇÃO / REPROVADO — com justificativa]
══════════════════════════════════════════════
```

> **Critérios de aprovação:**
> - 0 bugs críticos
> - Score ≥ 90%
> - Fluxo logístico completo funciona (Bloco 4)
> - Login + RBAC funcionam (Blocos 1-2)
> - Frontend renderiza e comunica com backend (Blocos 12-13)