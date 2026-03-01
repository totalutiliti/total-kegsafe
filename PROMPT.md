# KegSafe Tech — Prompt para Antigravity

## Contexto do Projeto

Você está desenvolvendo o **KegSafe Tech**, um sistema SaaS multi-tenant de gestão completa do ciclo de vida de barris de chopp para cervejarias. O sistema combina rastreamento logístico passivo (via QR Code com geolocalização) e manutenção preditiva/preventiva de componentes, transformando barris em ativos digitais rastreáveis.

O projeto é destinado inicialmente à **Cervejaria Petrópolis** como cliente-piloto, mas deve ser construído como plataforma multi-tenant escalável para qualquer cervejaria.

## Stack Tecnológica

- **Backend:** NestJS (TypeScript), Prisma ORM, PostgreSQL com Row-Level Security (multi-tenant)
- **Frontend Web (Dashboard):** Next.js 14+ (App Router), Tailwind CSS, shadcn/ui
- **App Mobile (Operacional):** React Native com Expo
- **Infraestrutura:** Azure Container Apps, Azure Database for PostgreSQL Flexible Server
- **Autenticação:** JWT com refresh tokens, RBAC (Role-Based Access Control)
- **Notificações:** Push notifications (Firebase Cloud Messaging), E-mail (SendGrid/Azure Communication Services)
- **Armazenamento de imagens:** Azure Blob Storage

## Arquitetura Multi-Tenant

- Cada cervejaria é um `tenant` isolado via RLS no PostgreSQL.
- Todas as tabelas principais possuem coluna `tenantId` com policy de RLS.
- O `tenantId` é extraído do JWT e injetado no contexto do Prisma via middleware.

## Perfis de Acesso (RBAC)

1. **LOGISTICS** — Operadores de campo (carga/descarga): Menus 1-4, leitura de QR Code
2. **MAINTENANCE** — Técnicos de manutenção: Menu 6, checklist de componentes, registro de OS
3. **MANAGER** — Gestores: Dashboard gerencial, relatórios, alertas, aprovação de descarte
4. **ADMIN** — Administrador do tenant: Cadastros, configuração de alertas, gestão de usuários

## Módulos Principais

### 1. Cadastro de Ativos (Barris)
- Identificação única (ID interno + QR Code + código de barras)
- Dados técnicos: fabricante, modelo de válvula, capacidade (L), peso tara, material, datas
- Custo de aquisição para cálculo de ROI e TCO
- Contador de envases (incrementado automaticamente)
- Status: Ativo, Em Trânsito, No Cliente, Em Manutenção, Descartado, Extraviado

### 2. Rastreamento Logístico Passivo (4 Inputs de Geolocalização)
- **Input 1 — Expedição:** Barril cheio sai da fábrica → scan QR Code → captura timestamp + GPS
- **Input 2 — Entrega:** Barril chega no cliente → scan QR Code → vincula ao PDV/CNPJ
- **Input 3 — Coleta:** Barril vazio retirado do cliente → scan QR Code → registro de retorno
- **Input 4 — Recebimento:** Barril vazio chega na fábrica → scan QR Code → incrementa ciclo

### 3. Central de Manutenção (Menu 6)
- **Componentes pré-cadastrados:** Sifão, O-Ring, Válvula Principal, Corpo (Inox), Chimb, Válvula de Segurança
- **Tipos de manutenção:** Preventiva, Corretiva, Preditiva
- **Checklist "Zero Digitação":** Operador marca checkboxes, sistema captura metadata automaticamente
- **Semáforo de componentes:** Verde (OK), Amarelo (atenção), Vermelho (crítico)
- **Contador de ciclos por componente:** Reseta ao registrar troca
- **Ordem de Serviço automática:** Gerada ao atingir limite de ciclos

### 4. Sistema de Alertas Inteligentes
- **Manutenção:** Fim de ciclo de vida de componente, inspeção obrigatória
- **Logística:** Barril ocioso no cliente (>15 dias), barril parado no pátio (>7 dias)
- **Segurança:** Violação de geofencing, movimentação fora de horário
- **Fornecedores:** SLA de manutenção externa vencido

### 5. Dashboard Gerencial
- Custo de Manutenção por Litro (métrica de ouro)
- Saúde da Frota (disponíveis, em campo, em manutenção, críticos)
- Prejuízo por extravio
- Ranking de prestadores (MTTR, retrabalho, custo médio)
- Giro de Ativos (ciclo médio)
- Previsão de CAPEX (reposição de frota)

### 6. Gestão de Descarte
- TCO acumulado vs. custo de barril novo (fator K = 0.6~0.7)
- Frequência crítica de falhas (>3 corretivas em 12 meses)
- Bloqueio por dano estrutural grave
- Fluxo: Sugestão → Validação técnica → Aprovação gerencial → Registro de destino

### 7. Modo Triagem Rápida
- No recebimento (Input 4), antes do envase
- Check rápido: Íntegro → segue para lavagem | Avaria → bloqueia e direciona para manutenção

## Regras de Negócio Críticas

1. Cada scan de QR Code DEVE capturar: `barrelId`, `userId`, `timestamp`, `latitude`, `longitude`, `actionType`
2. Incrementar contador de ciclos de TODOS os componentes do barril a cada passagem pelo Input 4
3. Geolocalização por inferência: a lat/long do scan determina se é fábrica, cliente ou trânsito via geofencing
4. Nenhum barril com componente em status "Vermelho" pode ser liberado para envase
5. Alertas preditivos rodam via job scheduled (CRON) diariamente
6. Relatório executivo PDF semanal enviado automaticamente ao perfil MANAGER

## Convenções de Código

- Nomenclatura de arquivos: kebab-case
- Nomenclatura de classes/interfaces: PascalCase
- Nomenclatura de variáveis/funções: camelCase
- Módulos NestJS organizados por domínio: `barrel/`, `maintenance/`, `logistics/`, `alert/`, `dashboard/`, `tenant/`, `user/`
- DTOs com class-validator
- Documentação de API com Swagger/OpenAPI
- Testes unitários com Jest, testes e2e com Supertest
- Migrations gerenciadas pelo Prisma

## Fase de Desenvolvimento

Este é o **MVP (Fase 1)**, focado em:
- 6 menus principais (Expedição, Entrega, Coleta, Recebimento, Gerencial, Manutenção)
- Rastreamento GPS passivo via QR Code
- Registro de manutenção via checklist
- Alerta de extravio e geofencing básico
- Dashboard simplificado de saúde da frota

**NÃO inclua na Fase 1:** Integração com ERP, monitoramento de pressão/volume IoT, IA para análise de imagem de danos, gestão de contratos de fornecedores.
