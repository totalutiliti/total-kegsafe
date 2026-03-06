# Plano de Recuperacao de Desastres -- KegSafe Tech

> Procedimentos para recuperacao do sistema KegSafe em cenarios de falha.
> Define RPO, RTO e passos detalhados para cada componente.

**Ultima atualizacao:** 2026-02-28
**Responsavel:** Equipe de Engenharia / DevOps KegSafe

---

## 1. Metricas de Recuperacao

| Metrica | Valor | Justificativa |
|---------|-------|---------------|
| **RPO** (Recovery Point Objective) | 5 minutos | WAL archiving com janela de 5 min |
| **RTO** (Recovery Time Objective) | 30 minutos | Tempo maximo para restauracao completa |
| **MTTR** (Mean Time To Repair) | 15 minutos (alvo) | Para falhas conhecidas e documentadas |

---

## 2. Componentes e Estrategias de Backup

### 2.1 PostgreSQL -- Azure Database for PostgreSQL Flexible Server

| Aspecto | Configuracao |
|---------|-------------|
| **Backups automaticos** | Azure automated daily backups |
| **Retencao** | 7 dias (PITR - Point-In-Time Recovery) |
| **WAL Archiving** | Habilitado, janela de 5 minutos |
| **Regiao** | Brazil South (brazilsouth) |
| **Redundancia** | Zone-redundant (quando disponivel) |

### 2.2 Container Images -- Azure Container Registry

| Aspecto | Configuracao |
|---------|-------------|
| **Registry** | kegsafeacr.azurecr.io |
| **Tags** | `latest` + SHA do commit Git |
| **Retencao de imagens** | Ultimas 10 versoes |
| **Geo-replicacao** | Nao configurada (avaliar para DR cross-region) |

### 2.3 Codigo Fonte

| Aspecto | Configuracao |
|---------|-------------|
| **Repositorio** | GitHub (privado) |
| **Branches protegidas** | `main` (deploy automatico) |
| **Backup** | Inerente ao Git distribuido |

---

## 3. Cenarios de Desastre e Procedimentos

### 3.1 Cenario: Corrupcao ou Perda de Dados no PostgreSQL

**Sintomas:** Dados inconsistentes, tabelas corrompidas, exclusao acidental de dados.

**Procedimento de PITR (Point-In-Time Recovery):**

```bash
# 1. Identificar o timestamp alvo para restauracao
# Analisar logs para encontrar o momento antes do problema
# Formato: YYYY-MM-DDTHH:MM:SSZ (UTC)
RESTORE_POINT="2026-03-05T10:30:00Z"

# 2. Criar um novo servidor a partir do backup PITR
az postgres flexible-server restore \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod-restored \
  --source-server pg-kegsafe-prod \
  --restore-time "$RESTORE_POINT"

# 3. Aguardar conclusao da restauracao (pode levar 10-30 min)
az postgres flexible-server show \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod-restored \
  --query "state"

# 4. Validar dados no servidor restaurado
psql "postgresql://kegsafe_admin:SENHA@pg-kegsafe-prod-restored.postgres.database.azure.com:5432/kegsafe_prod?sslmode=require" \
  -c "SELECT COUNT(*) FROM tenants; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM barrels;"

# 5. Se os dados estao corretos, atualizar a DATABASE_URL
NEW_DB_URL="postgresql://kegsafe_admin:SENHA@pg-kegsafe-prod-restored.postgres.database.azure.com:5432/kegsafe_prod?sslmode=require"

az webapp config appsettings set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --settings DATABASE_URL="$NEW_DB_URL"

# 6. Reiniciar o backend
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# 7. Executar migrations pendentes (se houver)
# Isso sera feito automaticamente pelo CMD do Dockerfile:
# npx prisma migrate deploy

# 8. Validar aplicacao
curl -s https://kegsafe-backend.azurewebsites.net/health | jq .

# 9. Apos validacao, remover servidor antigo (se aplicavel)
# CUIDADO: so fazer isso apos confirmacao completa
# az postgres flexible-server delete \
#   --resource-group rg-kegsafe-prod \
#   --name pg-kegsafe-prod \
#   --yes
```

---

### 3.2 Cenario: Perda Total do Servidor PostgreSQL

**Sintomas:** Servidor nao responde, regiao Azure com falha.

**Procedimento:**

```bash
# 1. Verificar status do servidor
az postgres flexible-server show \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod

# 2. Se o servidor esta indisponivel, restaurar do ultimo backup
az postgres flexible-server restore \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod-dr \
  --source-server pg-kegsafe-prod \
  --restore-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 3. Se a regiao esta indisponivel, criar em regiao alternativa
az postgres flexible-server restore \
  --resource-group rg-kegsafe-dr \
  --name pg-kegsafe-dr \
  --source-server pg-kegsafe-prod \
  --restore-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --location "eastus2"

# 4. Atualizar firewall rules para o novo servidor
az postgres flexible-server firewall-rule create \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod-dr \
  --rule-name allow-azure \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# 5. Atualizar DATABASE_URL e reiniciar (mesmos passos do cenario 3.1)
```

---

### 3.3 Cenario: Container App Nao Responde

**Sintomas:** Health check falhando, 502/503 errors, timeout.

**Procedimento:**

```bash
# 1. Verificar status do App Service
az webapp show \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --query "state"

# 2. Verificar logs recentes
az webapp log tail \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# 3. Tentar restart simples
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# 4. Se restart nao resolver, re-deploy da ultima imagem estavel
az webapp config container set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --container-image-name kegsafeacr.azurecr.io/kegsafe-backend:latest

# 5. Se o problema persiste, fazer deploy de versao anterior
# Encontrar SHA do penultimo commit bem-sucedido
PREVIOUS_SHA=$(git log --format="%H" -n 2 | tail -1)

az webapp config container set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --container-image-name "kegsafeacr.azurecr.io/kegsafe-backend:${PREVIOUS_SHA}"

# 6. Validar
curl -s https://kegsafe-backend.azurewebsites.net/health | jq .
```

---

### 3.4 Cenario: Migracao de Banco Apos Restore

Apos qualquer restore de banco, pode ser necessario executar migrations pendentes.

```bash
# 1. Verificar estado das migrations
# Conectar ao banco restaurado e verificar
psql "$NEW_DB_URL" -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# 2. Se houver migrations pendentes, executar via container temporario
# Opcao A: Restart do container (Dockerfile CMD executa migrate deploy)
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# Opcao B: Executar manualmente via Docker local
docker run --rm \
  -e DATABASE_URL="$NEW_DB_URL" \
  kegsafeacr.azurecr.io/kegsafe-backend:latest \
  npx prisma migrate deploy

# 3. Validar que todas as migrations foram aplicadas
psql "$NEW_DB_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY finished_at DESC;"
```

---

### 3.5 Cenario: Certificado SSL/Dominio Expirado

**Sintomas:** ERR_CERT_DATE_INVALID no navegador, conexoes HTTPS falhando.

```bash
# 1. Verificar status do certificado
az webapp config ssl list \
  --resource-group rg-kegsafe-prod

# 2. Para certificados gerenciados pelo Azure (App Service Managed Certificate)
az webapp config ssl create \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --hostname kegsafe-backend.azurewebsites.net

# 3. Para dominio customizado, renovar e fazer upload
az webapp config ssl upload \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --certificate-file /path/to/new-cert.pfx \
  --certificate-password "CERT_PASSWORD"

# 4. Vincular certificado ao dominio
az webapp config ssl bind \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --certificate-thumbprint <THUMBPRINT> \
  --ssl-type SNI

# 5. Verificar DNS
nslookup kegsafe-backend.azurewebsites.net
dig +short kegsafe-backend.azurewebsites.net
```

---

### 3.6 Cenario: Perda de Acesso ao Azure Container Registry

```bash
# 1. Verificar se o ACR esta acessivel
az acr check-health --name kegsafeacr

# 2. Se o ACR esta indisponivel, reconstruir imagens do codigo fonte
# Clone do repositorio
git clone <REPO_URL> && cd projeto

# Build local
docker build -t kegsafe-backend:emergency ./backend
docker build -t kegsafe-frontend:emergency ./frontend

# 3. Se necessario, criar novo ACR temporario
az acr create \
  --resource-group rg-kegsafe-prod \
  --name kegsafeacrdr \
  --sku Basic

# 4. Push para novo ACR
az acr login --name kegsafeacrdr
docker tag kegsafe-backend:emergency kegsafeacrdr.azurecr.io/kegsafe-backend:latest
docker push kegsafeacrdr.azurecr.io/kegsafe-backend:latest

# 5. Atualizar App Service para usar novo ACR
az webapp config container set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --container-image-name kegsafeacrdr.azurecr.io/kegsafe-backend:latest \
  --container-registry-url https://kegsafeacrdr.azurecr.io \
  --container-registry-user <USER> \
  --container-registry-password <PASSWORD>
```

---

## 4. Plano de Comunicacao Durante Incidentes

### 4.1 Niveis de Severidade

| Nivel | Descricao | Tempo de Resposta | Notificacao |
|-------|-----------|-------------------|-------------|
| **SEV-1** | Sistema completamente indisponivel | 15 min | Equipe toda + stakeholders |
| **SEV-2** | Funcionalidade critica degradada | 30 min | Equipe de engenharia |
| **SEV-3** | Funcionalidade secundaria afetada | 2 horas | Responsavel do modulo |
| **SEV-4** | Impacto minimo, monitorar | Proximo dia util | Registro em ticket |

### 4.2 Canais de Comunicacao

| Canal | Uso |
|-------|-----|
| Grupo WhatsApp/Slack "KegSafe Incidentes" | Comunicacao em tempo real |
| Email devops@kegsafe.com.br | Notificacoes automaticas |
| Status page (futuro) | Comunicacao com clientes |

### 4.3 Template de Comunicacao

```
[SEV-X] KegSafe - Incidente em andamento

IMPACTO: [Descricao do que esta afetado]
INICIO: [Data/Hora UTC]
STATUS: [Investigando / Identificado / Corrigindo / Resolvido]
ETA: [Estimativa de resolucao]

PROXIMOS PASSOS: [O que esta sendo feito]

Atualizacao a cada [15/30/60] minutos.
```

---

## 5. Testes de Recuperacao

### 5.1 Calendario de Testes

| Teste | Frequencia | Responsavel |
|-------|-----------|-------------|
| Restore PITR em ambiente staging | Trimestral | DevOps |
| Rebuild de container do zero | Mensal | DevOps |
| Failover de DNS | Semestral | DevOps |
| Simulacao completa de DR | Anual | Equipe toda |

### 5.2 Checklist de Teste PITR

- [ ] Selecionar ponto de restauracao
- [ ] Executar restore em servidor de teste
- [ ] Validar integridade dos dados (contagem de registros)
- [ ] Executar migrations pendentes
- [ ] Testar endpoints criticos (auth, barrels, logistics)
- [ ] Documentar tempo total de recuperacao
- [ ] Comparar com RTO alvo (30 min)
- [ ] Registrar resultado e melhorias

---

## 6. Dependencias Externas

| Servico | Impacto se indisponivel | Alternativa |
|---------|------------------------|-------------|
| Azure Portal | Nao e possivel gerenciar recursos via UI | Usar Azure CLI local |
| GitHub | Nao e possivel fazer deploy via CI/CD | Build e deploy manual local |
| Azure DNS | Dominio inacessivel | Configurar DNS secundario |
| Let's Encrypt / Azure Cert | Novos certificados nao emitidos | Certificado backup manual |

---

*Documento mantido pela equipe de DevOps. Testar procedimentos de DR trimestralmente e atualizar apos cada incidente real.*
