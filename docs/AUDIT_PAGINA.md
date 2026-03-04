# 🔎 AUDITORIA FUNCIONAL REAL — KegSafe Tech Platform — VERSÃO COMPLETA

## 🎯 Objetivo
Executar uma auditoria funcional completa do **KegSafe Tech Platform**, validando:

- Autenticação e segregação por **perfil (RBAC)**: Admin / Gestor / Logística / Manutenção
- Navegação, menus, rotas e estados (inclusive páginas vazias/placeholder)
- CRUDs essenciais: Barris, Clientes, Geofences, Usuários, Componentes
- Fluxo de Logística (máquina de estados via QR / app mobile)
- Regras de manutenção (limites por componente: ciclos/dias e criticidade)
- Alertas, Descarte e Relatórios (KPIs, estados vazios, consistência numérica)
- Consistência de UX/UI (feedback, mensagens, estados vazios, acessibilidade básica)
- Segurança básica: sessão, logout, tentativa de acesso direto a rotas sem permissão

> **Base/Referência de estrutura:** modelo de auditoria em Markdown do arquivo anexado. fileciteturn0file0

---

## 🌐 URL
**(informar aqui a URL do ambiente)**  
- http://localhost:3000/login

---

## 🔐 Contas de teste (usar todas, uma por vez)

| Perfil | Email | Senha |
|---|---|---|
| Admin | admin@petropolis.com.br | Admin@123 |
| Gestor | gestor@petropolis.com.br | Gestor@123 |
| Logística | logistica@petropolis.com.br | Logistica@123 |
| Manutenção | manutencao@petropolis.com.br | Manutencao@123 |

---

## 🧭 Regras do teste
- Para cada perfil: **logar**, testar **todas as telas**, registrar falhas com **passo a passo**.
- Clicar em **todos os elementos acionáveis**: botões, links, ícones, dropdowns, cards, linhas de tabela.
- Registrar claramente quando algo:
  - “abre mas não faz nada”
  - “redireciona errado”
  - “não persiste”
  - “falha silenciosamente (sem feedback)”
- Para itens que dependem de mobile/QR, validar:
  - Se a UI explica o fluxo
  - Se há API/evento esperado no back (registrar como requisito se não existir)

---

# ✅ 1) TESTES NA TELA DE LOGIN (ANTES DO LOGIN)

## 1.1 Campos e validações
- Email: vazio / formato inválido / espaços / uppercase-lowercase
- Senha: vazio / errada / colar (paste)
- Botão **Entrar**: habilita/desabilita corretamente? tem loading/spinner?

## 1.2 Microinterações e feedback
- Ícone “olho” (mostrar/ocultar senha) funciona?
- Enter no teclado envia o login?
- Mensagem de erro é clara e não “vaza” detalhes (ex: “usuário existe”)?

## 1.3 Acesso por perfil (RBAC)
- Logar com cada credencial e validar:
  - menu exibido condiz com perfil?
  - rotas protegidas (não acessa telas de outro perfil)?

---

# ✅ 2) TESTES APÓS LOGIN — ELEMENTOS GLOBAIS (SIDEBAR + HEADER)

## 2.1 Sidebar / menu lateral (itens observados)
- Dashboard
- Barris
- Logística
- Manutenção
- Alertas
- Clientes
- Geofences
- Descarte
- Relatórios
- Configurações
  - Usuários
  - Componentes

Validar em **todos**:
- item selecionado (highlight) correto
- breadcrumb/título correto
- manter estado ao recarregar (F5) e ao trocar tela

## 2.2 Rodapé / sessão
- Perfil logado exibido corretamente (ex: “Administrador / ADMIN”)
- **Logout** existe? funciona? invalida sessão? volta ao /login?
- Toggle **Modo Claro**:
  - alterna tema de verdade?
  - persiste ao recarregar?

---

# ✅ 3) DASHBOARD — KPIs E WIDGETS

Validar cards:
- Total de Barris
- Custo/Litro
- Giro Médio
- Alertas Ativos

Validar gráficos:
- Distribuição da Frota (ex: Ativos)
- Saúde dos Componentes (Verde/Amarelo/Vermelho)

Validar contadores (cards menores):
- Em trânsito
- No cliente
- Manutenção
- Bloqueados
- Descartados
- Perdidos

Checklist:
- números coerentes com base (ex: se existem 50 barris ativos, distribuição bate?)
- estado vazio tratado (sem “0” enganoso quando não há dados)
- performance (carregar em <3s no ambiente)
- consistência por perfil (Admin vs Gestor vê o mesmo? Logística vê subset?)

---

# ✅ 4) BARRIS — LISTAGEM / BUSCA / DETALHE

## 4.1 Listagem
Colunas vistas:
- Código do barril
- QR Code
- Capacidade (30L/50L)
- Ciclos
- Saúde (indicador)
- Status (ex: Ativo)

Testar:
- Busca (por código/QR)
- Filtro (dropdown “Todos”)
- Scroll/paginação com muitos registros
- Clique na linha abre detalhe? (se sim, validar)
- Botão **+ Novo Barril**:
  - abre formulário?
  - validações e persistência
  - gera QR? (ou permite informar?)

## 4.2 Integridade de dados
- Capacidade é enum/validação (não permitir 0 / negativo)
- Ciclos não pode ser negativo
- Status coerente com logística (ver seção 5)

---

# ✅ 5) LOGÍSTICA — FLUXO OPERACIONAL (MÁQUINA DE ESTADOS)

Tela mostra 4 operações:

1. **Expedição** — saída da fábrica → **ACTIVE → IN_TRANSIT**
2. **Entrega** — chegada no cliente (PDV) → **IN_TRANSIT → AT_CLIENT**
3. **Coleta** — retirada do cliente → **AT_CLIENT → IN_TRANSIT**
4. **Recebimento** — retorno à fábrica + ciclo → **IN_TRANSIT → ACTIVE** (**incrementa ciclo**)

Testar:
- UI: cards clicáveis? mostram instruções?
- Mensagem: “operações via app mobile” está clara e suficiente?
- Verificar se existe:
  - endpoint/registro de evento (movimentação) no backend
  - trilha de auditoria (quem fez, quando, onde)
  - bloqueios: impedir saltos inválidos (ex: ACTIVE → AT_CLIENT direto)

---

# ✅ 6) MANUTENÇÃO — ORDENS DE SERVIÇO (OS)

Tela observada:
- lista vazia “Nenhuma ordem de serviço encontrada”
- filtro “Todos”

Testar:
- criar OS (se existir botão/fluxo em algum lugar)
- estados: aberta/em andamento/concluída/cancelada
- vínculo com:
  - barril
  - componente
  - técnico (usuário)
- regras:
  - OS obrigatória quando componente ultrapassa limite? (ver seção 12)

---

# ✅ 7) ALERTAS

Tela observada:
- filtro “Pendentes”
- estado vazio “Nenhum alerta pendente”

Testar:
- tipos de alerta (mínimo esperado):
  - componente em risco (dias/ciclos)
  - barril perdido / fora de geofence
  - descarte pendente
- ações:
  - marcar como lido?
  - atribuir a alguém?
  - abrir OS direto?
- severidade e SLA:
  - crítico / alto / médio

---

# ✅ 8) CLIENTES

Tela observada:
- cards de clientes (ex: Bar do Zé, Choperia Central, Sabor da Terra)
- indicação de “geofence(s)”
- botão **+ Novo Cliente**

Testar:
- criar/editar/excluir cliente
- campos típicos:
  - nome
  - CNPJ (se aplicável)
  - endereço
  - contato
- relacionamento com Geofences:
  - vincular 1..N
  - impedir deletar cliente com geofence ativa? (regra a definir)

---

# ✅ 9) GEOFENCES

Tela observada:
- cards com:
  - nome
  - raio (ex: 500m / 800m / 1000m)
  - latitude/longitude
  - tipo: Cliente vs Fábrica
- botão **+ Nova Geofence**

Testar:
- validações:
  - raio mínimo/máximo
  - lat/long válidos
- persistência
- vínculo com:
  - cliente (quando tipo=Cliente)
  - fábrica/CD (quando tipo=Fábrica)
- regras:
  - geofence usada para alertas/logística? (se sim, detalhar eventos)

---

# ✅ 10) DESCARTE (BAIXA PATRIMONIAL)

Tela observada:
- “Nenhuma solicitação de descarte”

Testar:
- criar solicitação de descarte (se houver)
- aprovações:
  - quem pode aprovar (Admin/Gestor)?
- impacto:
  - barril muda status para descartado?
  - some das listas? entra em relatório?

---

# ✅ 11) RELATÓRIOS (FINANCEIRO + OPERACIONAL)

Widgets observados:
- **Custo por litro**
  - custo total
  - litros transportados
- **Giro de ativos**
  - ciclos/barril
  - barris analisados
  - ciclos totais
- **Relatório de perdas**
  - perdidos (R$)
  - bloqueados
  - descartados

Testar:
- consistência numérica com Dashboard
- filtros (período, cliente, status) — se existirem
- exportação (CSV/PDF) — se existir
- timezone (GMT-3) e datas

---

# ✅ 12) CONFIGURAÇÕES — USUÁRIOS (RBAC)

Tela observada:
- lista com 4 usuários:
  - Administrador (Admin)
  - Gestor de Operações (Gestor)
  - Operador de Logística (Logística)
  - Técnico de Manutenção (Manutenção)
- botão **+ Novo Usuário**

Testar:
- criar usuário:
  - validações (email único, senha forte)
  - atribuição de role
- editar/desativar usuário
- permissão:
  - só Admin pode gerenciar usuários?
- segurança:
  - reset de senha
  - bloqueio por tentativas (se aplicável)

---

# ✅ 13) CONFIGURAÇÕES — COMPONENTES (LIMITES DE MANUTENÇÃO)

Tela observada:
- cards de componentes com:
  - nome + descrição
  - **criticidade** (Crítica / Alta / Média)
  - **Ciclos Máx.**
  - **Dias Máx.**
- botão **+ Novo Componente**

Componentes vistos (exemplos):
- Chimb (Base e Alças) — Média — 100 ciclos / 1825 dias
- Corpo do Barril (Inox) — Crítica — 200 ciclos / 1825 dias
- O-Ring (Vedação do Sifão) — Alta — 15 ciclos / 180 dias
- Sifão (Tubo Extrator) — Alta — 40 ciclos / 730 dias
- Válvula Principal (Boca) — Crítica — 60 ciclos / 1095 dias
- Válvula de Segurança — Crítica — 50 ciclos / 365 dias

Testar:
- CRUD de componente
- validações:
  - ciclos e dias > 0
  - criticidade obrigatória
- regra de cálculo (esperada):
  - se (ciclos_atual >= ciclos_max) OU (dias_desde_ultima_manut >= dias_max) ⇒ gerar alerta/OS
- ligação com Barris:
  - existe histórico por barril? (componente “instalado em” / “trocado em”)
  - dashboard “Saúde dos Componentes” deriva disso? (definir)

---

# ✅ 14) TESTE DE PERMISSÕES (ROLE x TELAS x AÇÕES)

Matriz mínima esperada:

- **Admin**
  - acesso total + configurações (usuários/componentes)
- **Gestor**
  - visão gerencial (dashboard/relatórios) + entidades (barris/clientes/geofences)
  - sem gerenciar usuários? (a confirmar)
- **Logística**
  - foco em logística, leitura de barris/QR, clientes/geofences (dependendo do processo)
  - sem acesso a componentes/usuários
- **Manutenção**
  - manutenção + componentes (talvez leitura), OS, alertas
  - sem usuários

Testes:
- tentar acessar rota direta (copiar URL) sem permissão
- verificar mensagens 401/403 e redirecionamento
- validar que menus escondidos também estão protegidos no backend

---

# 📄 RELATÓRIO FINAL (o que deve ser entregue)

Gerar arquivo Markdown: **audit_kegsafe.md**

Estrutura de saída:
1. Resumo executivo (estado geral)
2. Lista de BUGS CRÍTICOS (bloqueadores)
3. Lista de BUGS funcionais (médio/baixo)
4. Problemas de UX/UI (com recomendações)
5. Problemas de permissão / segurança (alta prioridade)
6. Checklist de telas testadas (por perfil)
7. Bugs com passo a passo de reprodução (Given/When/Then)
8. Itens incompletos/placeholder (dívida técnica)
