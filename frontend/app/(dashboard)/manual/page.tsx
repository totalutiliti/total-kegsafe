'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Search, BookOpen, LogIn, LayoutDashboard, Package, Truck, Wrench,
    AlertTriangle, Building2, Map, Trash2, BarChart3, Users, Settings,
    ChevronDown, ChevronRight, HelpCircle, Info, Lightbulb, Shield,
    Eye, CheckCircle2, XCircle, ArrowRight, Monitor
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  DATA: Sections per role                                            */
/* ------------------------------------------------------------------ */

interface ManualSection {
    id: string;
    title: string;
    icon: any;
    description: string;
    screenshot: string;
    roles: string[];
    steps: string[];
    tips?: string[];
}

const sections: ManualSection[] = [
    {
        id: 'login',
        title: '1. Login — Acesso ao Sistema',
        icon: LogIn,
        description: 'A tela de login é o ponto de entrada do KegSafe Tech. Insira seu e-mail corporativo e a senha fornecida pelo administrador para acessar a plataforma. Após o primeiro acesso, recomendamos alterar sua senha.',
        screenshot: '/manual/login.png',
        roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'],
        steps: [
            'Acesse o endereço do sistema no navegador',
            'Digite seu e-mail no campo "Email"',
            'Digite sua senha no campo "Senha"',
            'Clique no botão "Entrar"',
            'Você será redirecionado para sua página inicial conforme seu perfil',
        ],
        tips: [
            'Após 5 tentativas incorretas, sua conta será bloqueada temporariamente por segurança',
            'Use o ícone de olho (👁) para visualizar a senha digitada',
            'Em caso de esquecimento de senha, entre em contato com o administrador',
        ],
    },
    {
        id: 'dashboard',
        title: '2. Dashboard — Visão Geral',
        icon: LayoutDashboard,
        description: 'O Dashboard apresenta uma visão consolidada de toda a operação da frota de barris. Aqui você encontra KPIs estratégicos, distribuição da frota por status, saúde dos componentes e indicadores operacionais em tempo real.',
        screenshot: '/manual/admin-dashboard.png',
        roles: ['ADMIN', 'MANAGER'],
        steps: [
            'Clique em "Dashboard" no menu lateral',
            'Visualize os 4 KPIs principais: Total de Barris, Custo/Litro, Giro Médio e Alertas Ativos',
            'O gráfico "Distribuição da Frota" mostra barris por status (Ativos, Manutenção, etc.)',
            'O gráfico "Saúde dos Componentes" apresenta quantos componentes estão Verdes, Amarelos e Vermelhos',
            'Na parte inferior, veja cards com: OS Abertas, Descartes Pendentes, Componentes Críticos, Ciclos Totais e Alertas Não Resolvidos',
        ],
        tips: [
            'Os dados são atualizados em tempo real a cada carregamento da página',
            'Componentes "Vermelhos" no gráfico indicam necessidade urgente de manutenção',
            'O custo/litro é calculado com base no custo total de aquisição e volume transportado',
        ],
    },
    {
        id: 'barrels',
        title: '3. Barris — Gestão da Frota',
        icon: Package,
        description: 'A página de Barris lista todos os barris cadastrados no sistema com informações detalhadas. Utilize a busca e os filtros para localizar barris específicos rapidamente. Cada barril possui um código único, QR Code, chassi, capacidade e status de saúde.',
        screenshot: '/manual/{role}-barrels.png',
        roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'],
        steps: [
            'Clique em "Barris" no menu lateral',
            'Use o campo "Buscar por código ou QR..." para filtrar por texto (busca automática com debounce)',
            'Use o seletor "Todos" para filtrar por status (Ativo, Manutenção, Descartado, etc.)',
            'Clique no código de um barril (em laranja) para ver os detalhes completos',
            'O indicador colorido na coluna "Saúde" mostra: 🟢 Verde (bom), 🟡 Amarelo (atenção), 🔴 Vermelho (crítico)',
        ],
        tips: [
            'A busca filtra automaticamente enquanto você digita — não é necessário pressionar Enter',
            'Administradores podem criar novos barris pelo botão "+ Novo Barril"',
            'O botão "Operações em Massa" permite importação via Excel e leitura de QR em lote',
        ],
    },
    {
        id: 'barrel-detail',
        title: '4. Detalhe do Barril',
        icon: Eye,
        description: 'A página de detalhe exibe todas as informações de um barril: ciclos totais, capacidade, peso tara, custo de aquisição, data de fabricação, saúde individual de cada componente e toda a timeline de movimentações logísticas.',
        screenshot: '/manual/admin-barrel-detail.png',
        roles: ['ADMIN', 'MANAGER', 'MAINTENANCE'],
        steps: [
            'Na lista de Barris, clique no código do barril desejado',
            'Veja os dados gerais: Ciclos Totais, Capacidade (L), Peso Tara (kg), Custo de Aquisição',
            'Na seção "Saúde dos Componentes", cada card mostra o componente, seus ciclos usados vs. máximos, e a porcentagem de uso',
            'A barra de progresso e o badge indicam o estado: Verde (OK), Amarelo (Atenção), Vermelho (Crítico)',
            'Role para baixo para ver a "Timeline de Movimentações" com todo o histórico logístico',
        ],
        tips: [
            'Use o botão "Manutenção" (canto superior) para enviar o barril diretamente para manutenção',
            'O botão "Transferir" permite transferir a propriedade do barril para outro tenant',
            'A porcentagem de uso é baseada nos ciclos do componente em relação ao seu limite máximo',
        ],
    },
    {
        id: 'logistics',
        title: '5. Logística — Movimentação de Barris',
        icon: Truck,
        description: 'A página de Logística apresenta os 4 tipos de operação logística: Expedição (saída da fábrica), Entrega (chegada ao cliente), Coleta (retirada do cliente) e Recebimento (retorno à fábrica). Todas as operações são realizadas pelo aplicativo mobile KegSafe.',
        screenshot: '/manual/{role}-logistics.png',
        roles: ['ADMIN', 'LOGISTICS'],
        steps: [
            'Clique em "Logística" no menu lateral',
            'Visualize os 4 cards de operação com seus fluxos de status:',
            '  • Expedição: ACTIVE → IN_TRANSIT (saída da fábrica)',
            '  • Entrega: IN_TRANSIT → AT_CLIENT (entrega no PDV)',
            '  • Coleta: AT_CLIENT → IN_TRANSIT (retirada no cliente)',
            '  • Recebimento: IN_TRANSIT → ACTIVE (retorno à fábrica + incremento de ciclo)',
            'As operações são realizadas exclusivamente pelo app mobile via leitura de QR/NFC',
        ],
        tips: [
            'Esta página é informativa — as operações são feitas no app mobile',
            'Cada operação de Recebimento incrementa automaticamente o ciclo do barril e de todos seus componentes',
            'O app mobile registra geolocalização automática em cada operação',
        ],
    },
    {
        id: 'maintenance',
        title: '6. Manutenção — Ordens de Serviço',
        icon: Wrench,
        description: 'Gerencie todas as Ordens de Serviço (OS) de manutenção. Crie novas OS, acompanhe o status de cada uma (Pendente, Em Andamento, Concluída, Cancelada), visualize em lista ou calendário e exporte dados.',
        screenshot: '/manual/{role}-maintenance.png',
        roles: ['ADMIN', 'MANAGER', 'MAINTENANCE'],
        steps: [
            'Clique em "Manutenção" no menu lateral',
            'Veja a lista de ordens com status, tipo (Preventiva/Corretiva/Preditiva) e prioridade',
            'Use os ícones no topo para alternar entre visualização em lista (☰) e calendário (📅)',
            'Use o filtro "Todos" para filtrar por status específico',
            'Para criar uma nova OS, clique em "+ Nova OS" e preencha: Barril, Tipo, Prioridade, Data (opcional) e Descrição',
        ],
        tips: [
            'Barris descartados ou extraviados não podem receber novas OS',
            'OS agendadas para o futuro mantêm o barril no status atual até a data programada',
            'A visualização em calendário agrupa as OS por dia para facilitar o planejamento',
        ],
    },
    {
        id: 'alerts',
        title: '7. Alertas — Monitoramento',
        icon: AlertTriangle,
        description: 'A Central de Alertas exibe notificações automáticas geradas pelo sistema: fim de vida útil, necessidade de inspeção, barril ocioso no cliente ou fábrica, violações de geofence, sugestões de descarte e mais.',
        screenshot: '/manual/{role}-alerts.png',
        roles: ['ADMIN', 'MANAGER', 'MAINTENANCE'],
        steps: [
            'Clique em "Alertas" no menu lateral',
            'Veja os 3 KPIs: Total Não Resolvidos, Não Visualizados e Críticos',
            'Use os filtros para buscar por tipo de alerta ou status (Pendente/Resolvido)',
            'Cada alerta mostra: título, descrição, prioridade (badge colorido), tipo e barril associado',
            'Clique em "Visto" para marcar como visualizado ou "Resolver" para encerrar o alerta',
        ],
        tips: [
            'Alertas "Críticos" (vermelho) devem ser tratados com prioridade',
            'Ao resolver um alerta, você pode adicionar notas de resolução',
            'Os alertas são gerados automaticamente com base em regras configuradas no sistema',
        ],
    },
    {
        id: 'clients',
        title: '8. Clientes — Cadastro de PDVs',
        icon: Building2,
        description: 'Gerencie os pontos de venda (PDVs) e clientes que recebem os barris. Cada cliente pode ter geofences associados para controle de localização.',
        screenshot: '/manual/admin-clients.png',
        roles: ['ADMIN', 'MANAGER'],
        steps: [
            'Clique em "Clientes" no menu lateral',
            'Visualize os cards de clientes com: nome fantasia, telefone, e-mail, endereço e número de geofences',
            'Clique em "+ Novo Cliente" para cadastrar um novo PDV',
            'Preencha os dados: Nome Fantasia, Razão Social, CNPJ, Telefone, E-mail e Endereço',
        ],
        tips: [
            'Cada cliente pode ter múltiplos geofences (áreas geográficas) associados',
            'Os clientes são utilizados nas operações logísticas de Entrega e Coleta',
        ],
    },
    {
        id: 'geofences',
        title: '9. Geofences — Zonas Geográficas',
        icon: Map,
        description: 'Configure zonas geográficas (geofences) para monitoramento de barris. Defina áreas para fábricas, clientes e zonas restritas com raios personalizados.',
        screenshot: '/manual/admin-geofences.png',
        roles: ['ADMIN', 'MANAGER'],
        steps: [
            'Clique em "Geofences" no menu lateral',
            'Visualize as zonas em cards ou mapa (alternando pelo botão de visualização)',
            'Cada geofence mostra: Nome, Tipo (Fábrica/Cliente/Restrita), Raio em metros e Coordenadas',
            'Clique em "Criar Geofence" para adicionar uma nova zona',
            'Defina: Nome, Tipo, Latitude, Longitude, Raio e Cliente associado (se aplicável)',
        ],
        tips: [
            'Geofences de tipo "Fábrica" são usados para detectar operações de Expedição e Recebimento',
            'Geofences de tipo "Cliente" são associados aos PDVs para registrar Entregas e Coletas',
            'O raio define a área circular ao redor do ponto central onde as operações são válidas',
        ],
    },
    {
        id: 'disposal',
        title: '10. Descarte — Gestão de Baixas',
        icon: Trash2,
        description: 'Gerencie o ciclo completo de descarte de barris: solicitação, aprovação e conclusão. O sistema sugere automaticamente barris para descarte quando o custo de manutenção ultrapassa 60% do custo de aquisição.',
        screenshot: '/manual/admin-disposal.png',
        roles: ['ADMIN', 'MANAGER'],
        steps: [
            'Clique em "Descarte" no menu lateral',
            'Veja a lista de solicitações com status: Pendente, Aprovado, Concluído, Rejeitado',
            'Use os botões de filtro no topo para filtrar por status',
            'Para criar um novo descarte: clique na ação e selecione o barril, motivo e descrição',
            'Aprovadores podem Aprovar ou Rejeitar solicitações pendentes',
            'Descartes aprovados podem ser Concluídos com destino (Sucata, Reciclagem, Doação) e valor de sucata',
        ],
        tips: [
            'O painel de "Sugestões" mostra barris cujo custo de manutenção excede 60% do valor de aquisição',
            'O TCO (Total Cost of Ownership) acumulado é exibido em cada solicitação',
            'Alterne entre visualização de lista e analytics para ver gráficos de tendências',
        ],
    },
    {
        id: 'reports',
        title: '11. Relatórios — Análise de Dados',
        icon: BarChart3,
        description: 'Acesse 6 módulos de relatórios com gráficos interativos, tabelas detalhadas e exportação CSV: Visão Geral, Ativos, Manutenção, Descartes, Análise de Perdas e Componentes.',
        screenshot: '/manual/admin-reports.png',
        roles: ['ADMIN', 'MANAGER'],
        steps: [
            'Clique em "Relatórios" no menu lateral',
            'Navegue entre as 6 abas disponíveis:',
            '  • Visão Geral: Custo/Litro, Giro de Ativos e Relatório de Perdas',
            '  • Ativos: Distribuição por status e material, tabela detalhada com exportação CSV',
            '  • Manutenção: OS por status e tipo, custos estimados vs. reais',
            '  • Descartes: Status e motivos de descarte, TCO e valor de sucata',
            '  • Análise de Perdas: Perdas por motivo, por cliente, evolução mensal',
            '  • Componentes: Saúde geral, saúde por componente, ciclos restantes',
        ],
        tips: [
            'Use o botão "Exportar CSV" em cada aba para baixar os dados',
            'Os gráficos são interativos — passe o mouse para ver valores detalhados',
            'A aba "Análise de Perdas" é ideal para identificar padrões de descarte prematuro',
        ],
    },
    {
        id: 'users',
        title: '12. Usuários — Gestão de Acessos',
        icon: Users,
        description: 'Gerencie os usuários da plataforma. Crie novos usuários, defina perfis de acesso (Admin, Gestor, Logística, Manutenção) e ative ou desative contas.',
        screenshot: '/manual/admin-users.png',
        roles: ['ADMIN'],
        steps: [
            'Clique em "Usuários" no menu lateral (seção Configurações)',
            'Veja os cards de usuários com: Nome, E-mail, Perfil (badge colorido) e Status',
            'Use as abas "Ativos", "Inativos" e "Todos" para filtrar',
            'Clique em "Criar Usuário" para adicionar um novo membro',
            'Preencha: Nome, E-mail, Senha Temporária e Perfil de Acesso',
            'Use o botão "Desativar" para suspender um usuário (reversível)',
        ],
        tips: [
            'Cada perfil tem acessos diferentes — consulte a tabela de permissões no FAQ abaixo',
            'Usuários desativados não conseguem fazer login mas seus dados são mantidos',
            'A senha temporária deve ser trocada no primeiro acesso',
        ],
    },
    {
        id: 'components',
        title: '13. Componentes — Configuração de Peças',
        icon: Settings,
        description: 'Configure os componentes rastreados em cada barril: nome, descrição, criticidade, ciclos máximos, dias máximos e custo médio de substituição. Estes parâmetros definem quando alertas de manutenção são gerados.',
        screenshot: '/manual/admin-components.png',
        roles: ['ADMIN'],
        steps: [
            'Clique em "Componentes" no menu lateral (seção Configurações)',
            'Veja os cards de componentes: Nome, Descrição, Criticidade, Ciclos Máximos, Dias Máximos e Custo',
            'Clique no ícone de edição em um componente para alterar seus parâmetros',
            'Clique em "Criar Componente" para adicionar um novo tipo de componente',
            'Defina os limites de ciclos e dias — estes valores determinam os alertas de saúde',
        ],
        tips: [
            'A "Criticidade" (Baixa/Média/Alta/Crítica) define a prioridade nas ordens de manutenção',
            'Quando um componente atinge 80% dos ciclos ou dias máximos, ele fica "Amarelo" (atenção)',
            'Ao atingir 100%, o componente fica "Vermelho" (crítico) e gera alertas automáticos',
        ],
    },
];

/* ------------------------------------------------------------------ */
/*  FAQ per role                                                       */
/* ------------------------------------------------------------------ */

interface FaqItem {
    q: string;
    a: string;
    roles: string[];
}

const faqItems: FaqItem[] = [
    {
        q: 'Quais são os perfis de acesso e suas permissões?',
        a: `O sistema possui 4 perfis para tenants:\n\n• **Administrador (ADMIN)**: Acesso total — Dashboard, Barris, Logística, Manutenção, Alertas, Clientes, Geofences, Descarte, Relatórios, Usuários e Componentes.\n\n• **Gestor (MANAGER)**: Acesso gerencial — Dashboard, Barris, Manutenção, Alertas, Clientes, Geofences, Descarte e Relatórios. Não gerencia Usuários nem Componentes.\n\n• **Manutenção (MAINTENANCE)**: Acesso operacional — Barris (visualização), Manutenção (criar/gerenciar OS) e Alertas.\n\n• **Logística (LOGISTICS)**: Acesso operacional — Barris (visualização) e Logística (operações via app mobile).`,
        roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'],
    },
    {
        q: 'Como funciona o ciclo de vida de um barril?',
        a: 'O barril passa pelos seguintes status:\n\n1. **Pré-Registrado**: Código gerado em lote, aguardando ativação\n2. **Ativo**: Na fábrica, disponível para expedição\n3. **Em Trânsito**: Saiu da fábrica (expedido) ou coletado do cliente\n4. **No Cliente**: Entregue no ponto de venda (PDV)\n5. **Em Manutenção**: Em reparo na oficina\n6. **Bloqueado**: Suspenso por segurança\n7. **Descartado**: Baixa patrimonial concluída\n8. **Extraviado**: Sem retorno há mais de 60 dias',
        roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'],
    },
    {
        q: 'O que significa cada cor na saúde dos componentes?',
        a: '🟢 **Verde (< 80%)**: Componente em boas condições, dentro dos limites.\n\n🟡 **Amarelo (80% - 99%)**: Componente requer atenção — próximo do limite de ciclos ou dias.\n\n🔴 **Vermelho (≥ 100%)**: Componente crítico — ultrapassou o limite e precisa de manutenção imediata.\n\nA porcentagem considera o maior valor entre: (ciclos usados / ciclos máx.) e (dias desde último serviço / dias máx.).',
        roles: ['ADMIN', 'MANAGER', 'MAINTENANCE'],
    },
    {
        q: 'Como criar uma Ordem de Serviço (OS)?',
        a: '1. Acesse a página **Manutenção**\n2. Clique no botão **"+ Nova OS"**\n3. No campo Barril, digite o código para buscar (barris descartados/extraviados não aparecem)\n4. Selecione o **Tipo**: Preventiva, Corretiva ou Preditiva\n5. Defina a **Prioridade**: Baixa, Média, Alta ou Crítica\n6. (Opcional) Agende uma data futura\n7. (Opcional) Adicione uma descrição\n8. Clique em **"Criar OS"**\n\nA OS será criada com status "Pendente" e o barril será automaticamente movido para "Em Manutenção".',
        roles: ['ADMIN', 'MANAGER', 'MAINTENANCE'],
    },
    {
        q: 'Como funciona o descarte de um barril?',
        a: '1. Um usuário solicita o descarte selecionando o barril e o motivo\n2. Um Administrador ou Gestor **aprova** ou **rejeita** a solicitação\n3. Após aprovação, o descarte é **concluído** com:\n   - Destino: Venda como Sucata, Reciclagem ou Doação\n   - Valor de sucata (se aplicável)\n   - Notas de conclusão\n4. O barril é movido para status "Descartado" e não pode mais ser usado em operações.',
        roles: ['ADMIN', 'MANAGER'],
    },
    {
        q: 'Como as operações logísticas funcionam?',
        a: 'As 4 operações são realizadas exclusivamente pelo **aplicativo mobile KegSafe**:\n\n📦 **Expedição**: Operador escaneia o barril na fábrica → Status muda para "Em Trânsito"\n🚚 **Entrega**: Operador escaneia no cliente (PDV) → Status muda para "No Cliente"\n📥 **Coleta**: Operador escaneia no cliente → Status volta para "Em Trânsito"\n🏭 **Recebimento**: Operador escaneia na fábrica → Status volta para "Ativo" + ciclo incrementado\n\nCada operação registra automaticamente geolocalização, data/hora e o usuário responsável.',
        roles: ['ADMIN', 'LOGISTICS'],
    },
    {
        q: 'O que são Geofences e para que servem?',
        a: 'Geofences são **zonas geográficas virtuais** (círculos definidos por centro + raio) que permitem ao sistema:\n\n- Validar automaticamente se uma operação logística está sendo realizada no local correto\n- Gerar alertas quando um barril entra/sai de uma zona inesperada\n- Associar barris a clientes por proximidade\n\nExistem 3 tipos: **Fábrica** (unidades produtivas), **Cliente** (PDVs) e **Restrita** (áreas proibidas).',
        roles: ['ADMIN', 'MANAGER'],
    },
    {
        q: 'Como exportar relatórios em CSV?',
        a: 'Em cada aba da página de **Relatórios**, há um botão **"Exportar CSV"** que baixa todos os dados da tabela atual. As abas disponíveis são: Ativos, Manutenção, Descartes e Componentes. Os dados exportados incluem todas as colunas visíveis na tabela.',
        roles: ['ADMIN', 'MANAGER'],
    },
    {
        q: 'O que fazer quando minha conta é bloqueada?',
        a: 'Após 5 tentativas incorretas de login, sua conta é bloqueada automaticamente por segurança. Para desbloquear:\n\n1. Entre em contato com o **Administrador** do seu tenant\n2. O administrador pode reativar sua conta pela página de Usuários\n3. Você receberá uma nova senha temporária\n4. Faça login e altere a senha no primeiro acesso',
        roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'],
    },
    {
        q: 'Como alterar minha senha?',
        a: 'No primeiro acesso ou quando solicitado:\n\n1. O sistema redireciona automaticamente para a página de **Alteração de Senha**\n2. Digite a senha atual\n3. Digite a nova senha (mínimo 8 caracteres, com letra maiúscula, minúscula, número e caractere especial)\n4. Confirme a nova senha\n5. Clique em "Alterar Senha"',
        roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'],
    },
    {
        q: 'Como funciona a busca de barris?',
        a: 'Na página de **Barris**, o campo de busca filtra automaticamente enquanto você digita (com um pequeno atraso de 400ms). Você pode buscar por:\n\n- **Código interno** (ex: KS-BAR-000000104)\n- **QR Code** (ex: TEST-QR-001)\n\nAlém disso, use o seletor ao lado para filtrar por **status** (Ativo, Em Trânsito, Manutenção, etc.).',
        roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'],
    },
    {
        q: 'O que é o TCO e como ele é calculado?',
        a: 'O **TCO (Total Cost of Ownership)** é o custo total de propriedade de um barril, calculado como:\n\n**TCO = Custo de Aquisição + Soma de todos os custos de manutenção**\n\nQuando o TCO ultrapassa um limiar (ex: 60% do custo de aquisição), o sistema sugere automaticamente o descarte do barril na seção de Sugestões da página de Descarte.',
        roles: ['ADMIN', 'MANAGER'],
    },
];

/* ------------------------------------------------------------------ */
/*  Component: ScreenshotImage                                         */
/* ------------------------------------------------------------------ */

function ScreenshotImage({ src, alt, role }: { src: string; alt: string; role: string }) {
    const resolved = src.replace('{role}', role.toLowerCase());
    return (
        <div className="rounded-lg border border-border overflow-hidden shadow-lg my-4">
            <Image
                src={resolved}
                alt={alt}
                width={1280}
                height={800}
                className="w-full h-auto"
                unoptimized
            />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Component: FaqAccordion                                            */
/* ------------------------------------------------------------------ */

function FaqAccordion({ item }: { item: FaqItem }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
            >
                {open ? <ChevronDown className="h-4 w-4 text-orange-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="font-medium text-foreground">{item.q}</span>
            </button>
            {open && (
                <div className="px-4 pb-4 pt-0 pl-11">
                    <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {item.a.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                            part.startsWith('**') && part.endsWith('**')
                                ? <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>
                                : <span key={i}>{part}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Component: SectionCard                                             */
/* ------------------------------------------------------------------ */

function SectionCard({ section, role }: { section: ManualSection; role: string }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = section.icon;

    return (
        <Card id={section.id} className="border-border scroll-mt-24">
            <CardContent className="p-6">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center gap-3 text-left"
                >
                    <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{section.description}</p>
                    </div>
                    {expanded
                        ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    }
                </button>

                {expanded && (
                    <div className="mt-5 space-y-5">
                        {/* Description */}
                        <div className="flex gap-3 p-4 rounded-lg bg-accent/30 border border-border">
                            <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
                        </div>

                        {/* Screenshot */}
                        <ScreenshotImage src={section.screenshot} alt={section.title} role={role} />

                        {/* Steps */}
                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <ArrowRight className="h-4 w-4 text-orange-400" />
                                Passo a passo
                            </h3>
                            <ol className="space-y-2 pl-4">
                                {section.steps.map((step, i) => (
                                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                        {step.startsWith('  •') ? (
                                            <span className="pl-4">{step}</span>
                                        ) : (
                                            <>
                                                <span className="text-orange-400 font-medium shrink-0">{i + 1}.</span>
                                                <span>{step}</span>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </div>

                        {/* Tips */}
                        {section.tips && (
                            <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4" />
                                    Dicas
                                </h3>
                                <ul className="space-y-1.5">
                                    {section.tips.map((tip, i) => (
                                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                            <span className="text-amber-400 shrink-0">•</span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador',
    MANAGER: 'Gestor',
    MAINTENANCE: 'Manutenção',
    LOGISTICS: 'Logística',
};

export default function ManualPage() {
    const { user } = useAuthStore();
    const [search, setSearch] = useState('');
    const role = user?.role || 'ADMIN';

    const filteredSections = useMemo(() => {
        return sections.filter(s => {
            if (!s.roles.includes(role)) return false;
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                s.title.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.steps.some(step => step.toLowerCase().includes(q)) ||
                (s.tips && s.tips.some(tip => tip.toLowerCase().includes(q)))
            );
        });
    }, [role, search]);

    const filteredFaq = useMemo(() => {
        return faqItems.filter(f => {
            if (!f.roles.includes(role)) return false;
            if (!search) return true;
            const q = search.toLowerCase();
            return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
        });
    }, [role, search]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Manual do Usuário</h1>
                        <p className="text-sm text-muted-foreground">
                            KegSafe Tech — Perfil: <Badge variant="outline" className="ml-1 text-orange-400 border-orange-400/30">{roleLabels[role] || role}</Badge>
                        </p>
                    </div>
                </div>
                <p className="text-muted-foreground text-sm mt-3">
                    Guia completo de utilização da plataforma KegSafe Tech. Este manual exibe apenas as funcionalidades disponíveis para o seu perfil de acesso ({roleLabels[role]}).
                </p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar no manual... (ex: barril, manutenção, alerta)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 border-border bg-muted/50 text-foreground placeholder:text-muted-foreground"
                />
            </div>

            {/* Quick Nav */}
            <Card className="border-border">
                <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-orange-400" />
                        Navegação Rápida
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {filteredSections.map(s => {
                            const Icon = s.icon;
                            return (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border"
                                >
                                    <Icon className="h-3 w-3" />
                                    {s.title.replace(/^\d+\.\s*/, '').split('—')[0].trim()}
                                </a>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Role Info Banner */}
            <div className="flex gap-3 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <Shield className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-foreground">Perfil: {roleLabels[role]}</p>
                    <p className="text-muted-foreground mt-0.5">
                        {role === 'ADMIN' && 'Você tem acesso completo a todas as funcionalidades do sistema, incluindo gerenciamento de usuários e componentes.'}
                        {role === 'MANAGER' && 'Você tem acesso às funcionalidades gerenciais: Dashboard, Barris, Manutenção, Alertas, Clientes, Geofences, Descarte e Relatórios.'}
                        {role === 'MAINTENANCE' && 'Você tem acesso às funcionalidades de manutenção: consulta de Barris, Ordens de Serviço e Alertas.'}
                        {role === 'LOGISTICS' && 'Você tem acesso às funcionalidades de logística: consulta de Barris e painel de Logística (operações via app mobile).'}
                    </p>
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-4">
                {filteredSections.map(section => (
                    <SectionCard key={section.id} section={section} role={role} />
                ))}
            </div>

            {search && filteredSections.length === 0 && filteredFaq.length === 0 && (
                <div className="text-center py-12">
                    <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum resultado encontrado para &quot;{search}&quot;</p>
                    <button onClick={() => setSearch('')} className="text-orange-400 text-sm mt-2 hover:underline">Limpar busca</button>
                </div>
            )}

            {/* FAQ */}
            {filteredFaq.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-orange-400" />
                        Perguntas Frequentes (FAQ)
                    </h2>
                    <div className="space-y-2">
                        {filteredFaq.map((item, i) => (
                            <FaqAccordion key={i} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="text-center py-8 border-t border-border">
                <p className="text-xs text-muted-foreground">
                    KegSafe Tech v1.0 — Manual do Usuário — Perfil {roleLabels[role]}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Em caso de dúvidas adicionais, entre em contato com o administrador do sistema.
                </p>
            </div>
        </div>
    );
}
