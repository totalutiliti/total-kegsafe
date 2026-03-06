# ADR-003: Estrategia de Deploy

## Status
Accepted

## Data
2026-02-28

## Contexto

O KegSafe precisa de uma estrategia de deploy que suporte:

- Containers Docker para backend (NestJS) e frontend (Next.js)
- CI/CD automatizado a partir do repositorio Git
- Escalabilidade horizontal para atender picos de uso
- Custo adequado para uma startup/produto em fase inicial
- Migrations de banco automaticas no deploy
- Rollback rapido em caso de problema
- SSL/TLS automatico

A equipe tem experiencia com Azure e o projeto ja esta no ecossistema Microsoft.

## Decisao

**Adotar Azure App Service com containers Docker, CI/CD via GitHub Actions, e Azure Container Registry (ACR) para armazenamento de imagens.**

### Arquitetura de Deploy

```
GitHub Repository
    |
    | push to main
    v
GitHub Actions (deploy-azure.yml)
    |
    |-- Build backend Docker image --> Push to ACR
    |-- Build frontend Docker image --> Push to ACR
    |
    |-- Deploy backend to App Service (from ACR)
    +-- Deploy frontend to App Service (from ACR)
```

### Dockerfile -- Backend (Multi-stage Build)

```dockerfile
# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
```

**Pontos chave:**
- Multi-stage build reduz imagem final (apenas runtime + dist)
- `prisma migrate deploy` executa automaticamente no startup do container
- Porta 8080 (padrao Azure App Service)
- Base `node:22-alpine` para imagem minima

### CI/CD -- GitHub Actions

O workflow `deploy-azure.yml` executa:

1. **Build paralelo:** Backend e frontend sao construidos simultaneamente
2. **Push para ACR:** Imagens tagueadas com `latest` e SHA do commit
3. **Deploy sequencial:** Backend e frontend deployados apos build
4. **Configuracao de env vars:** App Settings atualizados via `azure/appservice-settings`

### Estrategia de Tags

| Tag | Uso |
|-----|-----|
| `latest` | Sempre aponta para o ultimo build bem-sucedido |
| `<git-sha>` | Versao especifica para rollback |

### Rollback

```bash
# Identificar versao anterior
az acr repository show-tags --name kegsafeacr --repository kegsafe-backend --orderby time_desc --top 5

# Fazer rollback
az webapp config container set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --container-image-name "kegsafeacr.azurecr.io/kegsafe-backend:<SHA_ANTERIOR>"
```

## Trade-offs

### Azure App Service vs Azure Container Apps

| Aspecto | App Service (escolhido) | Container Apps |
|---------|------------------------|----------------|
| **Scale-to-zero** | Nao suporta (minimo 1 instancia) | Suporta (economia em baixo uso) |
| **Complexidade** | Simples, UI amigavel | Mais complexo (Dapr, KEDA) |
| **Custo base** | Fixo (App Service Plan) | Pay-per-use (mais barato em baixo uso) |
| **SSL gerenciado** | Sim (gratuito para *.azurewebsites.net) | Sim |
| **Custom domains** | Sim, com certificados gerenciados | Sim |
| **Health checks** | Sim, configuravel | Sim, com liveness/readiness probes |
| **Maturidade** | Muito maduro | Relativamente novo |

**Motivo da escolha:** App Service e mais simples de operar, a equipe ja tem experiencia, e o custo fixo e aceitavel na fase atual. Migrar para Container Apps e uma opcao para o futuro (ver MATURITY-ROADMAP.md).

### GitHub Actions vs Azure DevOps

| Aspecto | GitHub Actions (escolhido) | Azure DevOps |
|---------|---------------------------|-------------|
| **Integracao com repo** | Nativa (mesmo GitHub) | Requer conexao |
| **Marketplace** | Amplo (actions de terceiros) | Amplo (extensions) |
| **Custo** | Gratuito para repos publicos, 2000 min/mes privados | Gratuito ate 1800 min/mes |
| **Complexidade** | YAML simples | YAML mais verboso |

**Motivo da escolha:** Repositorio ja esta no GitHub, integracao nativa e mais simples.

## Consequencias

### Positivas

- Deploy automatico a cada push na `main` (zero intervencao manual)
- Rollback rapido via tag de imagem
- Migrations automaticas no startup do container
- Build paralelo de backend e frontend (CI mais rapido)
- Imagens Docker versionadas e imutaveis

### Negativas

- Custo fixo do App Service Plan (mesmo com baixo uso)
- Sem blue/green deployment nativo (possivel com deployment slots, mas complexo)
- `prisma migrate deploy` no startup adiciona tempo ao cold start (~5-10s)
- Se a migration falhar, o container nao inicia (requer intervencao manual)

### Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|----------|
| Migration falha no deploy | Testar migrations em staging antes de merge na main |
| ACR indisponivel | Imagens podem ser rebuilds do codigo fonte |
| GitHub Actions indisponivel | Deploy manual via Azure CLI |
| Secret vazado no CI | Secrets armazenados no GitHub Secrets (criptografados) |

## Alternativas Consideradas

| Alternativa | Motivo da Rejeicao |
|-------------|-------------------|
| Azure Container Apps | Mais complexo, equipe sem experiencia, custo similar em uso constante |
| Azure Kubernetes Service (AKS) | Overkill para o tamanho atual do projeto |
| Heroku | Custo mais alto, menos controle, sem presenca no Brasil |
| Vercel (frontend) + Railway (backend) | Fragmentacao de plataformas, sem Azure native |
| Deploy direto sem Docker | Menos reproducivel, depende de ambiente |

## Referencias

- [Azure App Service Containers](https://docs.microsoft.com/en-us/azure/app-service/configure-custom-container)
- [GitHub Actions for Azure](https://github.com/Azure/actions)
- [Prisma Migrate Deploy](https://www.prisma.io/docs/concepts/components/prisma-migrate/migrate-deploy)
