# Infraestrutura Azure -- KegSafe Tech

> Documentacao da infraestrutura atual do KegSafe no Azure.
> Inclui todos os recursos, configuracoes e recomendacoes de otimizacao.

**Ultima atualizacao:** 2026-02-28
**Responsavel:** Equipe de Engenharia / DevOps KegSafe

---

## 1. Visao Geral da Arquitetura

```
                    Internet
                       |
                    [HTTPS]
                       |
              +--------+--------+
              |                 |
     kegsafe-backend    kegsafe-frontend
     (App Service)      (App Service)
              |
         [PostgreSQL]
     pg-kegsafe-prod
     (Flexible Server)
```

**Fluxo de deploy:**
```
GitHub (push main) --> GitHub Actions --> Build Docker --> Push ACR --> Deploy App Service
```

---

## 2. Recursos Azure

### 2.1 Resource Group

| Propriedade | Valor |
|-------------|-------|
| **Nome** | `rg-kegsafe-prod` |
| **Regiao** | Brazil South (`brazilsouth`) |
| **Tags** | `project=kegsafe`, `environment=production` |

### 2.2 Azure Container Registry (ACR)

| Propriedade | Valor |
|-------------|-------|
| **Nome** | `kegsafeacr` |
| **Login Server** | `kegsafeacr.azurecr.io` |
| **SKU** | Basic |
| **Admin** | Habilitado (para App Service pull) |
| **Repositorios** | `kegsafe-backend`, `kegsafe-frontend` |

**Imagens disponiveis:**
- `kegsafeacr.azurecr.io/kegsafe-backend:latest`
- `kegsafeacr.azurecr.io/kegsafe-backend:<git-sha>`
- `kegsafeacr.azurecr.io/kegsafe-frontend:latest`
- `kegsafeacr.azurecr.io/kegsafe-frontend:<git-sha>`

```bash
# Listar tags recentes
az acr repository show-tags --name kegsafeacr --repository kegsafe-backend --orderby time_desc --top 5
az acr repository show-tags --name kegsafeacr --repository kegsafe-frontend --orderby time_desc --top 5
```

### 2.3 App Service -- Backend

| Propriedade | Valor |
|-------------|-------|
| **Nome** | `kegsafe-backend` |
| **URL** | `https://kegsafe-backend.azurewebsites.net` |
| **App Service Plan** | `asp-kegsafe-prod` (Linux) |
| **Runtime** | Container (node:22-alpine) |
| **Porta** | 8080 |
| **Health Check** | `GET /health` |

**Variaveis de ambiente configuradas:**

| Variavel | Descricao | Origem |
|----------|-----------|--------|
| `NODE_ENV` | `production` | App Settings |
| `PORT` | `8080` | App Settings |
| `DATABASE_URL` | String de conexao PostgreSQL | GitHub Secret > App Settings |
| `JWT_SECRET` | Chave de assinatura JWT | GitHub Secret > App Settings |
| `JWT_EXPIRATION` | `15m` | App Settings |
| `JWT_REFRESH_SECRET` | Chave de assinatura refresh | GitHub Secret > App Settings |
| `JWT_REFRESH_EXPIRATION` | `7d` | App Settings |
| `CORS_ORIGINS` | URL do frontend | GitHub Secret > App Settings |
| `WEBSITES_PORT` | `8080` | App Settings (Azure) |

### 2.4 App Service -- Frontend

| Propriedade | Valor |
|-------------|-------|
| **Nome** | `kegsafe-frontend` |
| **URL** | `https://kegsafe-frontend.azurewebsites.net` |
| **App Service Plan** | `asp-kegsafe-prod` (compartilhado) |
| **Runtime** | Container (Next.js) |
| **Porta** | 8080 |

**Variaveis de ambiente:**

| Variavel | Descricao |
|----------|-----------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `HOSTNAME` | `0.0.0.0` |
| `WEBSITES_PORT` | `8080` |

### 2.5 Azure Database for PostgreSQL

| Propriedade | Valor |
|-------------|-------|
| **Nome** | `pg-kegsafe-prod` |
| **Tipo** | Flexible Server |
| **Versao** | PostgreSQL 16 |
| **SKU** | Burstable (B-series) |
| **Armazenamento** | 32 GB (expansivel) |
| **Backup** | Automatico, 7 dias PITR |
| **SSL** | Obrigatorio (`sslmode=require`) |
| **Regiao** | Brazil South |

**Conexao:**
```
postgresql://<USER>:<PASSWORD>@pg-kegsafe-prod.postgres.database.azure.com:5432/kegsafe_prod?sslmode=require
```

---

## 3. CI/CD -- GitHub Actions

### 3.1 Workflow: `deploy-azure.yml`

**Trigger:** Push na branch `main` ou dispatch manual.

**Jobs:**

```
build-backend  -----> deploy-backend
build-frontend -----> deploy-frontend
```

| Job | Descricao | Duracao Tipica |
|-----|-----------|---------------|
| `build-backend` | Build Docker + push ACR | ~3-5 min |
| `build-frontend` | Build Docker + push ACR (com build args) | ~4-6 min |
| `deploy-backend` | Deploy no App Service + config env vars | ~2-3 min |
| `deploy-frontend` | Deploy no App Service + config env vars | ~2-3 min |

### 3.2 GitHub Secrets Necessarios

| Secret | Descricao |
|--------|-----------|
| `AZURE_CREDENTIALS` | JSON do service principal Azure |
| `ACR_LOGIN_SERVER` | `kegsafeacr.azurecr.io` |
| `ACR_USERNAME` | Username do ACR |
| `ACR_PASSWORD` | Password do ACR |
| `DATABASE_URL` | String de conexao PostgreSQL |
| `JWT_SECRET` | Chave JWT access token |
| `JWT_REFRESH_SECRET` | Chave JWT refresh token |
| `CORS_ORIGINS` | URL do frontend |
| `NEXT_PUBLIC_API_URL` | URL do backend (para build do frontend) |

---

## 4. Tags de Recursos

Todos os recursos Azure devem ter as seguintes tags:

| Tag | Valor | Proposito |
|-----|-------|-----------|
| `project` | `kegsafe` | Identificacao do projeto |
| `environment` | `production` / `staging` / `dev` | Identificacao do ambiente |
| `team` | `engineering` | Equipe responsavel |
| `cost-center` | `kegsafe-ops` | Centro de custo |
| `managed-by` | `github-actions` | Ferramenta de gerenciamento |

```bash
# Aplicar tags ao resource group
az group update \
  --name rg-kegsafe-prod \
  --tags project=kegsafe environment=production team=engineering cost-center=kegsafe-ops managed-by=github-actions
```

---

## 5. Rede e Seguranca

### 5.1 Endpoints

| Servico | Endpoint | Acesso |
|---------|----------|--------|
| Backend API | `https://kegsafe-backend.azurewebsites.net` | Publico (CORS restrito) |
| Frontend | `https://kegsafe-frontend.azurewebsites.net` | Publico |
| PostgreSQL | `pg-kegsafe-prod.postgres.database.azure.com:5432` | Restrito (firewall rules) |
| ACR | `kegsafeacr.azurecr.io` | Privado (credenciais) |

### 5.2 Firewall Rules (PostgreSQL)

```bash
# Permitir acesso dos App Services (Azure services)
az postgres flexible-server firewall-rule create \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod \
  --rule-name allow-azure-services \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Regra temporaria para acesso de desenvolvimento (remover apos uso)
az postgres flexible-server firewall-rule create \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod \
  --rule-name temp-dev-access \
  --start-ip-address <DEV_IP> \
  --end-ip-address <DEV_IP>
```

### 5.3 CORS

Configurado via variavel `CORS_ORIGINS` no backend:
```
CORS_ORIGINS=https://kegsafe-frontend.azurewebsites.net
```

---

## 6. Monitoramento

### 6.1 Health Check

```bash
# Backend
curl -s https://kegsafe-backend.azurewebsites.net/health
# Resposta esperada: { "status": "ok", "timestamp": "..." }
```

### 6.2 Metricas Recomendadas (Azure Monitor)

| Metrica | Alerta Threshold | Acao |
|---------|-----------------|------|
| CPU % (App Service) | > 80% por 5 min | Escalar horizontalmente |
| Memoria % (App Service) | > 85% por 5 min | Investigar memory leak |
| HTTP 5xx | > 10 em 5 min | Verificar logs |
| Response Time (p95) | > 2 segundos | Investigar queries lentas |
| DB Connections | > 80% do max | Aumentar pool ou max_connections |
| Disco PostgreSQL | > 80% | Limpar dados ou expandir |

---

## 7. Recomendacoes de Otimizacao de Custos

### 7.1 Curto Prazo (0-3 meses)

| Acao | Economia Estimada | Esforco |
|------|-------------------|---------|
| Implementar start/stop de staging fora do horario | ~65% staging | Baixo |
| Revisar SKU do App Service Plan (usar B1 se suficiente) | Variavel | Baixo |
| Limpar imagens antigas no ACR (manter ultimas 10) | Minima | Baixo |
| Habilitar logs de diagnostico apenas em warning+ | Minima | Baixo |

### 7.2 Medio Prazo (3-6 meses)

| Acao | Economia Estimada | Esforco |
|------|-------------------|---------|
| Reserved Instances para App Service (1 ano) | ~30% | Medio |
| Migrar para Azure Container Apps (scale-to-zero) | Variavel | Alto |
| Implementar CDN (Azure Front Door) para frontend | Melhora perf, custo similar | Medio |
| Usar Azure Key Vault references (em vez de App Settings) | Seguranca, custo similar | Medio |

### 7.3 Longo Prazo (6-12 meses)

| Acao | Economia Estimada | Esforco |
|------|-------------------|---------|
| Multi-region deploy (DR ativo) | Custo aumenta, mas melhora SLA | Alto |
| Implementar cache com Azure Cache for Redis | Reduz carga no DB | Alto |
| Azure DevOps ou GitHub Advanced Security | Seguranca, custo adicional | Medio |

---

## 8. Diagrama de Recursos

```
rg-kegsafe-prod/
|
|-- kegsafeacr (Container Registry)
|   |-- kegsafe-backend (repository)
|   +-- kegsafe-frontend (repository)
|
|-- asp-kegsafe-prod (App Service Plan, Linux)
|   |-- kegsafe-backend (App Service, Container)
|   +-- kegsafe-frontend (App Service, Container)
|
|-- pg-kegsafe-prod (PostgreSQL Flexible Server)
|   +-- kegsafe_prod (database)
|
+-- (futuro) kv-kegsafe-prod (Key Vault)
```

---

*Documento mantido pela equipe de DevOps. Atualizar sempre que novos recursos forem provisionados ou configuracoes alteradas.*
