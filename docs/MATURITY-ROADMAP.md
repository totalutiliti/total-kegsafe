# Roadmap de Maturidade -- KegSafe Tech (Fase 8)

> Itens de maturidade operacional planejados para evolucao do KegSafe.
> Fase 8 foca em resiliencia, observabilidade e engenharia de confiabilidade.

**Ultima atualizacao:** 2026-02-28
**Responsavel:** Equipe de Engenharia KegSafe
**Status:** Planejado (futuro)

---

## 8.1 Graceful Degradation

### Objetivo
Definir modos de operacao para cada dependencia externa, garantindo que o sistema continue funcionando (mesmo que de forma limitada) quando uma dependencia falhar.

### Matriz de Dependencias

#### PostgreSQL (Dependencia Critica)

| Modo | Condicao | Comportamento |
|------|----------|---------------|
| **Normal** | Banco acessivel, latencia < 100ms | Todas as funcionalidades disponiveis |
| **Degradado** | Banco acessivel, latencia > 500ms | Rate limiting mais agressivo, desabilitar relatorios complexos, priorizar escritas criticas (logistics events) |
| **Offline** | Banco inacessivel | Retornar 503 com retry-after header, health check reporta `degraded`, operacoes de leitura retornam cache local (se implementado) |

**Implementacao proposta:**

```typescript
// health.service.ts
@Injectable()
export class HealthService {
  async checkDatabase(): Promise<'healthy' | 'degraded' | 'offline'> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      if (latency > 500) return 'degraded';
      return 'healthy';
    } catch {
      return 'offline';
    }
  }
}
```

#### Redis (Dependencia Futura -- Cache/Sessions)

| Modo | Condicao | Comportamento |
|------|----------|---------------|
| **Normal** | Redis acessivel | Cache de queries frequentes, sessoes distribuidas |
| **Degradado** | Redis lento (> 50ms) | Bypass do cache, fallback para queries diretas ao PostgreSQL |
| **Offline** | Redis inacessivel | Sistema funciona sem cache (maior carga no PostgreSQL), sessoes em memoria local |

#### Azure Blob Storage (Dependencia Futura -- Uploads)

| Modo | Condicao | Comportamento |
|------|----------|---------------|
| **Normal** | Blob Storage acessivel | Upload/download de logos, fotos de barris |
| **Degradado** | Blob Storage lento | Filas de upload, placeholder para imagens |
| **Offline** | Blob Storage inacessivel | Uploads falham com mensagem amigavel, sistema funciona sem imagens |

### Circuit Breaker Pattern

```typescript
// Implementar circuit breaker para dependencias externas
// Usar biblioteca como 'opossum' ou implementacao customizada

interface CircuitBreakerConfig {
  failureThreshold: number;  // Numero de falhas para abrir o circuito
  resetTimeout: number;      // Tempo (ms) para tentar fechar o circuito
  monitorInterval: number;   // Intervalo de verificacao
}

const DB_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000,    // 30 segundos
  monitorInterval: 10000, // 10 segundos
};
```

---

## 8.2 SLOs e Error Budgets

### Objetivo
Definir Service Level Objectives (SLOs) iniciais e error budgets para medir e gerenciar confiabilidade do sistema.

### SLOs Propostos

| SLO | Objetivo | Janela | Metrica |
|-----|----------|--------|---------|
| **Disponibilidade** | 99.5% | 30 dias rolling | % de requests com status < 500 |
| **Latencia (p95)** | < 500ms | 30 dias rolling | Percentil 95 do tempo de resposta |
| **Latencia (p99)** | < 2000ms | 30 dias rolling | Percentil 99 do tempo de resposta |
| **Taxa de Erro** | < 0.5% | 30 dias rolling | % de requests com status 5xx |

### Error Budgets

```
Disponibilidade 99.5% em 30 dias:
- Total de minutos no mes: 43,200 (30 dias)
- Error budget: 0.5% = 216 minutos de downtime permitido
- Error budget por semana: ~54 minutos

Se o error budget for consumido:
1. Congelar deploys nao-criticos
2. Focar em estabilidade e observabilidade
3. Realizar post-mortem de incidentes
4. So retomar deploys quando budget for recuperado
```

### Metricas de Implementacao

```typescript
// Middleware para coletar metricas de SLO
@Injectable()
export class SloMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const status = context.switchToHttp().getResponse().statusCode;

        // Emitir metricas para Azure Monitor / Prometheus
        this.metrics.recordRequest({
          duration,
          status,
          endpoint: context.switchToHttp().getRequest().url,
          success: status < 500,
        });
      }),
    );
  }
}
```

### Dashboard de SLOs (Proposta)

| Indicador | Verde | Amarelo | Vermelho |
|-----------|-------|---------|----------|
| Disponibilidade | >= 99.5% | 99.0-99.5% | < 99.0% |
| Latencia p95 | < 500ms | 500ms-1s | > 1s |
| Error rate | < 0.5% | 0.5-1.0% | > 1.0% |
| Error budget restante | > 50% | 25-50% | < 25% |

---

## 8.3 Threat Modeling (STRIDE)

### Objetivo
Analise de ameacas STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) dos endpoints criticos do KegSafe.

### 8.3.1 Modulo de Autenticacao (`/auth`)

| Ameaca | Tipo STRIDE | Risco | Mitigacao Atual | Mitigacao Proposta |
|--------|-------------|-------|-----------------|-------------------|
| Brute force de senha | **S** (Spoofing) | Alto | `failedLoginAttempts` + `lockedUntil` | Adicionar CAPTCHA apos 3 tentativas, rate limit por IP |
| Token JWT roubado | **S** (Spoofing) | Alto | Expiracao curta (15min) | Implementar token binding (fingerprint do dispositivo) |
| Refresh token replay | **T** (Tampering) | Medio | Token revogado apos uso | Implementar refresh token rotation (one-time use) |
| Login sem auditoria | **R** (Repudiation) | Baixo | AuditLog com IP e UserAgent | Adicionar geolocation do IP |
| JWT secret exposto em logs | **I** (Info Disclosure) | Critico | Regra de NUNCA logar credentials | Scan automatizado de logs para secrets (git-leaks) |
| Flood de requests de login | **D** (DoS) | Medio | ThrottlerModule global | Rate limit especifico para `/auth/login` (5 req/min por IP) |
| Escalacao de role via JWT | **E** (Elevation) | Critico | Role vem do banco, nao do JWT payload | Validar role do banco em cada request (nao confiar no token) |

### 8.3.2 Modulo de Logistica (`/logistics`)

| Ameaca | Tipo STRIDE | Risco | Mitigacao Atual | Mitigacao Proposta |
|--------|-------------|-------|-----------------|-------------------|
| Scan de barril de outro tenant | **S** (Spoofing) | Alto | Filtro tenantId no middleware | Validar que barril pertence ao tenant antes de qualquer operacao |
| Falsificar localizacao GPS | **T** (Tampering) | Medio | Coordenadas vem do request | Validar plausibilidade (velocidade maxima entre eventos) |
| Negar que fez entrega | **R** (Repudiation) | Medio | LogisticsEvent com timestamp | Adicionar assinatura digital do entregador |
| Expor rota de entregas | **I** (Info Disclosure) | Baixo | RBAC (so LOGISTICS e ADMIN) | Criptografar coordenadas em transito e repouso |
| Flood de eventos de logistica | **D** (DoS) | Baixo | ThrottlerModule | Rate limit especifico para operacoes de logistica |
| LOGISTICS criando barris | **E** (Elevation) | Medio | Guard `@Roles(MANAGER, ADMIN)` | Testes automatizados de RBAC |

### 8.3.3 Modulo de Barris (`/barrels`)

| Ameaca | Tipo STRIDE | Risco | Mitigacao Atual | Mitigacao Proposta |
|--------|-------------|-------|-----------------|-------------------|
| Importacao CSV maliciosa | **T** (Tampering) | Alto | Validacao de campos | Limite de tamanho de arquivo, sanitizacao de todos os campos, scan antivirus |
| Acesso a custos de aquisicao | **I** (Info Disclosure) | Medio | RBAC (MANAGER+) | Mascarar valores financeiros em responses para roles sem permissao |
| Exclusao em massa de barris | **D** (DoS) | Alto | Soft-delete + ADMIN only | Limite de exclusoes por request, confirmacao dupla |
| Alteracao de status sem autorizacao | **E** (Elevation) | Medio | Guards de role | Adicionar workflow de aprovacao para mudancas de status criticas |

### Prioridade de Implementacao

1. **Critico (imediato):** Rate limit especifico no `/auth/login`, validacao de role do banco
2. **Alto (proximo sprint):** CAPTCHA, validacao de barril-tenant, limite de importacao CSV
3. **Medio (proximo trimestre):** Token binding, refresh rotation, validacao de GPS
4. **Baixo (futuro):** Geolocation de IP, assinatura digital de entregas

---

## 8.4 Arquitetura Substituivel (Replaceable Architecture)

### Objetivo
Avaliar o acoplamento dos modulos do KegSafe e garantir que componentes possam ser substituidos sem reescrever o sistema.

### Matriz de Acoplamento

| Modulo | Depende de | Acoplamento | Substituivel? |
|--------|-----------|-------------|---------------|
| **AuthModule** | Prisma, JWT, Argon2 | Medio | Sim -- JWT pode ser trocado por OAuth2/OIDC |
| **BarrelsModule** | Prisma, TenantContext | Baixo | Sim -- interface bem definida |
| **LogisticsModule** | Prisma, TenantContext, BarrelsModule | Medio | Parcial -- depende de BarrelsModule |
| **MaintenanceModule** | Prisma, TenantContext, BarrelsModule | Medio | Parcial -- depende de BarrelsModule |
| **PrismaModule** | Prisma Client, PostgreSQL | Alto | Dificil -- ORM permeia todo o sistema |
| **TenantContextModule** | CLS, Prisma Middleware | Alto | Dificil -- middleware global |

### Avaliacoes por Componente

#### ORM (Prisma)
- **Acoplamento atual:** Alto -- PrismaClient usado diretamente nos services
- **Para tornar substituivel:** Criar interfaces Repository para cada model
- **Esforco estimado:** Alto (reescrever todos os services)
- **Recomendacao:** Manter Prisma, mas abstrair em services que encapsulam queries

```typescript
// Exemplo de abstraction layer
interface BarrelRepository {
  findAll(tenantId: string, filters: BarrelFilters): Promise<Barrel[]>;
  findById(tenantId: string, id: string): Promise<Barrel | null>;
  create(tenantId: string, data: CreateBarrelDto): Promise<Barrel>;
}

// Implementacao Prisma
@Injectable()
class PrismaBarrelRepository implements BarrelRepository {
  constructor(private prisma: PrismaService) {}
  // ...
}
```

#### Autenticacao (JWT + Argon2)
- **Acoplamento atual:** Medio -- concentrado no AuthModule
- **Para tornar substituivel:** Interface `AuthProvider` com metodos `login`, `verify`, `refresh`
- **Esforco estimado:** Baixo (modulo ja bem isolado)
- **Recomendacao:** Manter JWT, mas preparar interface para OAuth2/OIDC no futuro

#### Database (PostgreSQL)
- **Acoplamento atual:** Alto -- via Prisma, mas PostgreSQL-specific features usadas (UUID, Timestamptz, JSONB)
- **Para tornar substituivel:** Impossivel sem reescrever o schema
- **Recomendacao:** Manter PostgreSQL, sem planos de troca

### Metricas de Acoplamento

```
Instability (I) = Ce / (Ca + Ce)
- Ca = Acoplamento aferente (quem depende de mim)
- Ce = Acoplamento eferente (de quem eu dependo)

PrismaModule:  Ca=10, Ce=1, I=0.09 (muito estavel, muitos dependem dele)
AuthModule:    Ca=0,  Ce=3, I=1.00 (instavel, depende de outros, ninguem depende)
BarrelsModule: Ca=2,  Ce=2, I=0.50 (equilibrado)
```

---

## 8.5 Engenharia do Caos (Chaos Engineering)

### Objetivo
Propor experimentos de caos para validar a resiliencia do KegSafe em ambiente de staging.

### Pre-requisitos
- Ambiente de staging com dados realistas (anonimizados)
- Monitoramento e alertas configurados
- Equipe disponivel para observar e intervir
- Plano de rollback para cada experimento

### Experimento 1: Falha de Conexao com PostgreSQL

**Hipotese:** O sistema retorna 503 com mensagem amigavel e se recupera automaticamente quando o banco volta.

**Procedimento:**
```bash
# 1. Em staging, bloquear acesso ao PostgreSQL via firewall
az postgres flexible-server firewall-rule delete \
  --resource-group rg-kegsafe-staging \
  --name pg-kegsafe-staging \
  --rule-name allow-azure-services \
  --yes

# 2. Observar por 5 minutos:
#    - Health check deve retornar status "degraded" ou "offline"
#    - Requests devem retornar 503 (nao 500 com stack trace)
#    - Logs devem registrar falha de conexao sem expor DATABASE_URL
#    - Frontend deve exibir mensagem amigavel ao usuario

# 3. Restaurar acesso
az postgres flexible-server firewall-rule create \
  --resource-group rg-kegsafe-staging \
  --name pg-kegsafe-staging \
  --rule-name allow-azure-services \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# 4. Observar recuperacao:
#    - Health check deve voltar a "healthy" em < 30 segundos
#    - Requests devem voltar a funcionar normalmente
#    - Nenhum dado deve ser perdido
```

**Metricas a observar:**
- Tempo ate detectar falha (health check)
- Tempo de recuperacao apos restaurar conexao
- Mensagens de erro expostas ao usuario (nao deve ter stack traces)
- Connection pool se reconecta automaticamente

---

### Experimento 2: Container com Memoria Saturada

**Hipotese:** O container e reiniciado pelo Azure quando atinge o limite de memoria, e o sistema se recupera sem intervencao manual.

**Procedimento:**
```bash
# 1. Fazer deploy de versao de staging com memory leak simulado
# Adicionar endpoint temporario:

# GET /chaos/memory-leak
# Aloca 10MB a cada chamada, nunca libera
# (NUNCA fazer isso em producao)

# 2. Chamar o endpoint repetidamente ate atingir limite
for i in $(seq 1 100); do
  curl -s https://kegsafe-backend-staging.azurewebsites.net/chaos/memory-leak
  sleep 1
done

# 3. Observar:
#    - Azure deve reiniciar o container ao atingir limite de memoria
#    - Health check deve falhar temporariamente
#    - Apos restart, sistema deve funcionar normalmente
#    - Nenhum dado deve ser perdido

# 4. Remover endpoint de chaos e re-deploy
```

**Metricas a observar:**
- Tempo ate Azure detectar OOM e reiniciar
- Tempo total de indisponibilidade
- Migrations re-executam corretamente no restart
- Connection pool e recriado com sucesso

---

### Experimento 3: Deploy com Migration que Falha

**Hipotese:** Se uma migration falhar no deploy, o container nao inicia, e a versao anterior continua servindo trafego.

**Procedimento:**
```bash
# 1. Criar branch com migration que falha propositalmente
# Exemplo: ALTER TABLE que referencia coluna inexistente

# prisma/migrations/xxx_chaos_test/migration.sql
# ALTER TABLE barrels ADD CONSTRAINT fk_chaos FOREIGN KEY (nonexistent_column) REFERENCES tenants(id);

# 2. Fazer deploy em staging

# 3. Observar:
#    - Container deve falhar no startup (prisma migrate deploy retorna erro)
#    - Azure deve detectar falha no health check
#    - Se usando deployment slots: slot anterior continua servindo
#    - Se nao: downtime ate rollback manual

# 4. Rollback
az webapp config container set \
  --resource-group rg-kegsafe-staging \
  --name kegsafe-backend-staging \
  --container-image-name "kegsafeacr.azurecr.io/kegsafe-backend:<SHA_ANTERIOR>"

# 5. Reverter migration
npx prisma migrate resolve --rolled-back xxx_chaos_test
```

**Metricas a observar:**
- Tempo ate detectar que deploy falhou
- Tempo de rollback manual
- Dados afetados pela migration parcial (se houver)
- Logs de erro sao claros e acionaveis

---

### Calendario de Experimentos

| Trimestre | Experimento | Ambiente |
|-----------|-------------|----------|
| Q2 2026 | Exp 1: Falha de PostgreSQL | Staging |
| Q2 2026 | Exp 2: Memory Leak | Staging |
| Q3 2026 | Exp 3: Migration falha | Staging |
| Q3 2026 | Revisao e novos experimentos | -- |
| Q4 2026 | Simulacao completa de DR | Staging |

---

## Resumo de Prioridades (Fase 8)

| Item | Prioridade | Esforco | Impacto |
|------|-----------|---------|---------|
| 8.3 Threat Modeling (mitigacoes criticas) | **P0** | Medio | Alto |
| 8.2 SLOs e Error Budgets | **P1** | Baixo | Alto |
| 8.1 Graceful Degradation (PostgreSQL) | **P1** | Medio | Alto |
| 8.5 Chaos Exp 1 (PostgreSQL) | **P2** | Baixo | Medio |
| 8.4 Repository abstraction | **P3** | Alto | Baixo |
| 8.5 Chaos Exp 2 e 3 | **P3** | Baixo | Medio |

---

*Documento mantido pela equipe de engenharia. Revisar trimestralmente e atualizar com resultados dos experimentos de caos.*
