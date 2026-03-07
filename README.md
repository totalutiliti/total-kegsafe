# KegSafe Tech

**Sistema SaaS Multi-Tenant de Gestao Inteligente de Barris**

Plataforma completa para rastreamento logistico, manutencao preditiva e controle patrimonial de barris (kegs) com isolamento por tenant.

---

## Visao Geral

O KegSafe Tech permite que cervejarias e distribuidoras gerenciem toda a frota de barris de forma digital: desde a criacao em lote ate o descarte, passando por operacoes logisticas (expedicao, entrega, coleta, recebimento), manutencao preventiva/corretiva e monitoramento de saude dos componentes.

### Principais Funcionalidades

- **Multi-Tenancy** — Isolamento completo de dados por empresa (tenant)
- **Gestao de Barris** — Cadastro, QR Code, ciclos de vida, saude dos componentes
- **Logistica** — 4 operacoes (Expedicao, Entrega, Coleta, Recebimento) via app mobile
- **Manutencao** — Ordens de Servico (Preventiva, Corretiva, Preditiva) com calendario
- **Alertas** — Monitoramento automatico de fim de vida util, ociosidade, geofence
- **Descarte** — Fluxo de aprovacao com calculo de TCO e sugestao automatica
- **Relatorios** — 6 modulos com graficos interativos e exportacao CSV
- **Geofences** — Zonas geograficas para validacao de operacoes logisticas
- **Controle de Acesso** — 4 perfis (Admin, Gestor, Manutencao, Logistica) + Super Admin
- **Manual Integrado** — Documentacao in-app com conteudo filtrado por perfil

---

## Tech Stack

| Camada | Tecnologia |
|---|---|
| **Backend** | NestJS 11, TypeScript, Prisma 7, PostgreSQL 16 |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, Zustand, React Query |
| **Autenticacao** | JWT + Refresh Tokens, Passport |
| **Infra** | Docker, Azure App Service, Azure Container Registry |
| **CI/CD** | GitHub Actions (lint, test, build, deploy) |
| **Storage** | Azure Blob Storage |
| **Cache** | Redis |
| **Email** | SendGrid |
| **Monitoramento** | Azure Application Insights, Winston |

---

## Pre-requisitos

- **Node.js** >= 20
- **Docker** e **Docker Compose**
- **Git**

---

## Instalacao e Execucao Local

### 1. Clonar o repositorio

```bash
git clone <url-do-repositorio>
cd projeto
```

### 2. Configurar variaveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas configuracoes. As principais variaveis:

```env
# Banco de dados
DATABASE_URL=postgresql://kegsafe:kegsafe123@localhost:5439/kegsafe
POSTGRES_USER=kegsafe
POSTGRES_PASSWORD=kegsafe123
POSTGRES_DB=kegsafe

# JWT
JWT_SECRET=sua-chave-secreta
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=sua-chave-refresh
JWT_REFRESH_EXPIRES_IN=7d

# App
NODE_ENV=development
PORT=3009
CORS_ORIGINS=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3009
```

### 3. Subir o PostgreSQL

```bash
docker-compose up -d
```

### 4. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Configurar o banco de dados

```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 6. Iniciar os servidores

```bash
# Terminal 1 — Backend (porta 3009)
cd backend
npm run start:dev

# Terminal 2 — Frontend (porta 3000)
cd frontend
npm run dev
```

### 7. Acessar o sistema

Abra **http://localhost:3000** no navegador.

#### Credenciais de teste

| Perfil | Email | Senha |
|---|---|---|
| **Admin** | admin@petropolis.com.br | Admin@123 |
| **Gestor** | gestor@petropolis.com.br | Gestor@123 |
| **Logistica** | logistica@petropolis.com.br | Logistica@123 |
| **Manutencao** | manutencao@petropolis.com.br | Manutencao@123 |
| **Super Admin** | superadmin@kegsafe.com.br | SuperAdmin@123 |

---

## Estrutura do Projeto

```
projeto/
├── backend/                  # API NestJS
│   ├── src/
│   │   ├── auth/             # Autenticacao JWT + Guards
│   │   ├── barrels/          # CRUD de barris
│   │   ├── logistics/        # Operacoes logisticas
│   │   ├── maintenance/      # Ordens de servico
│   │   ├── alerts/           # Sistema de alertas
│   │   ├── clients/          # Gestao de clientes/PDVs
│   │   ├── geofences/        # Zonas geograficas
│   │   ├── disposal/         # Fluxo de descarte
│   │   ├── reports/          # Relatorios e analytics
│   │   ├── components/       # Configuracao de componentes
│   │   ├── users/            # Gestao de usuarios
│   │   ├── tenants/          # Gestao multi-tenant
│   │   ├── audit/            # Logs de auditoria
│   │   ├── barrel-batches/   # Lotes de barris
│   │   └── barrel-transfer/  # Transferencia entre tenants
│   ├── prisma/
│   │   ├── schema.prisma     # Schema do banco (25 modelos)
│   │   └── seed.ts           # Dados iniciais
│   └── Dockerfile
├── frontend/                 # Web App Next.js
│   ├── app/
│   │   ├── (dashboard)/      # Paginas do tenant
│   │   │   ├── dashboard/    # Visao geral com KPIs
│   │   │   ├── barrels/      # Gestao de barris
│   │   │   ├── logistics/    # Painel logistico
│   │   │   ├── maintenance/  # Ordens de servico
│   │   │   ├── alerts/       # Central de alertas
│   │   │   ├── clients/      # Clientes/PDVs
│   │   │   ├── geofences/    # Zonas geograficas
│   │   │   ├── disposal/     # Descarte
│   │   │   ├── reports/      # Relatorios
│   │   │   ├── settings/     # Usuarios e Componentes
│   │   │   └── manual/       # Manual do usuario
│   │   └── (superadmin)/     # Paginas do Super Admin
│   │       └── superadmin/
│   │           ├── tenants/
│   │           ├── barrel-batches/
│   │           ├── barrel-transfer/
│   │           ├── audit/
│   │           └── manual/
│   ├── components/           # Componentes reutilizaveis
│   ├── lib/                  # Utils, API client, stores
│   └── Dockerfile
├── .github/workflows/        # CI/CD
│   ├── ci.yml                # Lint + Test + Build
│   └── deploy-azure.yml      # Deploy para Azure
├── docker-compose.yml        # PostgreSQL local
├── docker-compose.prod.yml   # Producao
└── .env.example              # Template de variaveis
```

---

## Perfis de Acesso

| Perfil | Acesso |
|---|---|
| **Admin** | Acesso total: Dashboard, Barris, Logistica, Manutencao, Alertas, Clientes, Geofences, Descarte, Relatorios, Usuarios, Componentes |
| **Gestor** | Dashboard, Barris, Manutencao, Alertas, Clientes, Geofences, Descarte, Relatorios |
| **Manutencao** | Barris (consulta), Manutencao, Alertas |
| **Logistica** | Barris (consulta), Logistica |
| **Super Admin** | Tenants, Lotes de Barris, Transferencias, Auditoria |

---

## Modelo de Dados

O sistema possui **25 modelos** organizados em:

- **Core** — Tenant, User, RefreshToken
- **Ativos** — Barrel, ComponentConfig, ComponentCycle, BarrelSequence, BarrelBatch
- **Operacoes** — LogisticsEvent, MaintenanceOrder, MaintenanceLog, MaintenanceItem, Triage
- **Monitoramento** — Alert, Geofence, Disposal
- **Negocios** — Client, Supplier, ServiceProvider
- **Auditoria** — AuditLog, SuperAdminAuditLog, IdempotencyKey

---

## Scripts Uteis

### Backend

```bash
npm run start:dev        # Iniciar em modo desenvolvimento
npm run build            # Build de producao
npm run start:prod       # Iniciar em producao
npm run lint             # Executar ESLint
npm run test             # Executar testes unitarios
npm run test:e2e         # Executar testes E2E
npx prisma studio        # Abrir Prisma Studio (GUI do banco)
npx prisma db seed       # Popular banco com dados de teste
```

### Frontend

```bash
npm run dev              # Iniciar em modo desenvolvimento
npm run build            # Build de producao
npm run start            # Iniciar em producao
npm run lint             # Executar ESLint
```

---

## Deploy

O projeto utiliza **GitHub Actions** para CI/CD:

1. **CI** (`ci.yml`) — Executa em PRs para `dev` e `main`:
   - Lint (ESLint)
   - Testes unitarios e de integracao
   - Build de producao

2. **Deploy** (`deploy-azure.yml`) — Executa no push para `main`:
   - Build das imagens Docker
   - Push para Azure Container Registry
   - Deploy no Azure App Service

### Infraestrutura Azure

| Servico | Recurso |
|---|---|
| Backend | Azure App Service (kegsafe-backend) |
| Frontend | Azure App Service (kegsafe-frontend) |
| Banco | PostgreSQL (Azure ou Docker) |
| Imagens | Azure Container Registry |
| Storage | Azure Blob Storage |
| Monitoramento | Application Insights |

---

## Documentacao Adicional

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Arquitetura detalhada do sistema
- [`CRITICAL_FLOWS.md`](./CRITICAL_FLOWS.md) — Fluxos criticos de negocio
- [`PRD.md`](./PRD.md) — Documento de requisitos do produto
- **Manual in-app** — Acessivel pelo menu lateral dentro do sistema

---

## Licenca

Projeto proprietario. Todos os direitos reservados.
