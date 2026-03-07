'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Search, BookOpen, LogIn, Building2, Plus, Package,
    ArrowRightLeft, Shield, ChevronDown, ChevronRight,
    HelpCircle, Info, Lightbulb, ArrowRight, Monitor
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  DATA: Sections                                                      */
/* ------------------------------------------------------------------ */

interface ManualSection {
    id: string;
    title: string;
    icon: any;
    description: string;
    screenshot: string;
    steps: string[];
    tips?: string[];
}

const sections: ManualSection[] = [
    {
        id: 'login',
        title: '1. Login — Acesso ao Painel Admin',
        icon: LogIn,
        description: 'O Super Admin acessa o sistema pela mesma tela de login dos demais usuários. Após autenticar com suas credenciais exclusivas, você será redirecionado automaticamente para o painel de administração da plataforma.',
        screenshot: '/manual/login.png',
        steps: [
            'Acesse o endereço do sistema no navegador',
            'Digite seu e-mail de Super Admin no campo "Email"',
            'Digite sua senha no campo "Senha"',
            'Clique no botão "Entrar"',
            'Você será redirecionado para o painel de administração (Super Admin)',
        ],
        tips: [
            'A conta de Super Admin é criada durante o provisionamento da plataforma',
            'Em caso de perda de credenciais, é necessário acesso direto ao banco de dados para reset',
            'O Super Admin não pertence a nenhum tenant específico — ele gerencia todos',
        ],
    },
    {
        id: 'tenants',
        title: '2. Tenants — Gerenciamento de Clientes',
        icon: Building2,
        description: 'A página principal do painel Super Admin lista todos os tenants (clientes/empresas) cadastrados na plataforma. Cada tenant é uma organização independente com seus próprios barris, usuários e configurações.',
        screenshot: '/manual/superadmin-tenants.png',
        steps: [
            'Ao fazer login como Super Admin, você é direcionado à listagem de Tenants',
            'Visualize os cards de tenants com: Nome, Slug, CNPJ, Status (Ativo/Inativo), quantidade de Barris e Usuários',
            'Use o campo de busca para localizar tenants por nome ou CNPJ',
            'Clique em um tenant para ver seus detalhes e configurações',
            'Use o badge de status para identificar rapidamente tenants ativos vs. inativos',
        ],
        tips: [
            'Cada tenant opera de forma isolada — dados de um tenant não são visíveis para outro',
            'O slug é usado internamente para identificação única do tenant',
            'Tenants inativos não permitem login de seus usuários',
        ],
    },
    {
        id: 'new-tenant',
        title: '3. Novo Tenant — Cadastro de Empresa',
        icon: Plus,
        description: 'Cadastre novas empresas (tenants) na plataforma KegSafe Tech. Cada novo tenant recebe automaticamente um administrador inicial e pode ser configurado com dados fiscais e de contato.',
        screenshot: '/manual/superadmin-new-tenant.png',
        steps: [
            'Clique em "Novo Tenant" no menu lateral',
            'Preencha os dados da empresa: Nome da Empresa, Slug (identificador único), CNPJ',
            'Preencha os dados do administrador inicial: Nome, E-mail e Senha',
            'Clique em "Criar Tenant"',
            'O sistema criará o tenant e o usuário administrador automaticamente',
            'O administrador do tenant poderá fazer login e configurar o restante (componentes, usuários, etc.)',
        ],
        tips: [
            'O slug deve ser único e usar apenas letras minúsculas, números e hífens',
            'O administrador criado será do perfil ADMIN e terá acesso total dentro do tenant',
            'Após a criação, o tenant já está ativo e pronto para uso',
        ],
    },
    {
        id: 'barrel-batches',
        title: '4. Lotes de Barris — Geração em Massa',
        icon: Package,
        description: 'Gerencie a criação de barris em lote para os tenants. Esta funcionalidade permite gerar múltiplos barris de uma só vez, com códigos sequenciais automáticos, capacidade e materiais pré-definidos.',
        screenshot: '/manual/superadmin-batches.png',
        steps: [
            'Clique em "Lotes de Barris" no menu lateral',
            'Visualize o histórico de lotes já criados com: Tenant, Quantidade, Material, Capacidade e Data',
            'Para criar um novo lote, clique em "Novo Lote"',
            'Selecione o Tenant de destino',
            'Defina: Quantidade de Barris, Capacidade (litros), Material (Aço Inox, Alumínio, etc.), Peso Tara e Custo de Aquisição',
            'Clique em "Criar Lote" — os barris serão gerados com códigos sequenciais automáticos',
        ],
        tips: [
            'Os barris criados em lote iniciam com status "Pré-Registrado" e precisam ser ativados',
            'Cada barril recebe um código único no formato KS-BAR-XXXXXXXXX',
            'É possível criar lotes para qualquer tenant ativo da plataforma',
            'O custo de aquisição definido aqui será usado para cálculos de TCO e sugestões de descarte',
        ],
    },
    {
        id: 'transfers',
        title: '5. Transferências — Movimentação entre Tenants',
        icon: ArrowRightLeft,
        description: 'Transfira barris entre tenants (empresas). Esta funcionalidade é usada quando barris são vendidos, emprestados ou realocados entre organizações diferentes na plataforma.',
        screenshot: '/manual/superadmin-transfer.png',
        steps: [
            'Clique em "Transferências" no menu lateral',
            'Visualize o histórico de transferências com: Barril, Tenant de Origem, Tenant de Destino, Data e Status',
            'Para iniciar uma nova transferência, clique em "Nova Transferência"',
            'Selecione o Tenant de Origem e busque o barril pelo código',
            'Selecione o Tenant de Destino',
            'Adicione notas ou motivo da transferência (opcional)',
            'Confirme a operação — o barril será movido para o inventário do tenant de destino',
        ],
        tips: [
            'A transferência preserva o histórico completo do barril (ciclos, manutenções, etc.)',
            'Apenas barris com status "Ativo" podem ser transferidos entre tenants',
            'A operação é registrada na auditoria para rastreabilidade completa',
            'Os componentes e suas configurações de saúde acompanham o barril na transferência',
        ],
    },
    {
        id: 'audit',
        title: '6. Auditoria — Registro de Operações',
        icon: Shield,
        description: 'O módulo de Auditoria registra todas as operações críticas realizadas na plataforma: criação de tenants, transferências de barris, alterações de configuração e operações administrativas. Cada registro inclui o usuário responsável, data/hora e detalhes da ação.',
        screenshot: '/manual/superadmin-audit.png',
        steps: [
            'Clique em "Auditoria" no menu lateral',
            'Visualize a lista cronológica de todas as operações registradas',
            'Cada registro mostra: Ação, Tipo de Entidade, Usuário, Tenant Alvo, Data/Hora e IP',
            'Use os filtros para buscar por ação, entidade ou período',
            'Clique em um registro para expandir e ver os detalhes completos (payload JSON)',
        ],
        tips: [
            'Os registros de auditoria são imutáveis — não podem ser editados ou excluídos',
            'Todas as operações de Super Admin são registradas automaticamente',
            'Use a auditoria para investigar problemas, validar operações e garantir compliance',
            'O IP e User Agent do operador são capturados para segurança',
        ],
    },
];

/* ------------------------------------------------------------------ */
/*  FAQ                                                                 */
/* ------------------------------------------------------------------ */

interface FaqItem {
    q: string;
    a: string;
}

const faqItems: FaqItem[] = [
    {
        q: 'Qual a diferença entre Super Admin e Admin de Tenant?',
        a: 'O **Super Admin** gerencia a plataforma como um todo: cria tenants, transfere barris entre empresas, gera lotes e audita operações. Ele não pertence a nenhum tenant.\n\nO **Admin de Tenant** gerencia apenas a sua própria organização: configura componentes, gerencia usuários, monitora barris, cria OS e acompanha relatórios.',
    },
    {
        q: 'Como criar um novo tenant na plataforma?',
        a: '1. Acesse **Novo Tenant** no menu lateral\n2. Preencha os dados da empresa (Nome, Slug, CNPJ)\n3. Preencha os dados do primeiro administrador (Nome, E-mail, Senha)\n4. Clique em **"Criar Tenant"**\n\nO tenant estará imediatamente ativo e o administrador poderá fazer login para configurar a operação.',
    },
    {
        q: 'Como transferir barris entre empresas?',
        a: 'Acesse **Transferências** no menu lateral e clique em **"Nova Transferência"**. Selecione o tenant de origem, busque o barril pelo código, selecione o tenant de destino e confirme. O barril será movido com todo o seu histórico preservado.',
    },
    {
        q: 'O que acontece com os dados do barril após uma transferência?',
        a: 'O barril mantém **todo o seu histórico**: ciclos acumulados, registros de manutenção, saúde dos componentes e timeline logística. Apenas a propriedade (tenant) muda. A operação fica registrada na auditoria.',
    },
    {
        q: 'Como gerar barris em lote para um tenant?',
        a: '1. Acesse **Lotes de Barris** no menu lateral\n2. Clique em **"Novo Lote"**\n3. Selecione o tenant de destino\n4. Defina: quantidade, capacidade, material, peso tara e custo\n5. Clique em **"Criar Lote"**\n\nOs barris serão gerados com códigos sequenciais automáticos e status "Pré-Registrado".',
    },
    {
        q: 'Como desativar um tenant?',
        a: 'Na listagem de **Tenants**, acesse os detalhes do tenant desejado e altere o status para **Inativo**. Quando inativo:\n\n- Nenhum usuário do tenant consegue fazer login\n- Os dados permanecem preservados no sistema\n- O tenant pode ser reativado a qualquer momento',
    },
    {
        q: 'Os registros de auditoria podem ser excluídos?',
        a: 'Não. Os registros de auditoria são **imutáveis** e permanentes. Eles não podem ser editados, excluídos ou alterados de forma alguma. Isso garante a integridade e rastreabilidade completa de todas as operações da plataforma.',
    },
    {
        q: 'Posso acessar os dados internos de um tenant?',
        a: 'O painel Super Admin é focado na **gestão da plataforma** (tenants, lotes, transferências e auditoria). Para ver dados internos de um tenant (barris, OS, alertas), é necessário fazer login como um usuário daquele tenant específico.',
    },
];

/* ------------------------------------------------------------------ */
/*  Component: ScreenshotImage                                         */
/* ------------------------------------------------------------------ */

function ScreenshotImage({ src, alt }: { src: string; alt: string }) {
    return (
        <div className="rounded-lg border border-border overflow-hidden shadow-lg my-4">
            <Image
                src={src}
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
                {open ? <ChevronDown className="h-4 w-4 text-indigo-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
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

function SectionCard({ section }: { section: ManualSection }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = section.icon;

    return (
        <Card id={section.id} className="border-border scroll-mt-24">
            <CardContent className="p-6">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center gap-3 text-left"
                >
                    <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-indigo-400" />
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
                        <ScreenshotImage src={section.screenshot} alt={section.title} />

                        {/* Steps */}
                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <ArrowRight className="h-4 w-4 text-indigo-400" />
                                Passo a passo
                            </h3>
                            <ol className="space-y-2 pl-4">
                                {section.steps.map((step, i) => (
                                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                        {step.startsWith('  ') ? (
                                            <span className="pl-4">{step}</span>
                                        ) : (
                                            <>
                                                <span className="text-indigo-400 font-medium shrink-0">{i + 1}.</span>
                                                <span>{step}</span>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </div>

                        {/* Tips */}
                        {section.tips && (
                            <div className="p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                                <h3 className="text-sm font-semibold text-indigo-400 mb-2 flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4" />
                                    Dicas
                                </h3>
                                <ul className="space-y-1.5">
                                    {section.tips.map((tip, i) => (
                                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                            <span className="text-indigo-400 shrink-0">•</span>
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

export default function SuperAdminManualPage() {
    const [search, setSearch] = useState('');

    const filteredSections = useMemo(() => {
        return sections.filter(s => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                s.title.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.steps.some(step => step.toLowerCase().includes(q)) ||
                (s.tips && s.tips.some(tip => tip.toLowerCase().includes(q)))
            );
        });
    }, [search]);

    const filteredFaq = useMemo(() => {
        return faqItems.filter(f => {
            if (!search) return true;
            const q = search.toLowerCase();
            return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
        });
    }, [search]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Manual do Super Admin</h1>
                        <p className="text-sm text-muted-foreground">
                            KegSafe Tech — <Badge variant="outline" className="ml-1 text-indigo-400 border-indigo-400/30">Super Administrador</Badge>
                        </p>
                    </div>
                </div>
                <p className="text-muted-foreground text-sm mt-3">
                    Guia completo de administração da plataforma KegSafe Tech. Este manual cobre todas as funcionalidades exclusivas do Super Admin: gerenciamento de tenants, lotes de barris, transferências e auditoria.
                </p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar no manual... (ex: tenant, transferência, lote)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 border-border bg-muted/50 text-foreground placeholder:text-muted-foreground"
                />
            </div>

            {/* Quick Nav */}
            <Card className="border-border">
                <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-indigo-400" />
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
            <div className="flex gap-3 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                <Shield className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-foreground">Perfil: Super Administrador</p>
                    <p className="text-muted-foreground mt-0.5">
                        Você tem acesso ao painel de administração da plataforma. Gerencie tenants, gere lotes de barris, transfira barris entre empresas e audite todas as operações do sistema.
                    </p>
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-4">
                {filteredSections.map(section => (
                    <SectionCard key={section.id} section={section} />
                ))}
            </div>

            {search && filteredSections.length === 0 && filteredFaq.length === 0 && (
                <div className="text-center py-12">
                    <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum resultado encontrado para &quot;{search}&quot;</p>
                    <button onClick={() => setSearch('')} className="text-indigo-400 text-sm mt-2 hover:underline">Limpar busca</button>
                </div>
            )}

            {/* FAQ */}
            {filteredFaq.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-indigo-400" />
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
                    KegSafe Tech v1.0 — Manual do Super Administrador
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Este painel é restrito a Super Admins da plataforma.
                </p>
            </div>
        </div>
    );
}
