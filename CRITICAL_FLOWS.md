# CRITICAL_FLOWS.md — KegSafe Tech — Cenários Críticos e Edge Cases

## Objetivo
Este documento mapeia cenários críticos, edge cases e situações de erro que DEVEM ser tratadas pelo sistema para garantir a integridade dos dados e a segurança operacional.

---

## 1. CONCORRÊNCIA E CONFLITOS

### 1.1 Dois Operadores Escaneiam o Mesmo Barril Simultaneamente

**Cenário:** 
- Operador A escaneia barril #123 às 10:00:00 para EXPEDITION
- Operador B escaneia o mesmo barril #123 às 10:00:02 para EXPEDITION

**Comportamento Esperado:**
- ✅ Ambos os scans são registrados (não há conflito de negócio)
- ⚠️ O sistema registra dois eventos logísticos com timestamps diferentes
- 🔔 Alerta de DUPLICIDADE é gerado para o MANAGER revisar
- 📊 No relatório, o segundo scan pode ser marcado como "redundante"

**Implementação:**
```typescript
// No LogisticsService
async registerEvent(dto: LogisticsEventDto) {
  // Verificar se existe evento do mesmo tipo nos últimos 30 segundos
  const recentEvent = await this.prisma.logisticsEvent.findFirst({
    where: {
      barrelId: dto.barrelId,
      actionType: dto.actionType,
      timestamp: { gte: new Date(Date.now() - 30000) }
    }
  });
  
  if (recentEvent) {
    // Registrar alerta de duplicidade
    await this.alertService.createDuplicateScanAlert(dto.barrelId, recentEvent.id);
  }
  
  // Registrar o evento normalmente
  return this.prisma.logisticsEvent.create({ data: dto });
}
```

---

### 1.2 Scan de DELIVERY em Localização Diferente do Cliente Cadastrado

**Cenário:**
- Barril #456 deve ser entregue no "Bar do Zé" (lat: -23.5610, lng: -46.6555)
- Operador escaneia como DELIVERY mas o GPS está em (lat: -23.5800, lng: -46.6700) — 2km de distância

**Comportamento Esperado:**
- ⚠️ Sistema calcula a distância entre GPS real e geofence do cliente
- 🔔 Se distância > 500m, gera ALERTA CRÍTICO: "Entrega fora da zona do cliente"
- 📸 Sistema solicita foto comprobatória ao operador
- 🚫 Entrega fica com status PENDING_VALIDATION até manager aprovar
- ✅ Manager pode aprovar manualmente ou rejeitar (devolve barril ao status IN_TRANSIT)

**Implementação:**
```typescript
async validateDeliveryLocation(clientId: string, latitude: number, longitude: number) {
  const client = await this.prisma.client.findUnique({
    where: { id: clientId },
    include: { geofences: true }
  });
  
  const distance = calculateDistance(
    latitude, longitude,
    client.latitude, client.longitude
  );
  
  if (distance > 500) { // 500 metros
    throw new BusinessException({
      code: 'DELIVERY_OUT_OF_ZONE',
      message: `Entrega a ${distance}m do cliente. Foto obrigatória.`,
      requiresPhoto: true
    });
  }
}
```

---

### 1.3 Barril Marcado como AT_CLIENT mas GPS Indica Movimento

**Cenário:**
- Barril #789 foi entregue no cliente às 10:00
- Status atual: AT_CLIENT
- Às 14:00, o GPS detecta coordenadas 10km distantes do cliente

**Comportamento Esperado:**
- 🔔 ALERTA CRÍTICO: "Possível extravio ou movimentação não autorizada"
- 📧 Notificação push imediata para MANAGER e perfil SECURITY (se existir)
- 🚨 Status do barril: SUSPECTED_THEFT (novo status)
- 📍 Sistema registra timeline de localização a cada 15 min até resolução
- ✅ Manager pode marcar como "falso positivo" (ex: cliente mudou de endereço) ou acionar recuperação

---

## 2. PROBLEMAS DE CONECTIVIDADE

### 2.1 Scan Offline (Mobile sem Internet)

**Cenário:**
- Operador está em área rural sem sinal de celular
- Precisa registrar COLLECTION de 20 barris

**Comportamento Esperado:**
- 📱 App mobile armazena scans em banco local (SQLite/Realm/AsyncStorage)
- 🔄 Quando reconectar, sincroniza automaticamente em ordem cronológica
- ⚠️ Se houver conflito (ex: barril já foi movimentado por outro), exibe alerta
- 🕒 Timestamp usado é o do momento do scan offline, NÃO do momento da sincronização

**Implementação (Mobile):**
```typescript
// No MobileLogisticsService
async scanBarrel(qrCode: string, actionType: LogisticsAction) {
  const event = {
    qrCode,
    actionType,
    latitude: await getGPS(),
    longitude: await getGPS(),
    timestamp: new Date().toISOString(),
    userId: getCurrentUser().id,
    synced: false
  };
  
  // Tentar enviar para API
  try {
    if (await isOnline()) {
      await this.api.post('/logistics/scan', event);
      event.synced = true;
    }
  } catch (error) {
    // Salvar localmente
    await this.localDB.save('pending_scans', event);
  }
}

// Job de sincronização
async syncPendingScans() {
  if (await isOnline()) {
    const pending = await this.localDB.getAll('pending_scans', { synced: false });
    for (const event of pending) {
      try {
        await this.api.post('/logistics/scan', event);
        await this.localDB.update('pending_scans', event.id, { synced: true });
      } catch (error) {
        // Log do erro, tenta na próxima iteração
      }
    }
  }
}
```

---

### 2.2 Falha de GPS no Mobile

**Cenário:**
- Operador tenta escanear barril mas GPS não está disponível (desligado, erro de permissão, indoor sem sinal)

**Comportamento Esperado:**
- 🚫 Sistema BLOQUEIA o scan até GPS estar disponível
- 💬 Exibe mensagem: "GPS necessário. Por favor, vá para área aberta ou habilite localização."
- 🔄 Botão de "Tentar Novamente" verifica GPS a cada 5 segundos
- 📍 Não permite scan sem coordenadas (geolocalização é CRÍTICA para o negócio)

---

## 3. MANUTENÇÃO E COMPONENTES

### 3.1 Componente Crítico em Vermelho mas Operador Libera para Envase

**Cenário:**
- Barril #333 tem O-Ring em healthScore RED (passou do limite de ciclos)
- Operador tenta marcar no sistema como "pronto para envase"

**Comportamento Esperado:**
- 🚫 BLOQUEIO HARD: Sistema NÃO permite liberação
- 💬 Mensagem: "Barril bloqueado. O-Ring vencido. Manutenção obrigatória."
- 🔧 Sistema redireciona automaticamente para Menu de Manutenção
- ✅ Só libera após registro de TROCA do componente

**Implementação:**
```typescript
// No BarrelService
async checkIfCanBeFilledService(barrelId: string): Promise<boolean> {
  const componentCycles = await this.prisma.componentCycle.findMany({
    where: { barrelId },
    include: { componentConfig: true }
  });
  
  const criticalComponents = componentCycles.filter(c => c.healthScore === 'RED');
  
  if (criticalComponents.length > 0) {
    throw new BusinessException({
      code: 'BARREL_BLOCKED_CRITICAL_COMPONENT',
      message: `Componentes críticos vencidos: ${criticalComponents.map(c => c.componentConfig.name).join(', ')}`,
      blockedComponents: criticalComponents
    });
  }
  
  return true;
}
```

---

### 3.2 Manutenção Registrada mas Peças Não Foram Trocadas

**Cenário:**
- Técnico marca checklist como "O-Ring REPLACED"
- Mas na realidade, só limpou e não trocou (economia indevida de peças)

**Comportamento Esperado:**
- 📸 SOLUÇÃO 1: Exigir foto da peça nova ao marcar "REPLACED"
- 🔢 SOLUÇÃO 2: Sistema valida estoque de peças (se integrado com ERP)
- 📊 SOLUÇÃO 3: Auditoria posterior — se barril voltar para manutenção do mesmo componente em < 5 ciclos, gera alerta de "possível fraude"

**Implementação (Auditoria Posterior):**
```typescript
// Job CRON para detectar manutenções suspeitas
async detectSuspiciousMaintenances() {
  // Buscar barris que tiveram manutenção de um componente
  const maintenances = await this.prisma.maintenanceItem.findMany({
    where: {
      action: 'REPLACED',
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // últimos 90 dias
    }
  });
  
  for (const m of maintenances) {
    // Verificar se teve nova manutenção do mesmo componente em < 5 ciclos
    const nextMaintenance = await this.prisma.maintenanceItem.findFirst({
      where: {
        barrelId: m.barrelId,
        componentConfigId: m.componentConfigId,
        createdAt: { gt: m.createdAt }
      }
    });
    
    if (nextMaintenance) {
      const cycles = await this.getCyclesBetweenDates(m.barrelId, m.createdAt, nextMaintenance.createdAt);
      if (cycles < 5) {
        await this.alertService.create({
          type: 'SUSPICIOUS_MAINTENANCE',
          barrelId: m.barrelId,
          description: `Componente ${m.componentConfig.name} trocado há ${cycles} ciclos atrás`,
          metadata: { maintenanceId: m.id, technicianId: m.maintenanceLog.userId }
        });
      }
    }
  }
}
```

---

## 4. RASTREAMENTO E SEGURANÇA

### 4.1 Barril Sai da Cerca Geográfica Autorizada

**Cenário:**
- Barril #999 está em trânsito (EXPEDITION registrado)
- GPS detecta coordenadas em zona de risco (ex: área de ferro-velho)

**Comportamento Esperado:**
- 🚨 ALERTA IMEDIATO de GEOFENCE_VIOLATION
- 📧 Push notification + SMS para MANAGER e SECURITY
- 📍 Timeline de localização registrada a cada 5 min (não 15 min)
- 🚔 Botão de "Acionar Autoridades" no dashboard (se cliente configurar)
- 🔒 Status do barril: SUSPECTED_THEFT

---

### 4.2 Dispositivo GPS do Barril para de Enviar Sinal

**Cenário:**
- GPS do barril #111 estava enviando sinal normalmente
- Última localização: 2 dias atrás

**Comportamento Esperado:**
- ⚠️ Após 24h sem sinal, gera ALERTA de DEVICE_OFFLINE
- 📧 Notificação para MANAGER: "Barril #111 sem sinal GPS há 24h"
- 🔋 Possíveis causas exibidas: bateria acabou, dano físico, área sem cobertura
- 🔧 Sistema sugere: "Verificar hardware ao receber o barril"

---

## 5. DESCARTE E BAIXA PATRIMONIAL

### 5.1 Sistema Sugere Descarte mas Barril está em Campo

**Cenário:**
- Barril #222 atingiu TCO >= custo novo * 0.65
- Sistema gera sugestão de descarte
- Mas barril está AT_CLIENT neste momento

**Comportamento Esperado:**
- ✅ Sugestão é criada normalmente
- 🚫 Mas baixa patrimonial NÃO pode ser aprovada enquanto status != ACTIVE
- 💬 Mensagem ao manager: "Aguardar retorno do barril para processar descarte"
- 🔔 Quando barril passar por RECEPTION, sistema envia alerta: "Barril #222 retornou e está pendente de descarte"

---

### 5.2 Manager Aprova Descarte mas Técnico Marca como "Consertado"

**Cenário:**
- Descarte aprovado para barril #444
- Status deveria ser DISPOSED
- Mas técnico, sem saber, registra manutenção e tenta liberar para envase

**Comportamento Esperado:**
- 🚫 Sistema bloqueia registro de manutenção
- 💬 Mensagem: "Barril marcado para descarte. Operação não permitida."
- 🔄 Se foi erro do manager, ele pode CANCELAR o descarte manualmente

---

## 6. AUTENTICAÇÃO E AUTORIZAÇÃO

### 6.1 Operador Tenta Acessar Função de Outro Perfil

**Cenário:**
- Usuário com perfil LOGISTICS tenta acessar endpoint `/api/dashboard/cost-per-liter` (restrito a MANAGER)

**Comportamento Esperado:**
- 🚫 HTTP 403 Forbidden
- 💬 Mensagem: "Acesso negado. Perfil insuficiente."
- 📝 Log de auditoria registrado: tentativa de acesso não autorizado

**Implementação:**
```typescript
@Get('cost-per-liter')
@Roles(Role.MANAGER, Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
async getCostPerLiter(@TenantId() tenantId: string) {
  return this.dashboardService.getCostPerLiter(tenantId);
}
```

---

### 6.2 Token JWT Expirado Durante Operação de Scan em Lote

**Cenário:**
- Operador inicia scan em lote de 100 barris
- No meio do processo, access token expira (15 min)

**Comportamento Esperado:**
- 🔄 App mobile detecta 401 Unauthorized
- 🔑 Automaticamente usa refresh token para renovar access token
- ▶️ Retoma operação transparentemente (usuário não percebe)
- 🚫 Se refresh token também expirou, redireciona para login mas MANTÉM scans pendentes offline

**Implementação (Mobile):**
```typescript
// Interceptor de API
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return axios.request(error.config);
      } else {
        // Redirecionar para login
        await storeRoute(error.config.url); // Salvar para retomar depois
        navigateTo('/login');
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 7. MULTI-TENANCY

### 7.1 Usuário Tenta Acessar Barril de Outro Tenant

**Cenário:**
- Usuário do tenant "Cervejaria Petrópolis" tenta acessar barril do tenant "Cervejaria Itaipava"

**Comportamento Esperado:**
- 🚫 Row-Level Security (RLS) bloqueia no banco de dados
- 🚫 Adicionalmente, Prisma middleware filtra por tenantId
- 💬 Resposta: 404 Not Found (não 403, para não vazar informação de existência)
- 📝 Log de auditoria: tentativa de acesso cross-tenant

---

## 8. PERFORMANCE

### 8.1 Dashboard Demora a Carregar (Queries Pesadas)

**Cenário:**
- Tenant tem 50.000 barris cadastrados
- Dashboard de "Saúde da Frota" demora 15 segundos

**Comportamento Esperado:**
- ✅ Implementar cache Redis com TTL de 5 min para métricas agregadas
- ✅ Queries otimizadas com índices compostos
- ✅ Lazy loading de seções do dashboard
- ✅ Skeleton loaders enquanto carrega

**Implementação:**
```typescript
@Cacheable({ ttl: 300 }) // 5 minutos
async getFleetHealth(tenantId: string) {
  const cached = await this.redis.get(`fleet:${tenantId}`);
  if (cached) return JSON.parse(cached);
  
  const health = await this.prisma.barrel.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: true
  });
  
  await this.redis.setex(`fleet:${tenantId}`, 300, JSON.stringify(health));
  return health;
}
```

---

## 9. DADOS INCONSISTENTES

### 9.1 Barril tem Status AT_CLIENT mas ClientId é NULL

**Cenário:**
- Por bug ou migração de dados, barril #555 está com:
  - status: AT_CLIENT
  - Mas não tem clientId vinculado

**Comportamento Esperado:**
- 🔔 Job CRON de "Health Check de Dados" detecta inconsistência
- ✅ Tenta inferir cliente pela última localização GPS
- 🚫 Se não conseguir, marca barril como LOST
- 📧 Envia relatório semanal para ADMIN com todas as inconsistências

**Implementação:**
```typescript
// Job semanal de data health check
async checkDataIntegrity() {
  const inconsistentBarrels = await this.prisma.barrel.findMany({
    where: {
      status: 'AT_CLIENT',
      OR: [
        { currentLatitude: null },
        { currentLongitude: null }
      ]
    }
  });
  
  for (const barrel of inconsistentBarrels) {
    const lastEvent = await this.prisma.logisticsEvent.findFirst({
      where: { barrelId: barrel.id },
      orderBy: { timestamp: 'desc' }
    });
    
    if (lastEvent?.clientId) {
      await this.prisma.barrel.update({
        where: { id: barrel.id },
        data: {
          currentLatitude: lastEvent.latitude,
          currentLongitude: lastEvent.longitude
        }
      });
    } else {
      await this.markAsLost(barrel.id);
    }
  }
}
```

---

## RESUMO DE TRATAMENTOS OBRIGATÓRIOS

| Cenário | Tratamento | Prioridade |
|---------|-----------|-----------|
| Scan duplicado | Alerta de duplicidade | MÉDIA |
| Entrega fora da zona | Validação + foto obrigatória | CRÍTICA |
| GPS com movimento não autorizado | Alerta imediato de suspeita | CRÍTICA |
| Scan offline | Armazenamento local + sync | ALTA |
| Componente crítico vencido | Bloqueio hard de envase | CRÍTICA |
| Violação de geofence | Alerta imediato + tracking intensivo | CRÍTICA |
| GPS offline por 24h | Alerta de device offline | MÉDIA |
| Token expirado durante operação | Refresh automático transparente | ALTA |
| Acesso cross-tenant | RLS + 404 response | CRÍTICA |
| Dashboard lento | Cache Redis + otimização de queries | ALTA |
| Dados inconsistentes | Job de health check + correção automática | MÉDIA |

---

**Próximos passos:** Implementar testes automatizados para cada um desses cenários.
