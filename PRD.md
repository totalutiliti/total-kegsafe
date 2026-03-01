# PRD.md — KegSafe Tech — Product Requirements Document

## 1. Resumo Executivo

**Produto:** KegSafe Tech — Sistema de Gestão de Ativos e Rastreamento Inteligente de Barris de Chopp

**Problema:** Cervejarias sofrem com o "Triângulo das Bermudas" logístico — barris desaparecem sem rastro, manutenções são negligenciadas, e o risco de explosão de vasos de pressão sem controle gera prêmios de seguro elevados. Não há visibilidade sobre onde estão os ativos nem em que estado se encontram.

**Solução:** Plataforma SaaS que digitaliza o ciclo de vida completo do barril — do nascimento (cadastro) à aposentadoria (descarte) — através de rastreamento passivo por QR Code com geolocalização e manutenção preditiva baseada em contadores de ciclo.

**Cliente-alvo inicial:** Cervejaria Petrópolis

**Modelo de negócio:** SaaS multi-tenant com cobrança mensal por ativo rastreado

## 2. Objetivos do Produto

### Objetivos de Negócio
- Reduzir perda/extravio de barris em pelo menos 40%
- Eliminar envase de barris com componentes vencidos (zero falhas de segurança)
- Reduzir custo de manutenção por litro em 20% no primeiro ano
- Permitir renegociação de apólices de seguro industrial com dados de compliance

### Objetivos do Usuário
- Operador de campo: completar scan em menos de 3 segundos por barril
- Técnico de manutenção: registrar manutenção sem digitar nada (apenas checkboxes)
- Gestor: ter visão em tempo real da saúde e localização de toda a frota

### Métricas de Sucesso (KPIs)
- Taxa de adoção: 80% dos barris rastreados em 3 meses
- Tempo médio de scan: < 3 segundos
- Alertas preventivos acionados antes da falha: > 90%
- NPS dos operadores de campo: > 7

### Métricas de Sucesso por Feature (Detalhado)

| Feature | Métrica Primária | Meta | Métrica Secundária | Meta |
|---------|------------------|------|-------------------|------|
| **Cadastro de Ativos** | Taxa de cadastro completo | 100% dos barris em 30 dias | Tempo médio de cadastro | < 2 min/barril |
| **Scan QR Code** | Tempo end-to-end | < 3 segundos | Taxa de sucesso no primeiro scan | > 95% |
| **Modo Metralhadora** | Barris/minuto | > 20 barris/min | Erro de leitura | < 1% |
| **Manutenção Checklist** | Tempo de preenchimento | < 60 segundos | Taxa de checkboxes vs digitação | > 95% checkbox |
| **Alertas Preditivos** | Precisão (true positives) | > 90% | Tempo antes da falha | > 7 dias |
| **Geofencing** | Taxa de detecção | > 99% | Falsos positivos | < 5% |
| **Dashboard** | Tempo de carregamento | < 2 segundos | Taxa de uso diário MANAGER | > 80% |
| **Relatório PDF** | Geração automática | 100% domingo 08:00 | Taxa de abertura email | > 60% |

## 3. Personas

### P1: Operador de Logística ("O Peão")
- Perfil: Trabalha no carregamento/descarregamento, usa luvas, ambiente úmido
- Necessidade: App simples, botões grandes, scan rápido, mínima interação
- Frustrações: Apps lentos, muita digitação, telas confusas

### P2: Técnico de Manutenção
- Perfil: Responsável pela inspeção e reparo dos barris
- Necessidade: Saber o histórico do barril ao escaneá-lo, checklist rápido
- Frustrações: Fichas de papel que se perdem, não saber o que já foi feito

### P3: Gestor de Operações
- Perfil: Gerente que precisa de visão consolidada da frota
- Necessidade: Dashboard com métricas financeiras, alertas proativos, relatórios
- Frustrações: Planilhas manuais, não saber quantos barris estão em campo

### P4: Administrador (TI da Cervejaria)
- Perfil: Responsável pela configuração do sistema
- Necessidade: Cadastros, permissões, integrações futuras
- Frustrações: Sistemas engessados, sem customização

## 4. User Stories — MVP (Fase 1)

### Epic 1: Cadastro de Ativos

#### US-01: Cadastro de Barril
**Como** ADMIN, **quero** cadastrar um barril com seus dados técnicos **para que** ele seja rastreável no sistema.

**Critérios de Aceitação:**
- [ ] Formulário deve conter: código interno, QR code, fabricante, modelo válvula, capacidade (L), peso tara (kg), material, data compra, custo aquisição
- [ ] Código interno deve seguir padrão: `KS-BAR-NNNNN` (auto-gerado)
- [ ] QR Code deve ser único por tenant
- [ ] Capacidade aceita valores: 10, 20, 30, 50 litros
- [ ] Ao salvar, sistema deve criar ComponentCycle para cada ComponentConfig ativo do tenant
- [ ] Barril deve iniciar com status `ACTIVE` e `totalCycles = 0`
- [ ] Validação de CNPJ do fabricante (se informado)
- [ ] Campos obrigatórios: código interno, QR code, capacidade, material

---

#### US-02: Vinculação de QR Code
**Como** ADMIN, **quero** vincular um QR Code a um barril **para que** ele possa ser identificado por scan.

**Critérios de Aceitação:**
- [ ] QR Code pode ser inserido manualmente ou escaneado via câmera
- [ ] Sistema deve validar se QR Code já existe no tenant
- [ ] Se QR Code já vinculado, exibir erro com link para o barril existente
- [ ] QR Code deve aceitar formato: alfanumérico, 6-20 caracteres
- [ ] Permitir revinculação somente se barril anterior estiver `DISPOSED`
- [ ] Registrar evento de vinculação no AuditLog

---

#### US-03: Cadastro de Clientes (PDVs)
**Como** ADMIN, **quero** cadastrar clientes (PDVs) com CNPJ e localização GPS **para que** validar entregas.

**Critérios de Aceitação:**
- [ ] Campos: razão social, nome fantasia, CNPJ, telefone, email, endereço completo, lat/lng
- [ ] CNPJ deve ser validado (dígitos verificadores)
- [ ] CNPJ deve ser único por tenant
- [ ] Lat/Lng podem ser preenchidos via mapa ou busca de endereço (geocoding)
- [ ] Ao salvar, criar automaticamente Geofence tipo `CLIENT` com raio padrão 500m
- [ ] Campo `connectorType` para tipo de extratora (dropdown)
- [ ] Cliente inicia com `isActive = true`

---

#### US-04: Cadastro de Fornecedores
**Como** ADMIN, **quero** cadastrar fornecedores e prestadores de serviço **para que** rastrear custos.

**Critérios de Aceitação:**
- [ ] Fornecedores: nome, CNPJ, tipo suprimento (enum), lead time, email, telefone, condições pagamento
- [ ] Prestadores: nome, especialidade, certificações, valor hora, valor serviço, rating inicial
- [ ] Tipo suprimento: Barris, Peças, Gases, Limpeza, Outros
- [ ] Rating de prestador: 1.00 a 5.00 (2 decimais)
- [ ] CNPJ único por tenant (entre fornecedores E prestadores)
- [ ] Campos obrigatórios: nome, tipo/especialidade

---

#### US-05: Gestão de Usuários
**Como** ADMIN, **quero** criar e gerenciar usuários com perfis de acesso definidos **para que** controlar quem faz o quê.

**Critérios de Aceitação:**
- [ ] Campos: nome, email, senha, telefone, role
- [ ] Email único por tenant
- [ ] Roles disponíveis: LOGISTICS, MAINTENANCE, MANAGER, ADMIN
- [ ] Senha mínimo 8 caracteres, 1 maiúscula, 1 número
- [ ] ADMIN pode criar qualquer role; MANAGER pode criar LOGISTICS e MAINTENANCE
- [ ] Possibilidade de desativar usuário (soft disable)
- [ ] Não permitir desativar último ADMIN do tenant
- [ ] Email de boas-vindas enviado ao criar usuário

---

### Epic 2: Rastreamento Logístico

#### US-06: Scan em Lote (Modo Metralhadora)
**Como** LOGISTICS, **quero** escanear QR Codes em lote ao carregar o caminhão **para que** registrar a expedição rapidamente.

**Critérios de Aceitação:**
- [ ] Selecionar operação ANTES de iniciar scans (EXPEDITION)
- [ ] Câmera permanece ativa entre scans
- [ ] Feedback sonoro + vibração a cada scan válido
- [ ] Feedback visual (cor verde) + contagem de barris
- [ ] Scan duplicado na mesma sessão: ignorar com feedback amarelo
- [ ] Barril com status incompatível: erro vermelho + motivo
- [ ] GPS capturado automaticamente (único por sessão)
- [ ] Botão "Finalizar Lote" para enviar todos de uma vez
- [ ] Funcionar offline com sync posterior
- [ ] Tempo entre scans: < 1 segundo

---

#### US-07: Registro de Entrega (Input 2)
**Como** LOGISTICS, **quero** escanear o QR Code ao descarregar no cliente **para que** registrar a entrega com GPS automático.

**Critérios de Aceitação:**
- [ ] Barril deve estar com status `IN_TRANSIT`
- [ ] GPS capturado automaticamente no momento do scan
- [ ] Sistema infere cliente pela proximidade com Geofences cadastradas (raio 500m)
- [ ] Se múltiplos clientes próximos, exibir lista para seleção
- [ ] Se nenhum cliente próximo, permitir selecionar manualmente OU criar novo
- [ ] Status muda para `AT_CLIENT`
- [ ] Registrar `clientId` no evento
- [ ] Exibir confirmação visual com nome do cliente

---

#### US-08: Registro de Coleta (Input 3)
**Como** LOGISTICS, **quero** escanear ao retirar barris vazios do cliente **para que** registrar a coleta.

**Critérios de Aceitação:**
- [ ] Barril deve estar com status `AT_CLIENT`
- [ ] GPS capturado automaticamente
- [ ] Status muda para `IN_TRANSIT`
- [ ] Manter referência ao `clientId` da entrega anterior
- [ ] Validar que localização está próxima do cliente registrado (warning se > 1km)
- [ ] Permitir adicionar nota opcional (ex: "barril danificado")

---

#### US-09: Registro de Recebimento (Input 4)
**Como** LOGISTICS, **quero** escanear ao descarregar vazios na fábrica **para que** registrar o recebimento.

**Critérios de Aceitação:**
- [ ] Barril deve estar com status `IN_TRANSIT`
- [ ] GPS capturado automaticamente
- [ ] Validar que localização está dentro de Geofence tipo `FACTORY`
- [ ] Status muda para `ACTIVE`
- [ ] **CRÍTICO:** Incrementar `totalCycles` do barril em +1
- [ ] **CRÍTICO:** Incrementar `cyclesSinceLastService` de TODOS os ComponentCycle do barril
- [ ] Recalcular `healthScore` de cada componente
- [ ] Se algum componente atingir `YELLOW` ou `RED`, criar alerta correspondente
- [ ] Opção de direcionar para triagem rápida automaticamente

---

#### US-10: Seleção de Operação Pré-Scan
**Como** LOGISTICS, **quero** selecionar a operação ANTES de escanear **para que** agilizar o processo em lote.

**Critérios de Aceitação:**
- [ ] Tela inicial do mobile exibe 4 botões grandes: Expedição, Entrega, Coleta, Recebimento
- [ ] Cada botão com ícone intuitivo e cor distinta
- [ ] Após seleção, ir direto para câmera
- [ ] Indicador permanente no topo da tela mostrando operação selecionada
- [ ] Possibilidade de trocar operação a qualquer momento

---

### Epic 3: Manutenção

#### US-11: Histórico do Barril
**Como** MAINTENANCE, **quero** ver o histórico completo de um barril ao escaneá-lo **para que** saber seu estado.

**Critérios de Aceitação:**
- [ ] Ao escanear, exibir card com: código, capacidade, status, totalCycles, semáforo geral
- [ ] Lista de componentes com semáforo individual (GREEN/YELLOW/RED)
- [ ] Timeline dos últimos 10 eventos (logística + manutenção)
- [ ] Indicador de dias desde última manutenção
- [ ] Indicador de dias em cliente (se AT_CLIENT)
- [ ] Botão de ação: "Registrar Manutenção" ou "Ver Mais"
- [ ] Carregamento da tela: < 2 segundos

---

#### US-12: Manutenção Zero Digitação
**Como** MAINTENANCE, **quero** registrar manutenção via checkboxes **para que** ser rápido.

**Critérios de Aceitação:**
- [ ] Lista de todos os componentes configurados para o tenant
- [ ] Para cada componente, opções: ☐ Inspecionado, ☐ Substituído, ☐ Reparado
- [ ] Checkboxes grandes (mínimo 48x48px) para uso com luvas
- [ ] Checkbox "Teste de Pressão OK" obrigatório
- [ ] Checkbox "Lavagem Completada" obrigatório
- [ ] Campo opcional "Observações" (texto livre, máx 500 chars)
- [ ] Ao salvar: resetar `cyclesSinceLastService` dos componentes marcados
- [ ] Ao salvar: atualizar `lastServiceDate` dos componentes marcados
- [ ] Ao salvar: recalcular `healthScore` dos componentes
- [ ] Ao salvar: incrementar `totalMaintenanceCost` do barril (se custos informados)
- [ ] Tempo total de preenchimento meta: < 60 segundos

---

#### US-13: Semáforo de Saúde
**Como** MAINTENANCE, **quero** ver o semáforo de saúde de cada componente **para que** priorizar ações.

**Critérios de Aceitação:**
- [ ] Cores: Verde (< 80%), Amarelo (80-99%), Vermelho (≥ 100%)
- [ ] Percentual calculado: MAX(ciclos/limite_ciclos, dias/limite_dias) × 100
- [ ] Componentes em Vermelho no topo da lista
- [ ] Badge com contagem de componentes por status
- [ ] Barril com qualquer componente Vermelho: badge "MANUTENÇÃO OBRIGATÓRIA"
- [ ] Tooltip com detalhes: "32/40 ciclos (80%)" ou "165/180 dias (92%)"

---

#### US-14: Triagem Rápida
**Como** MAINTENANCE, **quero** realizar triagem rápida no recebimento **para que** separar barris com avaria.

**Critérios de Aceitação:**
- [ ] Tela com duas opções grandes: "✓ Íntegro" ou "✗ Avaria"
- [ ] Se Íntegro: resultado `CLEARED_FOR_FILLING`, seguir para envase
- [ ] Se Avaria: exibir tipos de dano (STRUCTURAL, VALVE, SEAL, CORROSION, WELD, OTHER)
- [ ] Campo opcional para foto (captura direto da câmera)
- [ ] Campo opcional para descrição do dano
- [ ] Resultado `SENT_TO_MAINTENANCE` ou `BLOCKED` conforme severidade
- [ ] Se STRUCTURAL, BLOCKED automaticamente
- [ ] Tempo de triagem meta: < 5 segundos para íntegros

---

#### US-15: OS Automáticas
**Como** MAINTENANCE, **quero** receber ordens de serviço automáticas quando um componente atinge o limite **para que** agir rapidamente.

**Critérios de Aceitação:**
- [ ] OS criada quando `healthScore` muda para `YELLOW` (90% do limite)
- [ ] OS com `autoGenerated = true`
- [ ] OS com prioridade baseada na criticidade do componente
- [ ] Título auto-gerado: "Manutenção Preventiva - [Componente] - [Código Barril]"
- [ ] Descrição com detalhes: ciclos atuais, limite, percentual
- [ ] Push notification enviada para usuários MAINTENANCE do tenant
- [ ] Lista de OS pendentes acessível no app mobile
- [ ] Não duplicar OS se já existe uma PENDING para mesmo barril+componente

---

### Epic 4: Alertas

#### US-16: Alerta de Geofencing
**Como** MANAGER, **quero** receber alerta quando um barril sai da zona permitida **para que** investigar possível extravio.

**Critérios de Aceitação:**
- [ ] Verificação a cada scan de evento logístico
- [ ] Alerta se coordenadas não estão dentro de nenhuma Geofence conhecida
- [ ] Tipo: `GEOFENCE_VIOLATION`, Prioridade: `CRITICAL`
- [ ] Metadata: lat/lng do scan, distância da zona mais próxima
- [ ] Push + Email imediato para todos MANAGER do tenant
- [ ] Dedup: não criar alerta duplicado se já existe ACTIVE para mesmo barril
- [ ] Exibir no mapa do dashboard com ícone de alerta

---

#### US-17: Alerta de Ociosidade no Cliente
**Como** MANAGER, **quero** receber alerta quando barris estão ociosos no cliente há mais de 15 dias **para que** cobrar devolução.

**Critérios de Aceitação:**
- [ ] Job diário às 08:00 UTC verifica barris com `status = AT_CLIENT`
- [ ] Critério: `lastEventAt` > 15 dias atrás
- [ ] Tipo: `IDLE_AT_CLIENT`, Prioridade: `MEDIUM`
- [ ] Metadata: nome do cliente, dias ociosos, contato do cliente
- [ ] Agrupamento: um alerta por cliente com lista de barris
- [ ] Link direto para contato do cliente no alerta
- [ ] Threshold de 15 dias configurável por tenant

---

#### US-18: Alerta de Fim de Vida Útil
**Como** MANAGER, **quero** receber alerta quando um componente está próximo do fim da vida útil **para que** planejar manutenção.

**Critérios de Aceitação:**
- [ ] Job diário às 06:00 UTC verifica todos ComponentCycle
- [ ] Critério: `healthScore = YELLOW` (≥ 90% do limite)
- [ ] Tipo: `COMPONENT_END_OF_LIFE`, Prioridade: `HIGH`
- [ ] Se componente `CRITICAL` com `healthScore = RED`: tipo `MANDATORY_INSPECTION`, Prioridade: `CRITICAL`
- [ ] Push + Email para MANAGER e MAINTENANCE
- [ ] Dedup por barrelId + componentConfigId + alertType

---

#### US-19: Push Notification de OS
**Como** MAINTENANCE, **quero** receber push notification de OS automáticas **para que** agir rapidamente.

**Critérios de Aceitação:**
- [ ] Push via Firebase Cloud Messaging
- [ ] Título: "Nova OS: [Código Barril]"
- [ ] Corpo: "[Componente] atingiu [X]% do limite"
- [ ] Deep link abre diretamente a OS no app
- [ ] Configuração de horário silencioso (22:00-06:00) respeitada
- [ ] Badge do app incrementado com OS pendentes

---

### Epic 5: Dashboard e Relatórios

#### US-20: Dashboard de Saúde da Frota
**Como** MANAGER, **quero** ver um dashboard com a saúde geral da frota **para que** ter visão consolidada.

**Critérios de Aceitação:**
- [ ] Card principal: semáforo geral (verde/amarelo/vermelho)
- [ ] Percentuais: X% verde, Y% amarelo, Z% vermelho
- [ ] Gráfico de pizza ou donut com distribuição
- [ ] Drill-down: clicar em cor filtra lista de barris
- [ ] Tendência: seta ↑↓ comparando com semana anterior
- [ ] Tempo de carregamento: < 2 segundos
- [ ] Auto-refresh a cada 5 minutos

---

#### US-21: Custo de Manutenção por Litro
**Como** MANAGER, **quero** ver o custo de manutenção por litro **para que** medir eficiência.

**Critérios de Aceitação:**
- [ ] Fórmula: Σ(custos manutenção) / Σ(litros entregues)
- [ ] Período selecionável: mês atual, trimestre, ano, custom
- [ ] Gráfico de linha com evolução temporal
- [ ] Benchmark: linha de meta configurável
- [ ] Breakdown por tipo de manutenção (preventiva/corretiva/preditiva)
- [ ] Comparativo com período anterior (%)

---

#### US-22: Mapa de Localização
**Como** MANAGER, **quero** ver a localização de todos os barris em um mapa **para que** saber onde estão.

**Critérios de Aceitação:**
- [ ] Mapa interativo (Google Maps ou Mapbox)
- [ ] Pins coloridos por status: verde (ACTIVE), azul (IN_TRANSIT), laranja (AT_CLIENT), vermelho (alertas)
- [ ] Cluster quando zoom out (agrupar pins próximos)
- [ ] Filtros: por status, por cliente, por região
- [ ] Click no pin abre card com resumo do barril
- [ ] Geofences visíveis como círculos semi-transparentes
- [ ] Atualização em tempo real via polling (30s)

---

#### US-23: Relatório PDF Semanal
**Como** MANAGER, **quero** receber um relatório PDF semanal por e-mail **para que** acompanhar indicadores.

**Critérios de Aceitação:**
- [ ] Gerado automaticamente toda segunda-feira às 07:00 UTC
- [ ] Conteúdo: semáforo frota, custo/litro, top 10 barris críticos, alertas da semana
- [ ] Design profissional com logo do tenant
- [ ] PDF anexado + preview HTML no corpo do email
- [ ] Enviado para todos MANAGER com email válido
- [ ] Histórico de relatórios acessível no dashboard (últimos 12)

---

#### US-24: Prejuízo por Extravio
**Como** MANAGER, **quero** ver o prejuízo estimado por barris extraviados **para que** justificar investimentos.

**Critérios de Aceitação:**
- [ ] Barris extraviados: status `LOST` OU `AT_CLIENT` há > 60 dias
- [ ] Prejuízo = Σ(custo de aquisição) dos barris extraviados
- [ ] Card com valor total em R$ e quantidade de barris
- [ ] Gráfico de tendência (últimos 12 meses)
- [ ] Lista dos barris com link para detalhe
- [ ] Ação sugerida: marcar como LOST ou iniciar cobrança

---

### Epic 6: Descarte

#### US-25: Sugestão de Descarte
**Como** MANAGER, **quero** receber sugestão de descarte quando o TCO ultrapassar o limite **para que** decidir sobre a baixa.

**Critérios de Aceitação:**
- [ ] Critério 1: TCO acumulado ≥ 65% do custo de um barril novo
- [ ] Critério 2: > 3 manutenções corretivas nos últimos 12 meses
- [ ] Job semanal (quarta 06:00 UTC) avalia todos os barris
- [ ] Criar registro Disposal com status `SUGGESTED`
- [ ] Alerta tipo `DISPOSAL_SUGGESTED`, prioridade `HIGH`
- [ ] Exibir: TCO acumulado, custo reposição, histórico manutenções

---

#### US-26: Aprovação de Baixa
**Como** MANAGER, **quero** aprovar ou rejeitar baixas patrimoniais **para que** controlar o descarte.

**Critérios de Aceitação:**
- [ ] Lista de sugestões pendentes no dashboard
- [ ] Detalhes: foto, histórico, TCO, justificativa
- [ ] Botões: "Aprovar Descarte" ou "Rejeitar"
- [ ] Se aprovado: status muda para `APPROVED`, `approvedById` preenchido
- [ ] Se rejeitado: status muda para `REJECTED`, campo `notes` obrigatório
- [ ] Auditoria completa de quem aprovou/rejeitou e quando

---

#### US-27: Registro de Destino Final
**Como** ADMIN, **quero** registrar o destino final do barril descartado **para que** compliance ambiental.

**Critérios de Aceitação:**
- [ ] Somente para Disposal com status `APPROVED`
- [ ] Opções: Venda como Sucata, Reciclagem, Doação
- [ ] Campo valor de sucata (se aplicável)
- [ ] Campo notas adicionais
- [ ] Ao completar: Barrel.status → `DISPOSED`, Disposal.status → `COMPLETED`
- [ ] Data de conclusão registrada automaticamente
- [ ] Barril descartado não aparece mais em relatórios ativos

---

## 5. Requisitos Não-Funcionais

| Requisito | Especificação |
|----|----|
| Disponibilidade | 99.5% uptime |
| Tempo de resposta API | < 500ms p95 |
| Tempo de scan (mobile) | < 3 segundos end-to-end |
| Usuários simultâneos | 100 por tenant |
| Volume de dados | Até 50.000 barris por tenant |
| Retenção de dados | Mínimo 5 anos de histórico |
| Compatibilidade mobile | Android 10+ e iOS 15+ |
| Idioma | Português (BR), preparado para i18n |
| Acessibilidade | WCAG 2.1 AA (dashboard web) |

---

## 6. Riscos e Mitigações

### Riscos de Negócio

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Baixa adoção pelos operadores de campo | Média | Alto | UX simplificada, treinamento presencial, incentivos por uso |
| Resistência à mudança de processos | Alta | Médio | Change management, envolvimento early adopters, quick wins |
| Perda de conectividade em campo | Alta | Alto | Modo offline completo com sync inteligente |
| Dados GPS imprecisos | Média | Médio | Raio de tolerância nas Geofences, fallback para seleção manual |
| QR Codes danificados/ilegíveis | Média | Médio | Código de barras backup, busca manual por código |

### Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Vazamento de dados entre tenants | Baixa | Crítico | RLS no PostgreSQL + testes automatizados de isolamento |
| Falha no serviço de push notification | Média | Médio | Fallback para email + polling no app |
| Performance degradada com volume | Média | Alto | Índices otimizados, cache Redis, views materializadas |
| Indisponibilidade do Azure Blob | Baixa | Médio | Retry com backoff, compressão de imagens |
| Conflitos de sync offline | Média | Médio | Timestamp de servidor, resolução last-write-wins |

### Riscos de Segurança

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Token JWT comprometido | Baixa | Alto | Expiração curta (15min), refresh token rotation |
| Acesso não autorizado a barris | Baixa | Alto | RBAC rigoroso, audit log completo |
| SQL Injection | Muito Baixa | Crítico | Prisma ORM parameterizado, validação de inputs |
| DDoS no API | Baixa | Alto | Rate limiting, WAF, CDN |

---

## 7. Definition of Done (DoD)

### Para User Stories
- [ ] Código implementado e commitado na branch feature
- [ ] Testes unitários com cobertura ≥ 80% do código novo
- [ ] Testes de integração para fluxos críticos
- [ ] Code review aprovado por pelo menos 1 desenvolvedor
- [ ] Sem warnings de lint (ESLint/Prettier)
- [ ] Documentação da API atualizada (Swagger)
- [ ] Endpoint testado manualmente no ambiente de staging
- [ ] Critérios de aceitação validados pelo PO
- [ ] Merge na branch develop sem conflitos
- [ ] Deploy automático em staging bem-sucedido

### Para Sprints
- [ ] Todas as User Stories da sprint atendem ao DoD
- [ ] Retrospectiva realizada e action items documentados
- [ ] Métricas de sprint atualizadas (velocity, burndown)
- [ ] Demo realizada para stakeholders
- [ ] Bugs críticos da sprint resolvidos
- [ ] Documentação de release notes atualizada

### Para Releases
- [ ] Todas as features planejadas completas
- [ ] Testes de regressão executados sem falhas
- [ ] Teste de carga executado (100 usuários simultâneos)
- [ ] Teste de segurança (OWASP Top 10) aprovado
- [ ] Backup de banco de dados verificado
- [ ] Rollback plan documentado e testado
- [ ] Comunicação para usuários preparada
- [ ] Monitoramento e alertas configurados
- [ ] Sign-off do PO e stakeholders

---

## 8. Roadmap

### Fase 1 — MVP (3 meses)
- Cadastro de ativos, clientes, fornecedores, usuários
- 4 inputs logísticos com QR Code + geolocalização
- Central de manutenção com checklist
- Alertas básicos (geofencing, fim de vida de componente)
- Dashboard simplificado

### Fase 2 — Inteligência (3 meses)
- Contador de ciclos preditivo completo
- Dashboard gerencial avançado (CL, giro, CAPEX forecast)
- Relatório executivo PDF automático
- Gestão de descarte e baixa patrimonial
- Ranking de prestadores

### Fase 3 — Ecossistema (6 meses)
- Integração com ERP (SAP/Totvs)
- Monitoramento IoT (pressão, volume, temperatura)
- IA para análise de imagem de danos
- Gestão de contratos de fornecedores
- App para o cliente (PDV) verificar validade do chopp

---

## 9. Fora do Escopo (MVP)
- Integração com ERPs de terceiros
- Sensores IoT de pressão/temperatura
- IA para visão computacional
- App para cliente final (PDV)
- Módulo financeiro completo (faturamento, NF-e)
- Suporte a idiomas além de PT-BR
