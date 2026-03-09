'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    DollarSign, Package, TrendingDown, BarChart3, Download,
    FileText, Wrench, AlertTriangle, Skull, FileDown,
} from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast-with-sound';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';

// ===== CHART COLORS HOOK (resolves CSS vars for SVG) =====
interface ChartColors { text: string; card: string; border: string; fg: string }

function useChartColors(): ChartColors {
    const [colors, setColors] = useState<ChartColors>({ text: '#a1a1aa', card: '#18181b', border: '#27272a', fg: '#fafafa' });

    const updateColors = useCallback(() => {
        if (typeof window === 'undefined') return;
        // Read actual computed colors from a hidden element to resolve oklch/hsl/etc to rgb
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);

        const resolveColor = (cssVar: string, fallback: string) => {
            probe.style.color = `var(${cssVar})`;
            const computed = getComputedStyle(probe).color;
            return computed && computed !== '' ? computed : fallback;
        };

        setColors({
            text: resolveColor('--muted-foreground', '#a1a1aa'),
            card: resolveColor('--card', '#18181b'),
            border: resolveColor('--border', '#27272a'),
            fg: resolveColor('--foreground', '#fafafa'),
        });

        document.body.removeChild(probe);
    }, []);

    useEffect(() => {
        updateColors();
        const observer = new MutationObserver(updateColors);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
        return () => observer.disconnect();
    }, [updateColors]);

    return colors;
}

type ReportTab = 'overview' | 'assets' | 'maintenance' | 'disposals' | 'loss-analysis' | 'components';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
const HEALTH_COLORS: Record<string, string> = { GREEN: '#10b981', YELLOW: '#f59e0b', RED: '#ef4444' };
const STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Ativo', IN_TRANSIT: 'Em Trânsito', AT_CLIENT: 'No Cliente',
    IN_MAINTENANCE: 'Em Manutenção', BLOCKED: 'Bloqueado', DISPOSED: 'Descartado',
    LOST: 'Perdido', PENDING_ACTIVATION: 'Pend. Ativação',
};
const STATUS_LABELS_REVERSE: Record<string, string> = Object.fromEntries(
    Object.entries(STATUS_LABELS).map(([k, v]) => [v, k])
);
const MAINT_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendente', IN_PROGRESS: 'Em Andamento', COMPLETED: 'Concluída', CANCELLED: 'Cancelada',
};
const DISPOSAL_STATUS_LABELS: Record<string, string> = {
    PENDING_APPROVAL: 'Pend. Aprovação', APPROVED: 'Aprovado', IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluído', REJECTED: 'Rejeitado',
};
const DISPOSAL_REASON_LABELS: Record<string, string> = {
    CORROSION: 'Corrosão', STRUCTURAL_DAMAGE: 'Dano Estrutural',
    VALVE_FAILURE: 'Falha Válvula', EXCESSIVE_WEAR: 'Desgaste',
    LOGISTICS_ACCIDENT: 'Acidente Logístico', REGULATORY: 'Regulatório',
    HIGH_TCO: 'TCO Elevado', OTHER: 'Outro',
};

function downloadCsv(endpoint: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        window.open(`${API_BASE}/api/v1${endpoint}?token=${token}`, '_blank');
    } else {
        window.open(`${API_BASE}/api/v1${endpoint}`, '_blank');
    }
}

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
    const counts: Record<string, number> = {};
    arr.forEach(item => {
        const k = key(item);
        counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
}

function toChartData(counts: Record<string, number>, labels?: Record<string, string>) {
    return Object.entries(counts)
        .map(([name, value]) => ({ name: labels?.[name] || name, value }))
        .sort((a, b) => b.value - a.value);
}

function chartTooltip(cc: ChartColors) {
    return {
        contentStyle: { background: cc.card, border: `1px solid ${cc.border}`, color: cc.fg, borderRadius: 8 },
        itemStyle: { color: cc.fg },
        labelStyle: { color: cc.fg },
    };
}

// ===== ASSET REPORT TAB =====
function AssetReport({ data, cc }: { data: any[]; cc: ChartColors }) {
    const router = useRouter();
    const statusCounts = countBy(data, d => d.status);
    const statusChart = toChartData(statusCounts, STATUS_LABELS);
    const materialCounts = countBy(data, d => d.material);
    const materialChart = toChartData(materialCounts);

    const totalCost = data.reduce((s, d) => s + Number(d.totalMaintenanceCost || 0), 0);
    const totalAcquisition = data.reduce((s, d) => s + Number(d.acquisitionCost || 0), 0);
    const avgCycles = data.length ? Math.round(data.reduce((s, d) => s + (d.totalCycles || 0), 0) / data.length) : 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total de Barris" value={data.length} />
                <KpiCard label="Ciclos Médios" value={avgCycles} />
                <KpiCard label="Custo Manutenção" value={`R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <KpiCard label="Custo Aquisição" value={`R$ ${totalAcquisition.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Distribuição por Status">
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                                label={({ name, value }) => `${name}: ${value}`}
                                onClick={(data) => {
                                    if (!data?.name) return;
                                    const statusCode = STATUS_LABELS_REVERSE[data.name as string];
                                    if (statusCode) router.push(`/barrels?status=${statusCode}`);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                {statusChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...chartTooltip(cc)} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Distribuição por Material">
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={materialChart}>
                            <XAxis dataKey="name" tick={{ fill: cc.text, fontSize: 11 }} />
                            <YAxis tick={{ fill: cc.text, fontSize: 11 }} />
                            <Tooltip {...chartTooltip(cc)} />
                            <Bar dataKey="value" name="Barris" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
            <DataTable
                columns={['Código', 'Chassi', 'Status', 'Material', 'Capacidade', 'Ciclos', 'Custo Manut.', 'Componentes']}
                rows={data.slice(0, 100).map(d => [
                    d.internalCode, d.chassisNumber || '-', STATUS_LABELS[d.status] || d.status,
                    d.material, `${d.capacityLiters}L`, d.totalCycles,
                    `R$ ${Number(d.totalMaintenanceCost || 0).toFixed(2)}`,
                    `${(d.components || []).length} (${(d.components || []).filter((c: any) => c.healthScore === 'RED').length} crit.)`,
                ])}
                total={data.length}
            />
        </div>
    );
}

// ===== MAINTENANCE REPORT TAB =====
function MaintenanceReport({ data, cc }: { data: any[]; cc: ChartColors }) {
    const statusCounts = countBy(data, d => d.status);
    const statusChart = toChartData(statusCounts, MAINT_STATUS_LABELS);
    const typeCounts = countBy(data, d => d.orderType);
    const typeChart = toChartData(typeCounts);

    const totalEstimated = data.reduce((s, d) => s + Number(d.estimatedCost || 0), 0);
    const totalActual = data.reduce((s, d) => s + Number(d.actualCost || 0), 0);
    const completed = data.filter(d => d.status === 'COMPLETED').length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total de Ordens" value={data.length} />
                <KpiCard label="Concluídas" value={completed} />
                <KpiCard label="Custo Estimado" value={`R$ ${totalEstimated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <KpiCard label="Custo Real" value={`R$ ${totalActual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Por Status">
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                                {statusChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...chartTooltip(cc)} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Por Tipo">
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={typeChart}>
                            <XAxis dataKey="name" tick={{ fill: cc.text, fontSize: 11 }} />
                            <YAxis tick={{ fill: cc.text, fontSize: 11 }} />
                            <Tooltip {...chartTooltip(cc)} />
                            <Bar dataKey="value" name="Ordens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
            <DataTable
                columns={['Ordem', 'Barril', 'Tipo', 'Status', 'Prioridade', 'Fornecedor', 'Custo Est.', 'Custo Real', 'Criação']}
                rows={data.slice(0, 100).map(d => [
                    d.orderNumber, d.barrelCode, d.orderType,
                    MAINT_STATUS_LABELS[d.status] || d.status, d.priority,
                    d.provider || '-',
                    d.estimatedCost ? `R$ ${Number(d.estimatedCost).toFixed(2)}` : '-',
                    d.actualCost ? `R$ ${Number(d.actualCost).toFixed(2)}` : '-',
                    new Date(d.createdAt).toLocaleDateString('pt-BR'),
                ])}
                total={data.length}
            />
        </div>
    );
}

// ===== DISPOSAL REPORT TAB =====
function DisposalReport({ data, cc }: { data: any[]; cc: ChartColors }) {
    const statusCounts = countBy(data, d => d.status);
    const statusChart = toChartData(statusCounts, DISPOSAL_STATUS_LABELS);
    const reasonCounts = countBy(data, d => d.reason);
    const reasonChart = toChartData(reasonCounts);

    const totalTco = data.reduce((s, d) => s + Number(d.tcoAccumulated || 0), 0);
    const totalScrap = data.reduce((s, d) => s + Number(d.scrapValue || 0), 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total Descartes" value={data.length} />
                <KpiCard label="Concluídos" value={data.filter(d => d.status === 'COMPLETED').length} />
                <KpiCard label="TCO Acumulado" value={`R$ ${totalTco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <KpiCard label="Valor Sucata" value={`R$ ${totalScrap.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Por Status">
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                                {statusChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...chartTooltip(cc)} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Por Motivo">
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={reasonChart}>
                            <XAxis dataKey="name" tick={{ fill: cc.text, fontSize: 11 }} />
                            <YAxis tick={{ fill: cc.text, fontSize: 11 }} />
                            <Tooltip {...chartTooltip(cc)} />
                            <Bar dataKey="value" name="Descartes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
            <DataTable
                columns={['Barril', 'Status', 'Motivo', 'Destino', 'TCO', 'Custo Repos.', 'Sucata', 'Solicitante', 'Data']}
                rows={data.slice(0, 100).map(d => [
                    d.barrelCode, DISPOSAL_STATUS_LABELS[d.status] || d.status,
                    d.reason, d.destination || '-',
                    `R$ ${Number(d.tcoAccumulated || 0).toFixed(2)}`, `R$ ${Number(d.replacementCost || 0).toFixed(2)}`,
                    d.scrapValue ? `R$ ${Number(d.scrapValue).toFixed(2)}` : '-',
                    d.requestedBy, new Date(d.createdAt).toLocaleDateString('pt-BR'),
                ])}
                total={data.length}
            />
        </div>
    );
}

// ===== COMPONENT REPORT TAB =====
function ComponentReport({ data, cc }: { data: any[]; cc: ChartColors }) {
    const router = useRouter();
    const healthCounts = countBy(data, d => d.healthScore);
    const healthChart = toChartData(healthCounts).map(d => ({ ...d, fill: HEALTH_COLORS[d.name] || '#888' }));

    const compNameCounts = countBy(data, d => d.componentName);
    const compHealthData = Object.keys(compNameCounts).map(name => {
        const items = data.filter(d => d.componentName === name);
        return {
            name,
            green: items.filter(i => i.healthScore === 'GREEN').length,
            yellow: items.filter(i => i.healthScore === 'YELLOW').length,
            red: items.filter(i => i.healthScore === 'RED').length,
        };
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total Registros" value={data.length} />
                <KpiCard label="Saudáveis" value={healthCounts['GREEN'] || 0} color="text-green-400" />
                <KpiCard label="Atenção" value={healthCounts['YELLOW'] || 0} color="text-yellow-400" />
                <KpiCard label="Críticos" value={healthCounts['RED'] || 0} color="text-red-400" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Saúde Geral">
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={healthChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                                label={({ name, value }) => `${name}: ${value}`}
                                onClick={(data) => {
                                    if (data?.name && ['GREEN', 'YELLOW', 'RED'].includes(data.name as string)) {
                                        router.push(`/barrels?health=${data.name}`);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                {healthChart.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Pie>
                            <Tooltip {...chartTooltip(cc)} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Saúde por Componente">
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={compHealthData} layout="vertical">
                            <XAxis type="number" tick={{ fill: cc.text, fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" width={130} tick={{ fill: cc.text, fontSize: 10 }} />
                            <Tooltip {...chartTooltip(cc)} />
                            <Legend />
                            <Bar dataKey="green" name="Green" stackId="a" fill="#10b981" />
                            <Bar dataKey="yellow" name="Yellow" stackId="a" fill="#f59e0b" />
                            <Bar dataKey="red" name="Red" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
            <DataTable
                columns={['Barril', 'Componente', 'Criticidade', 'Saúde', 'Ciclos Usados', 'Máx Ciclos', 'Restantes', 'Última Manut.']}
                rows={data.slice(0, 100).map(d => [
                    d.barrelCode, d.componentName, d.criticality,
                    d.healthScore,
                    d.cyclesSinceLastService, d.maxCycles, d.remainingCycles,
                    d.lastServiceDate ? new Date(d.lastServiceDate).toLocaleDateString('pt-BR') : '-',
                ])}
                total={data.length}
                healthColumn={3}
            />
        </div>
    );
}

// ===== LOSS ANALYSIS TAB =====
function LossAnalysisReport({ data, cc }: { data: any; cc: ChartColors }) {
    if (!data?.summary) return <p className="text-muted-foreground text-center py-8">Nenhum dado de análise de perdas</p>;

    const { summary, byReason, byClient, byMonth } = data;

    const reasonChart = (byReason || []).map((r: any) => ({
        name: DISPOSAL_REASON_LABELS[r.reason] || r.reason,
        value: r.count,
        loss: r.totalLoss,
    }));

    const clientChart = (byClient || []).slice(0, 10).map((c: any) => ({
        name: c.clientName.length > 15 ? c.clientName.slice(0, 15) + '...' : c.clientName,
        value: c.count,
        loss: c.totalLoss,
    }));

    const monthChart = (byMonth || []).map((m: any) => ({
        name: m.month,
        descartes: m.count,
        perda: Number((m.totalLoss / 1000).toFixed(1)),
    }));

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
                <KpiCard label="Total Descartes" value={summary.totalDisposals} />
                <KpiCard label="Perda Total" value={`R$ ${summary.totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-red-400" />
                <KpiCard label="Sucata Recuperada" value={`R$ ${summary.totalScrapRecovered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-green-400" />
                <KpiCard label="Perda Média" value={`R$ ${summary.avgLossPerDisposal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <KpiCard label="Prematuros" value={summary.prematureCount} color="text-amber-400" />
                <KpiCard label="Taxa Prematura" value={`${summary.prematurePercentage}%`} color="text-amber-400" />
            </div>

            {/* Charts row 1: By Reason + By Client */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Descartes por Motivo">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={reasonChart} layout="vertical">
                            <XAxis type="number" tick={{ fill: cc.text, fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" width={120} tick={{ fill: cc.text, fontSize: 10 }} />
                            <Tooltip {...chartTooltip(cc)} formatter={(value: any, name: any) =>
                                name === 'loss' ? [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Perda'] : [value, 'Qtd']
                            } />
                            <Bar dataKey="value" name="Qtd" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Descartes por Cliente (Top 10)">
                    {clientChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={clientChart} layout="vertical">
                                <XAxis type="number" tick={{ fill: cc.text, fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={120} tick={{ fill: cc.text, fontSize: 10 }} />
                                <Tooltip {...chartTooltip(cc)} formatter={(value: any, name: any) =>
                                    name === 'loss' ? [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Perda'] : [value, 'Qtd']
                                } />
                                <Bar dataKey="value" name="Qtd" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-muted-foreground text-center py-12 text-sm">Sem dados de cliente</p>
                    )}
                </ChartCard>
            </div>

            {/* Chart row 2: Timeline */}
            {monthChart.length > 1 && (
                <ChartCard title="Evolução Mensal de Descartes">
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={monthChart}>
                            <XAxis dataKey="name" tick={{ fill: cc.text, fontSize: 11 }} />
                            <YAxis yAxisId="left" tick={{ fill: cc.text, fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: cc.text, fontSize: 11 }} />
                            <Tooltip {...chartTooltip(cc)} formatter={(value: any, name: any) =>
                                name === 'perda' ? [`R$ ${(Number(value) * 1000).toLocaleString('pt-BR')}`, 'Perda'] : [value, 'Descartes']
                            } />
                            <Legend />
                            <Bar yAxisId="left" dataKey="descartes" name="Descartes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="right" dataKey="perda" name="Perda (R$ mil)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* Detail tables */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Reason breakdown table */}
                <Card className="border-border bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Detalhamento por Motivo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {(byReason || []).map((r: any) => (
                                <div key={r.reason} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                                    <div>
                                        <span className="text-sm font-medium text-foreground">{DISPOSAL_REASON_LABELS[r.reason] || r.reason}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">{r.count} barris</span>
                                    </div>
                                    <span className="text-sm text-red-400 font-medium">R$ {r.totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                            {(!byReason || byReason.length === 0) && (
                                <p className="text-muted-foreground text-center py-4 text-sm">Nenhum dado</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Client breakdown table */}
                <Card className="border-border bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Detalhamento por Cliente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {(byClient || []).map((c: any, i: number) => (
                                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                                    <div>
                                        <span className="text-sm font-medium text-foreground">{c.clientName}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">{c.count} barris</span>
                                    </div>
                                    <span className="text-sm text-red-400 font-medium">R$ {c.totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                            {(!byClient || byClient.length === 0) && (
                                <p className="text-muted-foreground text-center py-4 text-sm">Nenhum dado</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ===== SHARED COMPONENTS =====
function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <Card className="border-border bg-card/50">
            <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
            </CardContent>
        </Card>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card className="border-border bg-card/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function DataTable({ columns, rows, total, healthColumn }: { columns: string[]; rows: (string | number)[][]; total: number; healthColumn?: number }) {
    return (
        <Card className="border-border bg-card/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Dados ({total} registros{total > 100 ? ' — mostrando 100 primeiros' : ''})
                </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-border">
                            {columns.map((col, i) => (
                                <th key={i} className="text-left p-2 text-muted-foreground font-medium whitespace-nowrap">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri} className="border-b border-border/50 hover:bg-muted/30">
                                {row.map((cell, ci) => (
                                    <td key={ci} className={`p-2 whitespace-nowrap ${
                                        healthColumn !== undefined && ci === healthColumn
                                            ? cell === 'GREEN' ? 'text-green-400 font-medium'
                                                : cell === 'YELLOW' ? 'text-yellow-400 font-medium'
                                                : cell === 'RED' ? 'text-red-400 font-medium'
                                                : 'text-foreground'
                                            : 'text-foreground'
                                    }`}>
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td colSpan={columns.length} className="p-8 text-center text-muted-foreground">Nenhum dado encontrado</td></tr>
                        )}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}

// ===== OVERVIEW =====
function Overview({ costData, turnoverData, lossData }: { costData: any; turnoverData: any; lossData: any }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <DollarSign className="h-4 w-4 text-green-400" /> Custo por Litro
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-4xl font-bold text-foreground">R$ {costData?.costPerLiter || '0.00'}</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-lg font-bold text-foreground">R$ {Number(costData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-xs text-muted-foreground">Custo Total</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-lg font-bold text-foreground">{Number(costData?.totalLiters || 0).toLocaleString('pt-BR')}L</p>
                                <p className="text-xs text-muted-foreground">Litros Transportados</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <BarChart3 className="h-4 w-4 text-purple-400" /> Giro de Ativos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-4xl font-bold text-foreground">{turnoverData?.avgCyclesPerBarrel || 0} <span className="text-lg text-muted-foreground font-normal">ciclos/barril</span></p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-lg font-bold text-foreground">{turnoverData?.totalBarrels || 0}</p>
                                <p className="text-xs text-muted-foreground">Barris Analisados</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-lg font-bold text-foreground">{turnoverData?.totalCycles || 0}</p>
                                <p className="text-xs text-muted-foreground">Ciclos Totais</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/50 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <TrendingDown className="h-4 w-4 text-red-400" /> Relatório de Perdas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-4 text-center">
                                <p className="text-2xl font-bold text-red-400">{lossData?.lost?.count || 0}</p>
                                <p className="text-xs text-muted-foreground">Perdidos</p>
                                <p className="text-sm text-red-400 mt-1">R$ {Number(lossData?.lost?.estimatedValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-4 text-center">
                                <p className="text-2xl font-bold text-amber-400">{lossData?.blocked || 0}</p>
                                <p className="text-xs text-muted-foreground">Bloqueados</p>
                            </div>
                            <div className="rounded-lg bg-zinc-500/5 border border-zinc-500/10 p-4 text-center">
                                <p className="text-2xl font-bold text-muted-foreground">{lossData?.disposed || 0}</p>
                                <p className="text-xs text-muted-foreground">Descartados</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ===== TAB CONFIG =====
const tabs: { key: ReportTab; label: string; icon: React.ReactNode; csvEndpoint?: string }[] = [
    { key: 'overview', label: 'Visão Geral', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'assets', label: 'Ativos', icon: <FileText className="h-4 w-4" />, csvEndpoint: '/reports/assets/csv' },
    { key: 'maintenance', label: 'Manutenção', icon: <Wrench className="h-4 w-4" />, csvEndpoint: '/reports/maintenance/csv' },
    { key: 'disposals', label: 'Descartes', icon: <Package className="h-4 w-4" />, csvEndpoint: '/reports/disposals/csv' },
    { key: 'loss-analysis', label: 'Análise de Perdas', icon: <Skull className="h-4 w-4" /> },
    { key: 'components', label: 'Componentes', icon: <AlertTriangle className="h-4 w-4" />, csvEndpoint: '/reports/components/csv' },
];

// ===== MAIN PAGE =====
export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<ReportTab>('overview');
    const [costData, setCostData] = useState<any>(null);
    const [turnoverData, setTurnoverData] = useState<any>(null);
    const [lossData, setLossData] = useState<any>(null);
    const [reportData, setReportData] = useState<any[]>([]);
    const [lossAnalysisData, setLossAnalysisData] = useState<any>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [period, setPeriod] = useState<string>('all');
    const cc = useChartColors();

    const getPeriodDates = (p: string): { from?: string; to?: string } => {
        if (p === 'all') return {};
        const to = new Date().toISOString();
        const from = new Date();
        switch (p) {
            case '7d': from.setDate(from.getDate() - 7); break;
            case '30d': from.setDate(from.getDate() - 30); break;
            case '90d': from.setDate(from.getDate() - 90); break;
            case '1y': from.setFullYear(from.getFullYear() - 1); break;
        }
        return { from: from.toISOString(), to };
    };

    useEffect(() => {
        Promise.all([
            api.get('/dashboard/cost-per-liter'),
            api.get('/dashboard/asset-turnover'),
            api.get('/dashboard/loss-report'),
        ]).then(([c, t, l]) => {
            setCostData(c.data);
            setTurnoverData(t.data);
            setLossData(l.data);
        }).catch(() => toast.error('Erro ao carregar relatórios'));
    }, []);

    useEffect(() => {
        if (activeTab === 'overview') return;
        setLoadingReport(true);
        setReportData([]);

        const dateParams = getPeriodDates(period);

        if (activeTab === 'loss-analysis') {
            api.get('/reports/loss-analysis', { params: dateParams })
                .then(r => setLossAnalysisData(r.data))
                .catch(() => toast.error('Erro ao carregar análise de perdas'))
                .finally(() => setLoadingReport(false));
            return;
        }

        const endpointMap: Record<string, string> = {
            assets: '/reports/assets',
            maintenance: '/reports/maintenance',
            disposals: '/reports/disposals',
            components: '/reports/components',
        };
        api.get(endpointMap[activeTab], { params: dateParams })
            .then(r => setReportData(Array.isArray(r.data) ? r.data : []))
            .catch(() => toast.error('Erro ao carregar relatório'))
            .finally(() => setLoadingReport(false));
    }, [activeTab, period]);

    const currentTabConfig = tabs.find(t => t.key === activeTab);

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
                        <p className="text-sm text-muted-foreground mt-1">Análise financeira e operacional</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => window.print()}
                            variant="outline"
                            className="border-border text-foreground no-print"
                        >
                            <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
                        </Button>
                        {activeTab !== 'overview' && currentTabConfig?.csvEndpoint && (
                            <Button
                                onClick={() => downloadCsv(currentTabConfig.csvEndpoint!)}
                                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 no-print"
                            >
                                <Download className="mr-2 h-4 w-4" /> Exportar CSV
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit flex-wrap">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Period Filter */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Período:</span>
                    <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
                        {[
                            { key: '7d', label: '7 dias' },
                            { key: '30d', label: '30 dias' },
                            { key: '90d', label: '90 dias' },
                            { key: '1y', label: '1 ano' },
                            { key: 'all', label: 'Tudo' },
                        ].map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                    period === p.key
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'overview' ? (
                    <Overview costData={costData} turnoverData={turnoverData} lossData={lossData} />
                ) : loadingReport ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Carregando relatório...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'assets' && <AssetReport data={reportData} cc={cc} />}
                        {activeTab === 'maintenance' && <MaintenanceReport data={reportData} cc={cc} />}
                        {activeTab === 'disposals' && <DisposalReport data={reportData} cc={cc} />}
                        {activeTab === 'loss-analysis' && <LossAnalysisReport data={lossAnalysisData} cc={cc} />}
                        {activeTab === 'components' && <ComponentReport data={reportData} cc={cc} />}
                    </>
                )}
            </div>
        </RoleGuard>
    );
}
