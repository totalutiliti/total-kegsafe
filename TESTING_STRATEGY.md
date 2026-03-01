# TESTING_STRATEGY.md — KegSafe Tech — Estratégia de Testes

## Objetivo
Garantir a qualidade, segurança e confiabilidade do sistema KegSafe Tech através de testes automatizados em múltiplas camadas.

---

## 1. NÍVEIS DE COBERTURA

### Coverage Targets
| Tipo de Código | Coverage Mínimo | Ferramenta |
|---------------|-----------------|-----------|
| Services (Regras de Negócio) | **90%** | Jest + Coverage |
| Controllers (Endpoints) | **80%** | Jest + Supertest |
| Guards/Middleware | **95%** | Jest |
| Utils/Helpers | **100%** | Jest |
| E2E Críticos | **100%** dos fluxos principais | Jest E2E |

### Configuração do Jest
```json
// jest.config.js
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "src/modules/*/services/*.service.ts": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    },
    "src/common/guards/**/*.guard.ts": {
      "branches": 95,
      "functions": 95,
      "lines": 95,
      "statements": 95
    }
  }
}
```

---

## 2. PIRÂMIDE DE TESTES

```
        /\
       /  \  E2E Tests (10%)
      /    \  - Fluxos críticos completos
     /      \
    /--------\ Integration Tests (30%)
   /          \ - API endpoints + DB
  /            \
 /--------------\ Unit Tests (60%)
/                \ - Services, Guards, Utils
```

### 2.1 Unit Tests (60%)
**Objetivo:** Testar lógica de negócio isolada

**O que testar:**
- Cálculo de Health Score
- Lógica de incremento de ciclos
- Regras de descarte (TCO)
- Validações de dados
- Transformações de dados

**Exemplo:**
```typescript
// barrel.service.spec.ts
describe('BarrelService', () => {
  describe('calculateHealthScore', () => {
    it('should return GREEN when cycles < 80% of maxCycles', () => {
      const result = service.calculateHealthScore(10, 15); // 10 de 15 = 66%
      expect(result).toBe(HealthScore.GREEN);
    });

    it('should return YELLOW when cycles between 80-99% of maxCycles', () => {
      const result = service.calculateHealthScore(13, 15); // 13 de 15 = 86%
      expect(result).toBe(HealthScore.YELLOW);
    });

    it('should return RED when cycles >= maxCycles', () => {
      const result = service.calculateHealthScore(15, 15); // 15 de 15 = 100%
      expect(result).toBe(HealthScore.RED);
    });

    it('should consider both cycles and days, using the worst', () => {
      const result = service.calculateHealthScoreFull({
        cyclesSinceLastService: 5,
        maxCycles: 15,
        daysSinceLastService: 165,
        maxDays: 180
      });
      // Cycles: 33% (GREEN), Days: 91% (YELLOW)
      // Deve retornar YELLOW (pior cenário)
      expect(result).toBe(HealthScore.YELLOW);
    });
  });
});
```

---

### 2.2 Integration Tests (30%)
**Objetivo:** Testar endpoints da API com banco de dados de teste

**Setup:**
- PostgreSQL em Docker para testes
- Prisma com schema de teste
- Seed de dados mínimo

**O que testar:**
- CRUD de barris
- 4 inputs logísticos
- Manutenção com incremento de ciclos
- Geração de alertas
- Autorização RBAC

**Exemplo:**
```typescript
// logistics.controller.spec.ts (Integration)
describe('LogisticsController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterEach(async () => {
    await prisma.cleanDatabase(); // Limpa dados de teste
  });

  describe('POST /logistics/reception (Input 4)', () => {
    it('should increment barrel totalCycles', async () => {
      // Arrange
      const tenant = await prisma.tenant.create({ data: { name: 'Test Tenant', cnpj: '12345678000190' } });
      const barrel = await prisma.barrel.create({
        data: {
          tenantId: tenant.id,
          internalCode: 'TEST-001',
          qrCode: 'QR-001',
          capacityLiters: 50,
          totalCycles: 5
        }
      });

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/logistics/reception')
        .set('Authorization', `Bearer ${getValidToken(tenant.id)}`)
        .send({
          barrelQrCode: 'QR-001',
          latitude: -23.5505,
          longitude: -46.6333
        })
        .expect(201);

      // Assert
      const updatedBarrel = await prisma.barrel.findUnique({ where: { id: barrel.id } });
      expect(updatedBarrel.totalCycles).toBe(6);
      expect(updatedBarrel.status).toBe(BarrelStatus.ACTIVE);
    });

    it('should increment all component cycles', async () => {
      // Arrange
      const { tenant, barrel, componentCycles } = await seedBarrelWithComponents();

      // Act
      await request(app.getHttpServer())
        .post('/api/logistics/reception')
        .set('Authorization', `Bearer ${getValidToken(tenant.id)}`)
        .send({
          barrelQrCode: barrel.qrCode,
          latitude: -23.5505,
          longitude: -46.6333
        })
        .expect(201);

      // Assert
      for (const cycle of componentCycles) {
        const updated = await prisma.componentCycle.findUnique({ where: { id: cycle.id } });
        expect(updated.cyclesSinceLastService).toBe(cycle.cyclesSinceLastService + 1);
      }
    });
  });
});
```

---

### 2.3 E2E Tests (10%)
**Objetivo:** Testar fluxos completos do usuário

**Fluxos Críticos:**
1. Ciclo completo de um barril (Expedição → Entrega → Coleta → Recebimento)
2. Manutenção com bloqueio de componente crítico
3. Geração e resolução de alerta
4. Processo de descarte completo

**Exemplo:**
```typescript
// barrel-lifecycle.e2e-spec.ts
describe('Barrel Complete Lifecycle (E2E)', () => {
  it('should complete full barrel cycle and increment counters correctly', async () => {
    // 1. Setup: Criar tenant, usuário, barril, cliente
    const { tenant, user, barrel, client } = await seedCompleteScenario();

    // 2. INPUT 1: Expedição
    const expedition = await request(app.getHttpServer())
      .post('/api/logistics/expedition')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .send({
        barrelQrCode: barrel.qrCode,
        latitude: -22.5112, // Fábrica
        longitude: -43.1779
      })
      .expect(201);

    expect(expedition.body.barrel.status).toBe('IN_TRANSIT');

    // 3. INPUT 2: Entrega
    await request(app.getHttpServer())
      .post('/api/logistics/delivery')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .send({
        barrelQrCode: barrel.qrCode,
        latitude: client.latitude,
        longitude: client.longitude
      })
      .expect(201);

    const afterDelivery = await prisma.barrel.findUnique({ where: { id: barrel.id } });
    expect(afterDelivery.status).toBe('AT_CLIENT');

    // 4. INPUT 3: Coleta
    await request(app.getHttpServer())
      .post('/api/logistics/collection')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .send({
        barrelQrCode: barrel.qrCode,
        latitude: client.latitude,
        longitude: client.longitude
      })
      .expect(201);

    // 5. INPUT 4: Recebimento (incrementa ciclos)
    const initialCycles = afterDelivery.totalCycles;
    await request(app.getHttpServer())
      .post('/api/logistics/reception')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .send({
        barrelQrCode: barrel.qrCode,
        latitude: -22.5112,
        longitude: -43.1779
      })
      .expect(201);

    // 6. Verificações finais
    const finalBarrel = await prisma.barrel.findUnique({
      where: { id: barrel.id },
      include: { componentCycles: true }
    });

    expect(finalBarrel.status).toBe('ACTIVE');
    expect(finalBarrel.totalCycles).toBe(initialCycles + 1);
    finalBarrel.componentCycles.forEach(cycle => {
      expect(cycle.cyclesSinceLastService).toBeGreaterThan(0);
    });
  });
});
```

---

## 3. TESTES CRÍTICOS OBRIGATÓRIOS

### 3.1 Multi-Tenancy Isolation
**Prioridade: CRÍTICA**

```typescript
describe('Multi-Tenancy Isolation', () => {
  it('should NOT allow user from Tenant A to access barrel from Tenant B', async () => {
    const tenantA = await createTenant('Petrópolis');
    const tenantB = await createTenant('Itaipava');
    const userA = await createUser(tenantA.id, Role.MANAGER);
    const barrelB = await createBarrel(tenantB.id);

    await request(app.getHttpServer())
      .get(`/api/barrels/${barrelB.id}`)
      .set('Authorization', `Bearer ${getUserToken(userA)}`)
      .expect(404); // 404, não 403 (não vazar info)
  });

  it('should enforce RLS at database level', async () => {
    const tenantA = await createTenant('Petrópolis');
    const tenantB = await createTenant('Itaipava');
    
    // Tentar burlar via query direta (bypass middleware)
    await prisma.$executeRaw`SET app.current_tenant_id = '${tenantA.id}'`;
    
    const barrels = await prisma.barrel.findMany();
    
    expect(barrels.every(b => b.tenantId === tenantA.id)).toBe(true);
  });
});
```

---

### 3.2 RBAC (Role-Based Access Control)
**Prioridade: CRÍTICA**

```typescript
describe('RBAC Authorization', () => {
  it('should allow MANAGER to access dashboard', async () => {
    const user = await createUser(tenantId, Role.MANAGER);
    
    await request(app.getHttpServer())
      .get('/api/dashboard/fleet-health')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .expect(200);
  });

  it('should DENY LOGISTICS access to dashboard', async () => {
    const user = await createUser(tenantId, Role.LOGISTICS);
    
    await request(app.getHttpServer())
      .get('/api/dashboard/fleet-health')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .expect(403);
  });

  it('should allow MAINTENANCE to register maintenance but NOT approve disposal', async () => {
    const user = await createUser(tenantId, Role.MAINTENANCE);
    
    // Pode registrar manutenção
    await request(app.getHttpServer())
      .post('/api/maintenance/checklist')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .send({ /* ... */ })
      .expect(201);

    // Não pode aprovar descarte
    await request(app.getHttpServer())
      .patch('/api/disposals/123/approve')
      .set('Authorization', `Bearer ${getUserToken(user)}`)
      .expect(403);
  });
});
```

---

### 3.3 Health Score Calculation
**Prioridade: ALTA**

```typescript
describe('Health Score Logic', () => {
  it('should calculate health score based on worst metric (cycles OR days)', async () => {
    const component = await createComponentConfig({
      name: 'O-Ring',
      maxCycles: 15,
      maxDays: 180
    });

    const cycle = await createComponentCycle({
      componentConfigId: component.id,
      cyclesSinceLastService: 5, // 33% (GREEN)
      lastServiceDate: new Date(Date.now() - 165 * 24 * 60 * 60 * 1000) // 165 dias = 91% (YELLOW)
    });

    const healthScore = await service.calculateHealthScore(cycle.id);
    
    expect(healthScore).toBe(HealthScore.YELLOW); // Pior cenário prevalece
  });

  it('should recalculate health score after maintenance', async () => {
    const cycle = await createComponentCycle({
      cyclesSinceLastService: 14, // 93% (YELLOW)
      lastServiceDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000)
    });

    expect(cycle.healthScore).toBe(HealthScore.YELLOW);

    // Registrar manutenção (troca)
    await service.registerMaintenance({
      componentCycleId: cycle.id,
      action: ComponentAction.REPLACED
    });

    const updated = await prisma.componentCycle.findUnique({ where: { id: cycle.id } });
    
    expect(updated.cyclesSinceLastService).toBe(0); // Resetado
    expect(updated.healthScore).toBe(HealthScore.GREEN); // Recalculado
  });
});
```

---

### 3.4 Alertas Preditivos
**Prioridade: ALTA**

```typescript
describe('Alert System', () => {
  it('should generate alert when component reaches 90% of maxCycles', async () => {
    const component = await createComponentConfig({
      name: 'Sifão',
      maxCycles: 40,
      alertThreshold: 0.9
    });

    const barrel = await createBarrel();
    const cycle = await createComponentCycle({
      barrelId: barrel.id,
      componentConfigId: component.id,
      cyclesSinceLastService: 36 // 90% de 40
    });

    // Rodar job de alertas
    await alertService.checkHealthAlerts();

    const alert = await prisma.alert.findFirst({
      where: {
        barrelId: barrel.id,
        alertType: AlertType.COMPONENT_END_OF_LIFE,
        status: AlertStatus.ACTIVE
      }
    });

    expect(alert).toBeDefined();
    expect(alert.priority).toBe(AlertPriority.HIGH);
  });

  it('should NOT create duplicate alerts', async () => {
    // Criar alerta manualmente
    await createAlert({
      barrelId: barrel.id,
      alertType: AlertType.IDLE_AT_CLIENT,
      status: AlertStatus.ACTIVE
    });

    // Tentar criar novamente
    const result = await alertService.createIdleAtClientAlert(barrel.id);

    expect(result).toBeNull(); // Não criou duplicado

    const count = await prisma.alert.count({
      where: {
        barrelId: barrel.id,
        alertType: AlertType.IDLE_AT_CLIENT,
        status: AlertStatus.ACTIVE
      }
    });

    expect(count).toBe(1); // Apenas 1
  });
});
```

---

### 3.5 Geofencing
**Prioridade: MÉDIA**

```typescript
describe('Geofencing Logic', () => {
  it('should infer zone as FACTORY when coordinates within factory geofence', async () => {
    const factory = await createGeofence({
      name: 'Fábrica Petrópolis',
      type: GeofenceType.FACTORY,
      latitude: -22.5112,
      longitude: -43.1779,
      radiusMeters: 1000
    });

    const zone = await geofenceService.inferZone(-22.5120, -43.1785); // Dentro do raio

    expect(zone).toBe(GeofenceType.FACTORY);
  });

  it('should generate alert when scan outside any known geofence', async () => {
    await logisticsService.registerEvent({
      barrelId: barrel.id,
      actionType: LogisticsAction.DELIVERY,
      latitude: -10.0000, // Coordenada desconhecida
      longitude: -50.0000
    });

    await alertService.checkGeofenceViolations();

    const alert = await prisma.alert.findFirst({
      where: {
        barrelId: barrel.id,
        alertType: AlertType.GEOFENCE_VIOLATION
      }
    });

    expect(alert).toBeDefined();
    expect(alert.priority).toBe(AlertPriority.CRITICAL);
  });
});
```

---

## 4. PERFORMANCE TESTS

### 4.1 Load Testing (Artillery / K6)
**Objetivo:** Garantir que o sistema aguenta 100 usuários simultâneos

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 300
      arrivalRate: 50
      name: Sustained load
    - duration: 60
      arrivalRate: 100
      name: Spike
scenarios:
  - name: "Scan Barrels"
    flow:
      - post:
          url: "/api/logistics/expedition"
          json:
            barrelQrCode: "KS-BAR-{{ $randomNumber() }}"
            latitude: -23.5505
            longitude: -46.6333
```

**Critérios de Sucesso:**
- p95 response time < 500ms
- p99 response time < 1000ms
- Taxa de erro < 1%

---

### 4.2 Database Query Performance
```typescript
describe('Query Performance', () => {
  it('should load dashboard in less than 2 seconds for 50k barrels', async () => {
    await seedBarrels(50000); // Criar 50k barrels

    const start = Date.now();
    await dashboardService.getFleetHealth(tenantId);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000); // < 2 segundos
  });
});
```

---

## 5. SETUP DE TESTES

### docker-compose.test.yml
```yaml
version: '3.8'
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: kegsafe_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```

### package.json Scripts
```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:unit": "jest --testPathPattern=.spec.ts",
    "test:int": "jest --testPathPattern=.int-spec.ts",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand"
  }
}
```

---

## 6. CI/CD INTEGRATION

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: kegsafe_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:cov
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

---

## 7. QUALITY GATES

**Bloqueio de Merge/Deploy se:**
- Coverage < 80%
- Testes unitários falhando
- Testes de integração críticos falhando
- Vulnerabilidades de segurança detectadas (npm audit)

---

## RESUMO

| Categoria | Quantidade de Testes | Tempo Estimado de Execução |
|-----------|---------------------|---------------------------|
| Unit Tests | ~200 testes | < 30 segundos |
| Integration Tests | ~50 testes | < 2 minutos |
| E2E Tests | ~10 fluxos | < 5 minutos |
| **TOTAL** | **~260 testes** | **< 8 minutos** |

**Próximos passos:** Implementar testes progressivamente durante o desenvolvimento, começando pelos críticos.
