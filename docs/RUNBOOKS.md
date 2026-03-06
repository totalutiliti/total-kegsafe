# Runbooks Operacionais -- KegSafe Tech

> Procedimentos padrao para operacoes do dia-a-dia e resolucao de incidentes.
> Cada runbook inclui sintomas, diagnostico e resolucao passo-a-passo.

**Ultima atualizacao:** 2026-02-28
**Responsavel:** Equipe de Engenharia / DevOps KegSafe

---

## Indice

1. [Banco de Dados Cheio ou Lento](#1-banco-de-dados-cheio-ou-lento)
2. [Container App Nao Responde](#2-container-app-nao-responde)
3. [Certificado ou Dominio Expirado](#3-certificado-ou-dominio-expirado)
4. [Escalamento Horizontal](#4-escalamento-horizontal)
5. [Otimizacao de Custos](#5-otimizacao-de-custos)
6. [Rate Limiting Disparado](#6-rate-limiting-disparado)

---

## 1. Banco de Dados Cheio ou Lento

### 1.1 Sintomas
- Queries demorando mais que 5 segundos
- Erros `too many connections` nos logs do backend
- Disco do PostgreSQL acima de 80%
- Health check retornando lento ou timeout

### 1.2 Diagnostico

```bash
# Verificar uso de disco
az postgres flexible-server show \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod \
  --query "storage"

# Verificar conexoes ativas
psql "$DATABASE_URL" -c "
  SELECT count(*) as total_connections,
         state,
         wait_event_type
  FROM pg_stat_activity
  GROUP BY state, wait_event_type
  ORDER BY total_connections DESC;
"

# Identificar queries lentas (executando ha mais de 30 segundos)
psql "$DATABASE_URL" -c "
  SELECT pid,
         now() - pg_stat_activity.query_start AS duration,
         query,
         state
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
    AND state != 'idle'
  ORDER BY duration DESC;
"

# Verificar tamanho das tabelas
psql "$DATABASE_URL" -c "
  SELECT schemaname, tablename,
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 20;
"
```

### 1.3 Resolucao

**Passo 1: Matar queries longas (emergencia)**

```bash
# Cancelar queries rodando ha mais de 5 minutos
psql "$DATABASE_URL" -c "
  SELECT pg_cancel_backend(pid)
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
    AND state = 'active'
    AND pid != pg_backend_pid();
"

# Se pg_cancel nao resolver, forcar terminacao
psql "$DATABASE_URL" -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '10 minutes'
    AND state = 'active'
    AND pid != pg_backend_pid();
"
```

**Passo 2: Limpar dados antigos**

```bash
# Remover refresh tokens expirados
psql "$DATABASE_URL" -c "
  DELETE FROM refresh_tokens
  WHERE expires_at < NOW() - interval '7 days'
     OR revoked = true;
"

# Limpar audit logs antigos (manter ultimos 90 dias em producao)
psql "$DATABASE_URL" -c "
  DELETE FROM audit_logs
  WHERE created_at < NOW() - interval '90 days';
"

# VACUUM para liberar espaco
psql "$DATABASE_URL" -c "VACUUM ANALYZE;"
```

**Passo 3: Escalar verticalmente (se necessario)**

```bash
# Aumentar compute tier
az postgres flexible-server update \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod \
  --sku-name Standard_D2ds_v4

# Aumentar armazenamento (IRREVERSIVEL - so aumenta, nao diminui)
az postgres flexible-server update \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod \
  --storage-size 128
```

**Passo 4: Otimizar connection pool**

```
# No Prisma schema ou via DATABASE_URL query params:
# ?connection_limit=20&pool_timeout=10

# Verificar configuracao atual do Prisma
# Em prisma/schema.prisma:
# datasource db {
#   provider = "postgresql"
#   url      = env("DATABASE_URL")
# }
```

---

## 2. Container App Nao Responde

### 2.1 Sintomas
- Health check `GET /health` retornando 502/503 ou timeout
- Usuarios reportando erro ao acessar o sistema
- Azure Monitor alertando sobre falha de disponibilidade

### 2.2 Diagnostico

```bash
# Verificar status do App Service
az webapp show \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --query "{state: state, hostNames: hostNames, usageState: usageState}"

# Ver logs do container (ultimas 200 linhas)
az webapp log tail \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --timeout 30

# Verificar health check manualmente
curl -v https://kegsafe-backend.azurewebsites.net/health

# Verificar metricas de CPU e memoria
az monitor metrics list \
  --resource "/subscriptions/<SUB_ID>/resourceGroups/rg-kegsafe-prod/providers/Microsoft.Web/sites/kegsafe-backend" \
  --metric "CpuPercentage,MemoryPercentage" \
  --interval PT5M \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)"
```

### 2.3 Resolucao

**Passo 1: Restart simples**

```bash
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# Aguardar 30 segundos e verificar
sleep 30
curl -s https://kegsafe-backend.azurewebsites.net/health | jq .
```

**Passo 2: Verificar variaveis de ambiente**

```bash
# Listar app settings (valores mascarados)
az webapp config appsettings list \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --query "[].{name: name}" -o table
```

**Passo 3: Re-deploy da ultima imagem estavel**

```bash
# Forcar pull da imagem latest
az webapp config container set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --container-image-name kegsafeacr.azurecr.io/kegsafe-backend:latest

az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend
```

**Passo 4: Rollback para versao anterior**

```bash
# Listar tags disponiveis no ACR
az acr repository show-tags \
  --name kegsafeacr \
  --repository kegsafe-backend \
  --orderby time_desc \
  --top 10

# Deploy de versao anterior especifica
az webapp config container set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --container-image-name "kegsafeacr.azurecr.io/kegsafe-backend:<SHA_ANTERIOR>"
```

**Passo 5: Escalar para resolver carga**

```bash
# Escalar horizontalmente (mais instancias)
az appservice plan update \
  --resource-group rg-kegsafe-prod \
  --name asp-kegsafe-prod \
  --number-of-workers 3

# Escalar verticalmente (mais recursos por instancia)
az appservice plan update \
  --resource-group rg-kegsafe-prod \
  --name asp-kegsafe-prod \
  --sku P1v3
```

---

## 3. Certificado ou Dominio Expirado

### 3.1 Sintomas
- Navegador mostrando `ERR_CERT_DATE_INVALID`
- Conexoes HTTPS falhando
- Alertas de expiracao do Azure

### 3.2 Diagnostico

```bash
# Verificar certificados vinculados
az webapp config ssl list \
  --resource-group rg-kegsafe-prod \
  --query "[].{name: name, expirationDate: expirationDate, thumbprint: thumbprint}" -o table

# Verificar SSL externo
openssl s_client -connect kegsafe-backend.azurewebsites.net:443 -servername kegsafe-backend.azurewebsites.net </dev/null 2>/dev/null | openssl x509 -noout -dates

# Verificar DNS
nslookup kegsafe-backend.azurewebsites.net
```

### 3.3 Resolucao

**Para certificados gerenciados pelo Azure (*.azurewebsites.net):**
- Renovacao automatica pelo Azure. Se nao renovar, abrir ticket de suporte.

**Para dominio customizado:**

```bash
# 1. Renovar certificado (Let's Encrypt ou CA comercial)
# 2. Upload do novo certificado
az webapp config ssl upload \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --certificate-file /path/to/new-cert.pfx \
  --certificate-password "CERT_PASSWORD"

# 3. Vincular ao hostname
az webapp config ssl bind \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --certificate-thumbprint <NEW_THUMBPRINT> \
  --ssl-type SNI

# 4. Verificar
curl -s https://custom-domain.com/health | jq .
```

**Para DNS nao resolvendo:**

```bash
# Verificar registros DNS
az network dns record-set list \
  --resource-group rg-kegsafe-prod \
  --zone-name kegsafe.com.br \
  -o table

# Atualizar registro CNAME se necessario
az network dns record-set cname set-record \
  --resource-group rg-kegsafe-prod \
  --zone-name kegsafe.com.br \
  --record-set-name api \
  --cname kegsafe-backend.azurewebsites.net
```

---

## 4. Escalamento Horizontal

### 4.1 Quando Escalar

| Metrica | Threshold para Escalar UP | Threshold para Escalar DOWN |
|---------|--------------------------|----------------------------|
| CPU | > 70% por 5 min | < 30% por 15 min |
| Memoria | > 80% por 5 min | < 40% por 15 min |
| Requests/sec | > 100 req/s | < 20 req/s |
| Response time (p95) | > 500ms | < 100ms |

### 4.2 Escalamento do App Service

```bash
# Escalar horizontalmente (numero de instancias)
az appservice plan update \
  --resource-group rg-kegsafe-prod \
  --name asp-kegsafe-prod \
  --number-of-workers 3

# Configurar auto-scale rules
az monitor autoscale create \
  --resource-group rg-kegsafe-prod \
  --resource "/subscriptions/<SUB_ID>/resourceGroups/rg-kegsafe-prod/providers/Microsoft.Web/serverFarms/asp-kegsafe-prod" \
  --name autoscale-kegsafe \
  --min-count 1 \
  --max-count 5 \
  --count 1

# Regra: escalar UP quando CPU > 70%
az monitor autoscale rule create \
  --resource-group rg-kegsafe-prod \
  --autoscale-name autoscale-kegsafe \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 1

# Regra: escalar DOWN quando CPU < 30%
az monitor autoscale rule create \
  --resource-group rg-kegsafe-prod \
  --autoscale-name autoscale-kegsafe \
  --condition "CpuPercentage < 30 avg 15m" \
  --scale in 1
```

### 4.3 Consideracoes para Connection Pool

Ao escalar horizontalmente, cada instancia do backend abre seu proprio pool de conexoes Prisma.

```
Formula: max_connections_postgres >= (connection_limit_prisma * numero_instancias) + overhead

Exemplo:
- Prisma connection_limit = 20
- 3 instancias do backend
- Overhead (migrations, monitoramento) = 10
- Total necessario: (20 * 3) + 10 = 70 conexoes

Verificar max_connections do PostgreSQL:
psql "$DATABASE_URL" -c "SHOW max_connections;"
```

Se necessario aumentar:

```bash
az postgres flexible-server parameter set \
  --resource-group rg-kegsafe-prod \
  --server-name pg-kegsafe-prod \
  --name max_connections \
  --value 200
```

---

## 5. Otimizacao de Custos

### 5.1 Ambientes de Desenvolvimento/Staging

```bash
# Parar recursos fora do horario comercial (economia ~65%)
# Criar Azure Automation Runbook ou usar az CLI com cron

# Parar App Service
az webapp stop \
  --resource-group rg-kegsafe-staging \
  --name kegsafe-backend-staging

# Iniciar App Service
az webapp start \
  --resource-group rg-kegsafe-staging \
  --name kegsafe-backend-staging

# Parar PostgreSQL (staging)
az postgres flexible-server stop \
  --resource-group rg-kegsafe-staging \
  --name pg-kegsafe-staging

# Iniciar PostgreSQL (staging)
az postgres flexible-server start \
  --resource-group rg-kegsafe-staging \
  --name pg-kegsafe-staging
```

### 5.2 Script de Agendamento (Azure Automation)

```bash
# Agendar parada as 20h e inicio as 7h (Brasilia, UTC-3)
# Criar Logic App ou Azure Automation Account

# Exemplo com crontab (se usando VM auxiliar):
# 0 23 * * 1-5 /scripts/stop-staging.sh   # 20h BRT = 23h UTC
# 0 10 * * 1-5 /scripts/start-staging.sh  # 07h BRT = 10h UTC
```

### 5.3 Producao -- Scale to Zero (futuro com Container Apps)

Se migrar para Azure Container Apps (em vez de App Service):

```bash
# Container Apps suporta scale-to-zero nativamente
az containerapp update \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --min-replicas 0 \
  --max-replicas 5

# Cold start: ~3-5 segundos (aceitavel para API com health check)
```

### 5.4 Recomendacoes de Economia

| Acao | Economia Estimada | Impacto |
|------|-------------------|---------|
| Parar staging fora do horario | ~65% do staging | Nenhum em prod |
| Usar Reserved Instances (1 ano) | ~30% em compute | Commitment de 1 ano |
| Revisar SKU do PostgreSQL | Variavel | Avaliar carga real |
| Limpar imagens antigas no ACR | Minima (storage) | Nenhum |
| Usar Azure Spot Instances (staging) | ~60% em staging | Pode ser interrompido |

---

## 6. Rate Limiting Disparado

### 6.1 Sintomas
- Respostas HTTP `429 Too Many Requests`
- Logs mostrando `ThrottlerException`
- Usuarios reportando que nao conseguem acessar

### 6.2 Diagnostico

```bash
# Verificar logs do backend para 429s
az webapp log tail \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --filter "429"

# Verificar se ha padrao de abuso (muitos requests do mesmo IP)
# Nos audit_logs:
psql "$DATABASE_URL" -c "
  SELECT ip_address,
         COUNT(*) as request_count,
         MIN(created_at) as first_request,
         MAX(created_at) as last_request
  FROM audit_logs
  WHERE created_at > NOW() - interval '1 hour'
  GROUP BY ip_address
  ORDER BY request_count DESC
  LIMIT 20;
"
```

### 6.3 Configuracao do ThrottlerModule (NestJS)

```typescript
// app.module.ts - Configuracao atual
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,    // 1 segundo
    limit: 3,      // 3 requests por segundo
  },
  {
    name: 'medium',
    ttl: 10000,   // 10 segundos
    limit: 20,     // 20 requests por 10 segundos
  },
  {
    name: 'long',
    ttl: 60000,   // 1 minuto
    limit: 100,    // 100 requests por minuto
  },
]);
```

### 6.4 Resolucao

**Se e uso legitimo (muitos usuarios simultaneos):**

```typescript
// Aumentar limites no ThrottlerModule
// Alterar em src/app.module.ts
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,
    limit: 10,     // Aumentado de 3 para 10
  },
  {
    name: 'medium',
    ttl: 10000,
    limit: 50,     // Aumentado de 20 para 50
  },
  {
    name: 'long',
    ttl: 60000,
    limit: 200,    // Aumentado de 100 para 200
  },
]);
```

**Se e abuso/ataque:**

```bash
# 1. Identificar IPs ofensores (ver diagnostico acima)

# 2. Bloquear IP no Azure App Service (IP Restrictions)
az webapp config access-restriction add \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --rule-name "block-abuse" \
  --action Deny \
  --ip-address "1.2.3.4/32" \
  --priority 100

# 3. Se o ataque for distribuido, considerar Azure DDoS Protection
# ou Cloudflare/Azure Front Door como proxy

# 4. Revogar tokens do IP suspeito
psql "$DATABASE_URL" -c "
  UPDATE refresh_tokens SET revoked = true
  WHERE ip_address = '1.2.3.4' AND revoked = false;
"
```

**Excecoes de rate limiting por endpoint:**

```typescript
// Para endpoints que precisam de mais throughput (ex: logistics)
@Controller('logistics')
@SkipThrottle() // Desabilita rate limiting global
export class LogisticsController {

  @Post('scan')
  @Throttle({ default: { ttl: 1000, limit: 30 } }) // Rate limit customizado
  scan() { /* ... */ }
}
```

---

## 7. Checklist Geral de Incidentes

Antes de qualquer acao de resolucao:

- [ ] Verificar health check: `curl https://kegsafe-backend.azurewebsites.net/health`
- [ ] Verificar logs: `az webapp log tail --name kegsafe-backend --resource-group rg-kegsafe-prod`
- [ ] Verificar metricas no Azure Monitor
- [ ] Comunicar equipe sobre o incidente
- [ ] Documentar timeline e acoes tomadas

Apos resolucao:

- [ ] Validar todos os endpoints criticos
- [ ] Comunicar resolucao a equipe
- [ ] Criar post-mortem se SEV-1 ou SEV-2
- [ ] Atualizar runbook se procedimento novo foi descoberto

---

*Documento mantido pela equipe de DevOps. Atualizar apos cada incidente com licoes aprendidas.*
