# ARCHITECTURE.md — KegSafe Tech — Arquitetura do Sistema

## 1. Diagrama de Contexto

```
                    ┌────┐
                    │  Operador    │
                    │  (Mobile)    │
                    └────┬────┘
                    │ QR Scan + GPS
                    ▼
┌────┐    ┌────┐    ┌────┐
│  Gestor      │───▶│   KegSafe    │◀───│  Técnico     │
│  (Dashboard) │    │   API        │    │  (Mobile)    │
└────┘    └────┬────┘    └────┘
                    │
              ┌────┼────┐
              ▼            ▼            ▼
       ┌────┐ ┌────┐ ┌────┐
       │ PostgreSQL│ │  Redis  │ │  Azure   │
       │ (RLS)     │ │ (Cache) │ │  Blob    │
       └────┘ └────┘ └────┘
```

## 2. Fluxo Multi-Tenant com RLS

```
Request → JWT Guard → Extrair tenantId do token
                    │
                    ▼
              Prisma Middleware injeta tenantId
                    │
                    ▼
              PostgreSQL RLS valida acesso
                    │
                    ▼
              Dados retornados (somente do tenant)
```

### Configuração RLS no PostgreSQL
```sql
-- Habilitar RLS na tabela
ALTER TABLE barrels ENABLE ROW LEVEL SECURITY;

-- Policy de leitura
CREATE POLICY barrels_tenant_isolation ON barrels
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy de escrita
CREATE POLICY barrels_tenant_insert ON barrels
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Prisma Middleware
```typescript
// prisma.middleware.ts
prisma.$use(async (params, next) => {
  // Injetar tenantId em queries
  if (params.model && TENANT_MODELS.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, tenantId };
    }
    if (params.action === 'create') {
      params.args.data = { ...params.args.data, tenantId };
    }
  }
  return next(params);
});
```

## 3. Fluxo dos 4 Inputs Logísticos

```
┌────┐    ┌────┐    ┌────┐    ┌────┐
│ INPUT 1 │───▶│ INPUT 2 │───▶│ INPUT 3 │───▶│ INPUT 4 │
│Expedição│    │ Entrega │    │ Coleta  │    │Recebim. │
│         │    │         │    │         │    │         │
│ Status: │    │ Status: │    │ Status: │    │ Status: │
│IN_TRANSIT│   │AT_CLIENT│    │IN_TRANSIT│   │ ACTIVE  │
│         │    │         │    │         │    │         │
│ Ação:   │    │ Ação:   │    │ Ação:   │    │ Ação:   │
│ Scan +  │    │ Scan +  │    │ Scan +  │    │ Scan +  │
│ GPS     │    │ GPS +   │    │ GPS     │    │ GPS +   │
│         │    │ Cliente │    │         │    │ +1 Ciclo│
└────┘    └────┘    └────┘    └────┘
```

### Regras por Input:

**Input 1 (Expedição):**
- Barrel.status → IN_TRANSIT
- Registra GPS da fábrica
- Valida que barrel.status era ACTIVE

**Input 2 (Entrega):**
- Barrel.status → AT_CLIENT
- Registra GPS do cliente + vincula clientId
- Inferência de geofence para identificar o cliente

**Input 3 (Coleta):**
- Barrel.status → IN_TRANSIT
- Registra GPS do cliente
- Valida que barrel.status era AT_CLIENT

**Input 4 (Recebimento):**
- Barrel.status → ACTIVE
- Registra GPS da fábrica
- **Incrementa totalCycles +1**
- **Incrementa cyclesSinceLastService +1 em TODOS os ComponentCycle do barril**
- Recalcula healthScore de cada componente
- Dispara triagem rápida se configurado

---

## 4. Diagramas de Sequência — Fluxos Críticos

### 4.1 Diagrama de Sequência: Scan Logístico (Input 2 - Entrega)

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant API as KegSafe API
    participant Auth as JWT Guard
    participant Geo as Geofence Service
    participant DB as PostgreSQL
    participant Cache as Redis
    participant Alert as Alert Engine
    participant Push as FCM (Push)

    App->>App: Operador seleciona "ENTREGA"
    App->>App: Escaneia QR Code do barril
    App->>App: Captura GPS automático
    
    App->>API: POST /logistics/delivery
    Note right of App: { qrCode, lat, lng, actionType }
    
    API->>Auth: Validar JWT Token
    Auth-->>API: { userId, tenantId, role }
    
    API->>DB: SELECT barrel WHERE qrCode AND tenantId
    DB-->>API: Barrel { id, status, ... }
    
    alt Status inválido
        API-->>App: 400 Bad Request
        Note right of API: "Barril não está IN_TRANSIT"
    end
    
    API->>Geo: inferClientByLocation(lat, lng)
    Geo->>Cache: GET geofences:{tenantId}
    
    alt Cache hit
        Cache-->>Geo: Geofences[]
    else Cache miss
        Geo->>DB: SELECT geofences WHERE tenantId
        DB-->>Geo: Geofences[]
        Geo->>Cache: SET geofences:{tenantId} TTL 5min
    end
    
    Geo->>Geo: Calcular distância para cada geofence
    Geo-->>API: { clientId, distance, confidence }
    
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE barrel SET status='AT_CLIENT'
    API->>DB: INSERT logistics_event
    API->>DB: UPDATE barrel SET currentLat, currentLng, lastEventAt
    API->>DB: COMMIT
    
    DB-->>API: Success
    
    API->>Cache: INVALIDATE dashboard:{tenantId}
    
    API->>Alert: checkGeofenceViolation(lat, lng)
    
    alt Fora de zona conhecida
        Alert->>DB: INSERT alert (GEOFENCE_VIOLATION)
        Alert->>Push: sendNotification(managers)
    end
    
    API-->>App: 201 Created
    Note right of API: { eventId, barrel, location, client }
    
    App->>App: Feedback visual + sonoro ✓
```

### 4.2 Diagrama de Sequência: Manutenção com Checklist

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant API as KegSafe API
    participant Auth as JWT Guard
    participant DB as PostgreSQL
    participant Cache as Redis
    participant Alert as Alert Engine
    participant Audit as Audit Log

    App->>App: Técnico escaneia QR Code
    App->>API: GET /barrels/:id/health
    API->>Auth: Validar JWT
    Auth-->>API: { userId, tenantId, role: MAINTENANCE }
    
    API->>DB: SELECT barrel WITH componentCycles
    DB-->>API: Barrel + ComponentCycle[]
    
    API-->>App: { barrel, components[], healthScores }
    
    App->>App: Exibe semáforo de cada componente
    App->>App: Técnico preenche checklist
    Note right of App: ☑ O-Ring: REPLACED<br>☑ Sifão: INSPECTED<br>☑ Pressão OK: true
    
    App->>API: POST /maintenance/checklist
    Note right of App: { barrelId, components[], pressureTestOk, washCompleted }
    
    API->>Auth: Validar JWT + Role MAINTENANCE
    Auth-->>API: OK
    
    API->>DB: BEGIN TRANSACTION
    
    loop Para cada componente marcado
        API->>DB: UPDATE component_cycle SET cyclesSinceLastService=0
        API->>DB: UPDATE component_cycle SET lastServiceDate=NOW()
        API->>DB: UPDATE component_cycle SET healthScore=recalculate()
    end
    
    API->>DB: INSERT maintenance_log
    API->>DB: INSERT maintenance_items (batch)
    
    opt Custo informado
        API->>DB: UPDATE barrel SET totalMaintenanceCost += cost
    end
    
    API->>DB: COMMIT
    
    API->>Alert: resolveAlertsByBarrel(barrelId, types)
    Alert->>DB: UPDATE alerts SET status='RESOLVED' WHERE ...
    
    API->>Audit: log({ action: 'MAINTENANCE_LOGGED', ... })
    Audit->>DB: INSERT audit_log
    
    API->>Cache: INVALIDATE barrel:{barrelId}
    API->>Cache: INVALIDATE dashboard:{tenantId}
    
    API-->>App: 201 Created
    Note right of API: { maintenanceLogId, updatedComponents[] }
    
    App->>App: Feedback "Manutenção registrada!" ✓
```

### 4.3 Diagrama de Sequência: Motor de Alertas (Job Scheduled)

```mermaid
sequenceDiagram
    autonumber
    participant Cron as CRON Scheduler
    participant Job as AlertHealthCheck Job
    participant DB as PostgreSQL
    participant Alert as Alert Engine
    participant Dedup as Dedup Service
    participant Email as SendGrid
    participant Push as FCM (Push)
    participant SSE as Dashboard SSE

    Cron->>Job: Trigger 06:00 UTC daily
    
    Job->>DB: SELECT DISTINCT tenantId FROM tenants WHERE isActive
    DB-->>Job: tenantIds[]
    
    loop Para cada tenant
        Job->>DB: SELECT component_cycles WHERE healthScore IN ('YELLOW', 'RED')
        Note right of Job: JOIN barrel, componentConfig
        DB-->>Job: CriticalComponents[]
        
        loop Para cada componente crítico
            Job->>Alert: createAlert(type, barrelId, componentId, priority)
            
            Alert->>Dedup: checkDuplicate(tenantId, barrelId, alertType)
            Dedup->>DB: SELECT alert WHERE ... AND status='ACTIVE'
            
            alt Alerta já existe
                Dedup-->>Alert: { isDuplicate: true }
                Alert-->>Job: Skipped (dedup)
            else Novo alerta
                Dedup-->>Alert: { isDuplicate: false }
                
                Alert->>DB: INSERT alert
                DB-->>Alert: { alertId }
                
                alt Prioridade CRITICAL
                    Alert->>Email: sendImmediateEmail(managers)
                    Email-->>Alert: { messageId }
                    
                    Alert->>Push: sendPushNotification(managers + maintenance)
                    Push-->>Alert: { sent: count }
                end
                
                Alert->>SSE: broadcastAlert(tenantId, alert)
                Note right of SSE: Dashboard atualiza em tempo real
                
                Alert-->>Job: { alertId, notifications }
            end
        end
    end
    
    Job->>Job: Log summary (alerts created, skipped, errors)
    Job-->>Cron: Complete
```

---

## 5. Fluxo de Manutenção

```
   Barril chega na fábrica (Input 4)
              │
              ▼
   ┌────┐
   │ Triagem Rápida  │
   │ (2 segundos)    │
   └────┬────┘
            │
     ┌────┴────┐
     │             │
     ▼             ▼
  Íntegro?      Avaria?
     │             │
     ▼             ▼
  Lavagem     Bloqueado
  + Envase    + Menu 6
              (Manutenção)
                 │
                 ▼
          ┌────┐
          │  Checklist    │
          │  Zero Digit.  │
          │  ☐ O-Ring     │
          │  ☐ Sifão      │
          │  ☐ Válvula    │
          │  ☐ Pressão OK │
          └────┬────┘
                 │
                 ▼
          Salvar + Liberar
          (Reset contadores)
```

## 6. Motor de Alertas

```
┌────┐
│              CRON SCHEDULER                    │
│                    │
│  06:00 → AlertHealthCheck                    │
│  08:00 → AlertIdleBarrels                    │
│  */60  → AlertGeofence                    │
│  Seg 07:00 → ReportWeekly                    │
│  Qua 06:00 → DisposalSuggestion               │
│  */5   → CacheRefresh                    │
└────┬────┘
                    │
                    ▼
         ┌────┐
         │  Alert Engine     │
         │                   │
         │  1. Avaliar regra │
         │  2. Dedup check   │
         │  3. Criar alerta  │
         │  4. Notificar     │
         └────┬────┘
                   │
          ┌────┼────┐
          ▼        ▼        ▼
       Push     E-mail   Dashboard
       (FCM)   (SendGrid) (SSE)
```

### Regras de Alerta:

| Tipo | Condição | Prioridade |
|----|----|----|
| COMPONENT_END_OF_LIFE | healthScore = YELLOW (>= 90%) | HIGH |
| MANDATORY_INSPECTION | Componente CRITICAL com healthScore = RED | CRITICAL |
| IDLE_AT_CLIENT | Último evento AT_CLIENT > 15 dias | MEDIUM |
| IDLE_AT_FACTORY | Status ACTIVE sem EXPEDITION > 7 dias | LOW |
| GEOFENCE_VIOLATION | Scan fora de qualquer zona conhecida | CRITICAL |
| DISPOSAL_SUGGESTED | TCO >= custo_novo * 0.65 OU corretivas_12m > 3 | HIGH |

---

## 7. Backup e Disaster Recovery

### 7.1 Estratégia de Backup

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP STRATEGY                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Contínuo   │    │    Diário    │    │   Semanal    │       │
│  │   WAL        │    │   Snapshot   │    │   Full       │       │
│  │   Streaming  │    │   00:00 UTC  │    │   Dom 02:00  │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Azure Blob Storage (GRS)                     │   │
│  │              Geo-Redundant: Brazil South + East US        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Retenção:                                                       │
│  • WAL: 7 dias                                                   │
│  • Diário: 30 dias                                               │
│  • Semanal: 12 semanas                                           │
│  • Mensal: 12 meses                                              │
│  • Anual: 5 anos (compliance)                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Configuração de Backup PostgreSQL

```yaml
# backup-config.yaml
postgresql:
  backup:
    # Backup contínuo via WAL
    wal_archiving:
      enabled: true
      archive_command: "az storage blob upload --file %p --container wal-archive --name %f"
      archive_timeout: 60s
    
    # Snapshot diário
    daily_snapshot:
      schedule: "0 0 * * *"  # 00:00 UTC
      retention_days: 30
      compression: gzip
      encryption: AES-256
    
    # Full backup semanal
    weekly_full:
      schedule: "0 2 * * 0"  # Domingo 02:00 UTC
      retention_weeks: 12
      type: pg_basebackup
      parallel_jobs: 4
    
    # Verificação de integridade
    verification:
      schedule: "0 4 * * 1"  # Segunda 04:00 UTC
      restore_test: true
      checksum_validation: true

  # Configuração Azure
  azure_storage:
    account: kegsafebackups
    container_daily: daily-backups
    container_weekly: weekly-backups
    container_wal: wal-archive
    geo_redundancy: GRS
    regions:
      primary: brazilsouth
      secondary: eastus
```

### 7.3 Plano de Disaster Recovery

```
┌─────────────────────────────────────────────────────────────────┐
│                 DISASTER RECOVERY PLAN                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  RTO (Recovery Time Objective): 4 horas                          │
│  RPO (Recovery Point Objective): 15 minutos                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  CENÁRIO 1: Falha de Instância (Single Node)                     │
│  ─────────────────────────────────────────────                   │
│  Ação: Failover automático para réplica standby                  │
│  Tempo estimado: 30 segundos - 2 minutos                         │
│  Perda de dados: Zero (replicação síncrona)                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  CENÁRIO 2: Falha de Região (Azure Region Down)                  │
│  ─────────────────────────────────────────────                   │
│  Ação: Ativar região secundária (East US)                        │
│  Passos:                                                         │
│    1. Detectar falha via Azure Monitor (auto)                    │
│    2. Promover réplica em East US                                │
│    3. Atualizar DNS (Traffic Manager)                            │
│    4. Notificar equipe via PagerDuty                             │
│  Tempo estimado: 30 minutos - 2 horas                            │
│  Perda de dados: Até 15 min (replicação assíncrona cross-region) │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  CENÁRIO 3: Corrupção de Dados / Erro Humano                     │
│  ─────────────────────────────────────────────                   │
│  Ação: Point-in-Time Recovery (PITR)                             │
│  Passos:                                                         │
│    1. Identificar timestamp do problema                          │
│    2. Restaurar backup mais recente anterior                     │
│    3. Aplicar WAL até o ponto desejado                           │
│    4. Validar integridade dos dados                              │
│    5. Swap com produção                                          │
│  Tempo estimado: 2-4 horas                                       │
│  Perda de dados: Depende do timestamp escolhido                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  CENÁRIO 4: Ransomware / Ataque Cibernético                      │
│  ─────────────────────────────────────────────                   │
│  Ação: Restauração de backup isolado (air-gapped)                │
│  Passos:                                                         │
│    1. Isolar sistemas afetados                                   │
│    2. Provisionar infra nova em região limpa                     │
│    3. Restaurar último backup verificado íntegro                 │
│    4. Validar ausência de malware                                │
│    5. Rotacionar todas as credenciais                            │
│  Tempo estimado: 4-8 horas                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Scripts de Recovery

```bash
#!/bin/bash
# restore-from-backup.sh

set -e

BACKUP_DATE=${1:-$(date -d "yesterday" +%Y-%m-%d)}
RESTORE_TARGET=${2:-"kegsafe_restore"}

echo "🔄 Iniciando restauração do backup: $BACKUP_DATE"

# 1. Download do backup
az storage blob download \
  --container daily-backups \
  --name "kegsafe_${BACKUP_DATE}.sql.gz" \
  --file /tmp/restore.sql.gz

# 2. Descompactar
gunzip /tmp/restore.sql.gz

# 3. Criar database temporário
psql -c "CREATE DATABASE ${RESTORE_TARGET};"

# 4. Restaurar
psql -d ${RESTORE_TARGET} -f /tmp/restore.sql

# 5. Aplicar WAL (se PITR necessário)
if [ -n "$PITR_TARGET" ]; then
  pg_restore --target-time="$PITR_TARGET" ...
fi

# 6. Validar
psql -d ${RESTORE_TARGET} -c "SELECT COUNT(*) FROM barrels;"

echo "✅ Restauração concluída em ${RESTORE_TARGET}"
```

### 7.5 Testes de DR

| Tipo de Teste | Frequência | Responsável | Documentação |
|---------------|------------|-------------|--------------|
| Restore de backup diário | Semanal (auto) | CI/CD | Relatório automático |
| Failover para réplica | Mensal | DevOps | Runbook DR-001 |
| Restore cross-region | Trimestral | DevOps + DBA | Runbook DR-002 |
| Simulação de desastre completo | Semestral | Toda equipe | Playbook DR-FULL |
| Teste de integridade de backups | Diário (auto) | Job scheduled | Dashboard de monitoramento |

---

## 8. Observabilidade e Monitoramento

### 8.1 Arquitetura de Observabilidade

```
┌─────────────────────────────────────────────────────────────────┐
│                 OBSERVABILITY STACK                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐         │
│  │   API   │   │   Web   │   │ Mobile  │   │  Jobs   │         │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘         │
│       │             │             │             │                │
│       └─────────────┴─────────────┴─────────────┘                │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 OpenTelemetry Collector                   │   │
│  │         (Traces, Metrics, Logs - Unified Pipeline)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│           ┌───────────────┼───────────────┐                      │
│           ▼               ▼               ▼                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Jaeger    │ │ Prometheus  │ │    Loki     │                │
│  │  (Traces)   │ │  (Metrics)  │ │   (Logs)    │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│           │               │               │                      │
│           └───────────────┼───────────────┘                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Grafana                              │   │
│  │            (Dashboards, Alerts, Correlation)              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Logging Strategy

```typescript
// logging.config.ts
export const loggingConfig = {
  // Formato estruturado JSON
  format: 'json',
  
  // Níveis de log por ambiente
  levels: {
    development: 'debug',
    staging: 'debug',
    production: 'info',
  },
  
  // Campos obrigatórios em todo log
  requiredFields: [
    'timestamp',      // ISO 8601
    'level',          // error, warn, info, debug
    'message',        // Descrição do evento
    'service',        // kegsafe-api, kegsafe-web, kegsafe-mobile
    'traceId',        // Correlation ID (OpenTelemetry)
    'spanId',         // Span ID
    'tenantId',       // Isolamento multi-tenant
  ],
  
  // Campos contextuais
  contextFields: [
    'userId',
    'barrelId',
    'requestId',
    'httpMethod',
    'httpPath',
    'httpStatus',
    'latencyMs',
    'errorCode',
    'errorStack',
  ],
  
  // PII Masking - campos sensíveis
  maskedFields: [
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'apiKey',
    'email',          // Parcialmente mascarado: j***@email.com
    'phone',          // Parcialmente mascarado: ***-***-1234
    'cnpj',           // Parcialmente mascarado: **.***.***/**01-**
    'cpf',
  ],
  
  // Retenção
  retention: {
    hot: '7d',        // Busca rápida
    warm: '30d',      // Busca moderada
    cold: '365d',     // Compliance
  },
};

// Exemplo de log estruturado
const logExample = {
  timestamp: '2026-02-28T10:30:00.123Z',
  level: 'info',
  message: 'Logistics event created',
  service: 'kegsafe-api',
  traceId: 'abc123def456',
  spanId: 'span789',
  tenantId: 'tenant-uuid-here',
  userId: 'user-uuid-here',
  barrelId: 'barrel-uuid-here',
  requestId: 'req-uuid-here',
  httpMethod: 'POST',
  httpPath: '/api/logistics/delivery',
  httpStatus: 201,
  latencyMs: 142,
  actionType: 'DELIVERY',
  clientId: 'client-uuid-here',
  location: { lat: -23.5505, lng: -46.6333 },
};
```

### 8.3 Métricas (Prometheus)

```yaml
# Métricas customizadas KegSafe
metrics:
  # Métricas de negócio
  business:
    - name: kegsafe_barrels_total
      type: gauge
      labels: [tenant_id, status]
      description: "Total de barris por status"
    
    - name: kegsafe_logistics_events_total
      type: counter
      labels: [tenant_id, action_type]
      description: "Total de eventos logísticos"
    
    - name: kegsafe_scan_duration_seconds
      type: histogram
      labels: [tenant_id, action_type]
      buckets: [0.1, 0.5, 1, 2, 3, 5]
      description: "Tempo de processamento de scan"
    
    - name: kegsafe_maintenance_completed_total
      type: counter
      labels: [tenant_id, maintenance_type]
      description: "Total de manutenções realizadas"
    
    - name: kegsafe_alerts_active
      type: gauge
      labels: [tenant_id, alert_type, priority]
      description: "Alertas ativos"
    
    - name: kegsafe_component_health
      type: gauge
      labels: [tenant_id, health_score]
      description: "Distribuição de saúde dos componentes"

  # Métricas de infraestrutura
  infrastructure:
    - name: kegsafe_http_requests_total
      type: counter
      labels: [method, path, status]
    
    - name: kegsafe_http_request_duration_seconds
      type: histogram
      labels: [method, path]
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    
    - name: kegsafe_db_query_duration_seconds
      type: histogram
      labels: [operation, table]
    
    - name: kegsafe_cache_hits_total
      type: counter
      labels: [cache_name]
    
    - name: kegsafe_cache_misses_total
      type: counter
      labels: [cache_name]
    
    - name: kegsafe_job_duration_seconds
      type: histogram
      labels: [job_name]
    
    - name: kegsafe_job_failures_total
      type: counter
      labels: [job_name, error_type]
```

### 8.4 Distributed Tracing

```typescript
// tracing.config.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

export const tracingConfig = {
  serviceName: 'kegsafe-api',
  
  // Sampling strategy
  sampling: {
    type: 'probabilistic',
    rate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% em prod
    // Always sample errors
    alwaysSampleErrors: true,
    // Always sample slow requests (> 1s)
    alwaysSampleSlow: true,
    slowThresholdMs: 1000,
  },
  
  // Propagation
  propagators: ['tracecontext', 'baggage'],
  
  // Instrumentation automática
  instrumentations: [
    '@opentelemetry/instrumentation-http',
    '@opentelemetry/instrumentation-express',
    '@opentelemetry/instrumentation-pg',
    '@opentelemetry/instrumentation-redis',
  ],
  
  // Atributos customizados em spans
  customAttributes: {
    'kegsafe.tenant_id': 'extracted from JWT',
    'kegsafe.user_id': 'extracted from JWT',
    'kegsafe.barrel_id': 'extracted from request',
  },
};

// Exemplo de span customizado
async function processDelivery(ctx: Context, data: DeliveryDTO) {
  const span = tracer.startSpan('logistics.delivery', {
    attributes: {
      'kegsafe.barrel_id': data.barrelId,
      'kegsafe.client_id': data.clientId,
      'kegsafe.location.lat': data.latitude,
      'kegsafe.location.lng': data.longitude,
    },
  });
  
  try {
    // Nested span para operação de banco
    const dbSpan = tracer.startSpan('db.update_barrel', { parent: span });
    await updateBarrel(data);
    dbSpan.end();
    
    // Nested span para cache
    const cacheSpan = tracer.startSpan('cache.invalidate', { parent: span });
    await invalidateCache(data.tenantId);
    cacheSpan.end();
    
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

### 8.5 Dashboards e Alertas

```yaml
# grafana-dashboards.yaml
dashboards:
  - name: "KegSafe Overview"
    panels:
      - title: "Requests per Second"
        type: graph
        query: "rate(kegsafe_http_requests_total[5m])"
      
      - title: "Error Rate"
        type: stat
        query: "rate(kegsafe_http_requests_total{status=~'5..'}[5m]) / rate(kegsafe_http_requests_total[5m])"
        thresholds:
          - value: 0.01
            color: green
          - value: 0.05
            color: yellow
          - value: 0.1
            color: red
      
      - title: "P95 Latency"
        type: graph
        query: "histogram_quantile(0.95, rate(kegsafe_http_request_duration_seconds_bucket[5m]))"
      
      - title: "Active Alerts by Priority"
        type: bargauge
        query: "kegsafe_alerts_active"
      
      - title: "Scans Today"
        type: stat
        query: "increase(kegsafe_logistics_events_total[24h])"
      
      - title: "Fleet Health Distribution"
        type: piechart
        query: "kegsafe_component_health"

# Alertas
alerts:
  - name: "High Error Rate"
    condition: "rate(kegsafe_http_requests_total{status=~'5..'}[5m]) / rate(kegsafe_http_requests_total[5m]) > 0.05"
    severity: critical
    notification: [pagerduty, slack]
    
  - name: "High Latency P95"
    condition: "histogram_quantile(0.95, rate(kegsafe_http_request_duration_seconds_bucket[5m])) > 2"
    severity: warning
    notification: [slack]
    
  - name: "Database Connection Pool Exhausted"
    condition: "kegsafe_db_pool_available < 5"
    severity: critical
    notification: [pagerduty]
    
  - name: "Job Failure Spike"
    condition: "increase(kegsafe_job_failures_total[1h]) > 10"
    severity: warning
    notification: [slack]
    
  - name: "Cache Hit Rate Low"
    condition: "kegsafe_cache_hits_total / (kegsafe_cache_hits_total + kegsafe_cache_misses_total) < 0.8"
    severity: warning
    notification: [slack]
```

---

## 9. Estratégia de Escalabilidade

### 9.1 Arquitetura Escalável

```
┌─────────────────────────────────────────────────────────────────┐
│                 SCALABILITY ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌─────────────────┐                           │
│                    │  Azure Traffic  │                           │
│                    │    Manager      │                           │
│                    │  (Global LB)    │                           │
│                    └────────┬────────┘                           │
│                             │                                    │
│            ┌────────────────┼────────────────┐                   │
│            ▼                ▼                ▼                   │
│    ┌───────────┐    ┌───────────┐    ┌───────────┐              │
│    │  Region   │    │  Region   │    │  Region   │              │
│    │  Brazil   │    │  East US  │    │  Europe   │              │
│    │  South    │    │  (DR)     │    │  (Future) │              │
│    └─────┬─────┘    └─────┬─────┘    └───────────┘              │
│          │                │                                      │
│          ▼                ▼                                      │
│    ┌───────────────────────────────────────────┐                │
│    │         Azure Container Apps              │                │
│    │         (Auto-scaling enabled)            │                │
│    │                                           │                │
│    │  ┌─────┐ ┌─────┐ ┌─────┐ ... ┌─────┐    │                │
│    │  │API 1│ │API 2│ │API 3│     │API N│    │                │
│    │  └─────┘ └─────┘ └─────┘     └─────┘    │                │
│    │                                           │                │
│    │  Min: 2 replicas  Max: 20 replicas       │                │
│    │  Scale trigger: CPU > 70% OR RPS > 1000  │                │
│    └───────────────────────────────────────────┘                │
│                             │                                    │
│          ┌──────────────────┼──────────────────┐                │
│          ▼                  ▼                  ▼                │
│    ┌───────────┐     ┌───────────┐     ┌───────────┐           │
│    │PostgreSQL │     │  Redis    │     │Azure Blob │           │
│    │  Cluster  │     │  Cluster  │     │  Storage  │           │
│    │           │     │           │     │           │           │
│    │ Primary   │     │ 3 nodes   │     │ GRS       │           │
│    │ + 2 Read  │     │ Sentinel  │     │ (geo-rep) │           │
│    │ Replicas  │     │           │     │           │           │
│    └───────────┘     └───────────┘     └───────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Estratégias de Scaling

```yaml
# scaling-config.yaml
scaling:
  api:
    horizontal:
      min_replicas: 2
      max_replicas: 20
      metrics:
        - type: cpu
          target: 70%
        - type: memory
          target: 80%
        - type: custom
          name: requests_per_second
          target: 1000
      scale_up:
        stabilization_window: 30s
        policies:
          - type: Pods
            value: 4
            period: 60s
      scale_down:
        stabilization_window: 300s
        policies:
          - type: Percent
            value: 10
            period: 60s

  database:
    read_replicas:
      min: 1
      max: 5
      scale_trigger: "read_queries_per_second > 5000"
    connection_pooling:
      min_connections: 20
      max_connections: 100
      idle_timeout: 30s

  cache:
    redis_cluster:
      nodes: 3
      memory_per_node: 4GB
      eviction_policy: volatile-lru
      max_memory_policy: noeviction

  workers:
    job_processors:
      min_replicas: 1
      max_replicas: 5
      queue_based_scaling:
        queue_length_target: 100
```

### 9.3 Database Sharding Strategy (Futuro)

```
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE SHARDING (Future Scale)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Shard Key: tenant_id (natural isolation)                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Shard 1   │  │   Shard 2   │  │   Shard 3   │              │
│  │             │  │             │  │             │              │
│  │ Tenants     │  │ Tenants     │  │ Tenants     │              │
│  │ A-F         │  │ G-O         │  │ P-Z         │              │
│  │             │  │             │  │             │              │
│  │ ~50k barris │  │ ~50k barris │  │ ~50k barris │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Routing: Consistent hashing on tenant_id                        │
│  Cross-shard queries: Avoided by design (tenant isolation)       │
│  Migrations: Online, zero-downtime via pglogical                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 Capacity Planning

| Métrica | Atual (MVP) | 6 meses | 12 meses | 24 meses |
|---------|-------------|---------|----------|----------|
| Tenants | 1 | 10 | 50 | 200 |
| Barris totais | 10.000 | 100.000 | 500.000 | 2.000.000 |
| Eventos/dia | 5.000 | 50.000 | 250.000 | 1.000.000 |
| Usuários simultâneos | 50 | 500 | 2.500 | 10.000 |
| Storage (DB) | 10 GB | 100 GB | 500 GB | 2 TB |
| Storage (Blobs) | 50 GB | 500 GB | 2 TB | 10 TB |
| API replicas | 2 | 4 | 10 | 20 |
| Read replicas DB | 1 | 2 | 3 | 5 |

### 9.5 Performance Optimizations

```typescript
// Otimizações implementadas
const performanceOptimizations = {
  database: {
    // Connection pooling
    connectionPool: {
      min: 20,
      max: 100,
      idleTimeoutMs: 30000,
    },
    
    // Query optimization
    indexes: [
      '(tenant_id, status)',           // Listagem por status
      '(tenant_id, last_event_at)',    // Ordenação temporal
      '(tenant_id, barrel_id, timestamp)', // Timeline de eventos
      '(qr_code)',                      // Lookup por scan
    ],
    
    // Materialized views para dashboard
    materializedViews: [
      'mv_fleet_health_summary',
      'mv_cost_per_liter_monthly',
      'mv_barrel_location_current',
    ],
  },
  
  cache: {
    // Cache layers
    layers: {
      L1: 'In-memory (per instance, 1min TTL)',
      L2: 'Redis (shared, 5min TTL)',
    },
    
    // Cache keys
    patterns: {
      barrel: 'barrel:{tenantId}:{barrelId}',
      dashboard: 'dashboard:{tenantId}:{metric}',
      geofences: 'geofences:{tenantId}',
      user: 'user:{userId}',
    },
    
    // Cache warming
    warmOnStartup: ['geofences', 'componentConfigs'],
  },
  
  api: {
    // Response compression
    compression: 'gzip',
    
    // Pagination
    defaultPageSize: 20,
    maxPageSize: 100,
    
    // Field selection
    sparseFieldsets: true,
    
    // ETags for caching
    etags: true,
  },
};
```

---

## 10. Estrutura de Pastas do Projeto

```
kegsafe/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── strategies/
│   │   │   │   │   │   └── jwt.strategy.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── login.dto.ts
│   │   │   │   │       └── refresh-token.dto.ts
│   │   │   │   ├── tenant/
│   │   │   │   ├── user/
│   │   │   │   ├── barrel/
│   │   │   │   ├── component/
│   │   │   │   ├── logistics/
│   │   │   │   ├── maintenance/
│   │   │   │   ├── alert/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── geofence/
│   │   │   │   ├── supplier/
│   │   │   │   └── disposal/
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── current-user.decorator.ts
│   │   │   │   │   ├── roles.decorator.ts
│   │   │   │   │   └── tenant-id.decorator.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   ├── roles.guard.ts
│   │   │   │   │   └── tenant.guard.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── tenant.interceptor.ts
│   │   │   │   │   └── logging.interceptor.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   └── pipes/
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   ├── prisma.service.ts
│   │   │   │   └── prisma.middleware.ts
│   │   │   ├── jobs/
│   │   │   │   ├── alert-health-check.job.ts
│   │   │   │   ├── alert-idle-barrels.job.ts
│   │   │   │   ├── disposal-suggestion.job.ts
│   │   │   │   └── report-weekly.job.ts
│   │   │   ├── config/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── web/                    # Next.js Dashboard
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   └── login/
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── page.tsx          # Dashboard principal
│   │   │   │   │   ├── barrels/
│   │   │   │   │   ├── maintenance/
│   │   │   │   │   ├── alerts/
│   │   │   │   │   ├── map/
│   │   │   │   │   ├── reports/
│   │   │   │   │   └── settings/
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/                # shadcn/ui
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── fleet-health-card.tsx
│   │   │   │   │   ├── cost-per-liter-chart.tsx
│   │   │   │   │   ├── barrel-map.tsx
│   │   │   │   │   └── alert-feed.tsx
│   │   │   │   └── shared/
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts
│   │   │   │   └── auth.ts
│   │   │   └── hooks/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── mobile/                    # React Native (Expo)
│       ├── src/
│       │   ├── screens/
│       │   │   ├── LoginScreen.tsx
│       │   │   ├── ScanScreen.tsx        # Scanner QR Code
│       │   │   ├── BatchScanScreen.tsx   # Modo metralhadora
│       │   │   ├── MaintenanceScreen.tsx # Checklist
│       │   │   ├── TriageScreen.tsx      # Triagem rápida
│       │   │   └── BarrelDetailScreen.tsx
│       │   ├── components/
│       │   │   ├── QRScanner.tsx
│       │   │   ├── HealthBadge.tsx
│       │   │   ├── ChecklistItem.tsx
│       │   │   └── BigButton.tsx
│       │   ├── services/
│       │   │   ├── api.ts
│       │   │   ├── auth.ts
│       │   │   ├── location.ts
│       │   │   └── notifications.ts
│       │   ├── hooks/
│       │   └── navigation/
│       ├── app.json
│       └── package.json
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       ├── api-deploy.yml
│       ├── web-deploy.yml
│       └── mobile-build.yml
└── docs/
    ├── PROMPT.md
    ├── SKILL.md
    ├── RULES.md
    ├── SPECS.md
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── schema.prisma
```

## 11. Variáveis de Ambiente

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/kegsafe?schema=public

# Auth
JWT_SECRET=your-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=kegsafe-images

# Redis
REDIS_URL=redis://localhost:6379

# SendGrid (E-mail)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=alertas@kegsafe.tech

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# App
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://app.kegsafe.tech
```

## 12. Docker Compose (Desenvolvimento)

```yaml
version: '3.8'
services:
  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://kegsafe:kegsafe@db:5432/kegsafe
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  web:
    build: ./apps/web
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kegsafe
      POSTGRES_PASSWORD: kegsafe
      POSTGRES_DB: kegsafe
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```
