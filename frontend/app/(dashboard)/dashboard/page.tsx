'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/lib/use-api';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Package, TrendingUp, AlertTriangle, DollarSign, Wrench, Truck, MapPin, Ban, Star, Clock, Building2, Warehouse } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { RoleGuard } from '@/components/role-guard';
import { useTheme } from '@/lib/theme-provider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFavorites } from '@/hooks/use-favorites';
import { useRecentHistory } from '@/hooks/use-recent-history';

const STATUS_LABEL_TO_CODE: Record<string, string> = {
    'Ativos': 'ACTIVE',
    'Em Trânsito': 'IN_TRANSIT',
    'No Cliente': 'AT_CLIENT',
    'No Pátio': 'IN_YARD',
    'Manutenção': 'IN_MAINTENANCE',
    'Bloqueados': 'BLOCKED',
    'Perdidos': 'LOST',
};

const HEALTH_LABEL_TO_CODE: Record<string, string> = {
    'Verde': 'GREEN',
    'Amarelo': 'YELLOW',
    'Vermelho': 'RED',
};

const STATUS_COLORS: Record<string, string> = {
    active: '#22c55e',
    inTransit: '#3b82f6',
    atClient: '#a855f7',
    inYard: '#14b8a6',
    inMaintenance: '#f59e0b',
    blocked: '#ef4444',
    disposed: '#6b7280',
    lost: '#dc2626',
};

export default function DashboardPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const { data: fleetData, isLoading: loadingFleet } = useApiQuery(['dashboard', 'fleet'], '/dashboard/fleet-health');
    const { data: costData } = useApiQuery(['dashboard', 'cost'], '/dashboard/cost-per-liter');
    const { data: turnoverData } = useApiQuery(['dashboard', 'turnover'], '/dashboard/asset-turnover');
    const { data: alertCounts } = useApiQuery(['alerts', 'counts'], '/alerts/counts');
    const { data: bigNumbers } = useApiQuery(['reports', 'big-numbers'], '/reports/big-numbers');
    const { favorites } = useFavorites();
    const { history } = useRecentHistory();

    // Theme-aware chart colors for axes
    const axisStroke = theme === 'dark' ? '#3f3f46' : '#d4d4d8';
    const axisTickFill = theme === 'dark' ? '#a1a1aa' : '#71717a';

    if (loadingFleet) {
        return <DashboardSkeleton />;
    }

    const barrels = fleetData?.barrels || {};
    const health = fleetData?.componentHealth || {};

    const pieData = [
        { name: 'Ativos', value: barrels.active || 0, color: STATUS_COLORS.active },
        { name: 'Em Trânsito', value: barrels.inTransit || 0, color: STATUS_COLORS.inTransit },
        { name: 'No Cliente', value: barrels.atClient || 0, color: STATUS_COLORS.atClient },
        { name: 'No Pátio', value: barrels.inYard || 0, color: STATUS_COLORS.inYard },
        { name: 'Manutenção', value: barrels.inMaintenance || 0, color: STATUS_COLORS.inMaintenance },
        { name: 'Bloqueados', value: barrels.blocked || 0, color: STATUS_COLORS.blocked },
        { name: 'Perdidos', value: barrels.lost || 0, color: STATUS_COLORS.lost },
    ].filter(d => d.value > 0);

    const healthBarData = [
        { name: 'Verde', value: health.green || 0, fill: '#22c55e' },
        { name: 'Amarelo', value: health.yellow || 0, fill: '#f59e0b' },
        { name: 'Vermelho', value: health.red || 0, fill: '#ef4444' },
    ];

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Visão geral da frota e indicadores-chave</p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/barrels">
                        <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-blue-500/40 hover:bg-card/80">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Barris</p>
                                        <p className="mt-2 text-3xl font-bold text-foreground">{barrels.total || 0}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{barrels.active || 0} disponíveis</p>
                                    </div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                                        <Package className="h-6 w-6 text-blue-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/reports">
                        <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-green-500/40 hover:bg-card/80">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custo/Litro</p>
                                        <p className="mt-2 text-3xl font-bold text-foreground">R$ {costData?.costPerLiter || '0.00'}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{costData?.totalLiters || 0}L transportados</p>
                                    </div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                                        <DollarSign className="h-6 w-6 text-green-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/reports">
                        <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-purple-500/40 hover:bg-card/80">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Giro Médio</p>
                                        <p className="mt-2 text-3xl font-bold text-foreground">{turnoverData?.avgCyclesPerBarrel || 0}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">ciclos/barril</p>
                                    </div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10">
                                        <TrendingUp className="h-6 w-6 text-purple-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/alerts">
                        <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-red-500/40 hover:bg-card/80">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alertas Ativos</p>
                                        <p className="mt-2 text-3xl font-bold text-foreground">{alertCounts?.total || 0}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{alertCounts?.critical || 0} críticos</p>
                                    </div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                                        <AlertTriangle className="h-6 w-6 text-red-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Fleet Distribution */}
                    <Card className="border-border bg-card/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-foreground">Distribuição da Frota</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
                                <div className="h-40 w-40 sm:h-48 sm:w-48 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value"
                                                onClick={(data) => {
                                                    if (!data?.name) return;
                                                    const statusCode = STATUS_LABEL_TO_CODE[data.name as string];
                                                    if (statusCode) router.push(`/barrels?status=${statusCode}`);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {pieData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} stroke="transparent" />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-full flex-1 space-y-2">
                                    {pieData.map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                <span className="text-muted-foreground">{entry.name}</span>
                                            </div>
                                            <span className="font-medium text-foreground">{entry.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Component Health */}
                    <Card className="border-border bg-card/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-foreground">Saúde dos Componentes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={healthBarData} layout="vertical" margin={{ left: 10 }}>
                                        <XAxis type="number" stroke={axisStroke} tick={{ fill: axisTickFill, fontSize: 12 }} />
                                        <YAxis dataKey="name" type="category" stroke={axisStroke} tick={{ fill: axisTickFill, fontSize: 12 }} width={70} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                            labelStyle={{ color: 'var(--foreground)' }}
                                            itemStyle={{ color: 'var(--muted-foreground)' }}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(data) => {
                                            if (!data?.name) return;
                                            const healthCode = HEALTH_LABEL_TO_CODE[data.name as string];
                                            if (healthCode) router.push(`/barrels?health=${healthCode}`);
                                        }} style={{ cursor: 'pointer' }}>
                                            {healthBarData.map((entry, i) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Operational Big Numbers */}
                {bigNumbers && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <Link href="/maintenance">
                            <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-amber-500/40 hover:bg-card/80">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">{bigNumbers.openMaintenanceOrders || 0}</p>
                                    <p className="text-[11px] text-muted-foreground">OS Abertas</p>
                                </CardContent>
                            </Card>
                        </Link>
                        <Link href="/disposal">
                            <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-zinc-500/40 hover:bg-card/80">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">{bigNumbers.pendingDisposals || 0}</p>
                                    <p className="text-[11px] text-muted-foreground">Descartes Pendentes</p>
                                </CardContent>
                            </Card>
                        </Link>
                        <Link href="/settings/components">
                            <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-red-500/40 hover:bg-card/80">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-red-400">{bigNumbers.redComponents || 0}</p>
                                    <p className="text-[11px] text-muted-foreground">Componentes Críticos</p>
                                </CardContent>
                            </Card>
                        </Link>
                        <Link href="/reports">
                            <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-blue-500/40 hover:bg-card/80">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">{bigNumbers.totalCycles || 0}</p>
                                    <p className="text-[11px] text-muted-foreground">Ciclos Totais</p>
                                </CardContent>
                            </Card>
                        </Link>
                        <Link href="/alerts">
                            <Card className="border-border bg-card/50 cursor-pointer transition-colors hover:border-red-500/40 hover:bg-card/80">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">{bigNumbers.unresolvedAlerts || 0}</p>
                                    <p className="text-[11px] text-muted-foreground">Alertas Não Resolvidos</p>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                )}

                {/* Status Quick Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                    {[
                        { label: 'Em Trânsito', icon: Truck, value: barrels.inTransit, color: 'text-blue-400 bg-blue-500/10', status: 'IN_TRANSIT', hoverBorder: 'hover:border-blue-500/40' },
                        { label: 'No Cliente', icon: MapPin, value: barrels.atClient, color: 'text-purple-400 bg-purple-500/10', status: 'AT_CLIENT', hoverBorder: 'hover:border-purple-500/40' },
                        { label: 'No Pátio', icon: Warehouse, value: barrels.inYard, color: 'text-teal-400 bg-teal-500/10', status: 'IN_YARD', hoverBorder: 'hover:border-teal-500/40' },
                        { label: 'Manutenção', icon: Wrench, value: barrels.inMaintenance, color: 'text-amber-400 bg-amber-500/10', status: 'IN_MAINTENANCE', hoverBorder: 'hover:border-amber-500/40' },
                        { label: 'Bloqueados', icon: Ban, value: barrels.blocked, color: 'text-red-400 bg-red-500/10', status: 'BLOCKED', hoverBorder: 'hover:border-red-500/40' },
                        { label: 'Descartados', icon: Package, value: barrels.disposed, color: 'text-muted-foreground bg-zinc-500/10', status: 'DISPOSED', hoverBorder: 'hover:border-zinc-500/40' },
                        { label: 'Perdidos', icon: AlertTriangle, value: barrels.lost, color: 'text-red-400 bg-red-500/10', status: 'LOST', hoverBorder: 'hover:border-red-500/40' },
                    ].map((item, i) => (
                        <Link key={i} href={`/barrels?status=${item.status}`}>
                            <Card className={`border-border bg-card/50 cursor-pointer transition-colors ${item.hoverBorder} hover:bg-card/80`}>
                                <CardContent className="flex items-center gap-3 p-4">
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.color.split(' ')[1]}`}>
                                        <item.icon className={`h-4.5 w-4.5 ${item.color.split(' ')[0]}`} />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-foreground">{item.value || 0}</p>
                                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {/* Favorites & Recent History */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Favorites */}
                    {favorites.length > 0 && (
                        <Card className="border-border bg-card/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                                    <Star className="h-4 w-4 text-amber-400" /> Favoritos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {favorites.slice(0, 8).map((fav) => (
                                        <Link key={fav.id} href={fav.href}>
                                            <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30 transition-colors cursor-pointer">
                                                {fav.type === 'barrel' ? (
                                                    <Package className="h-4 w-4 text-amber-400 shrink-0" />
                                                ) : (
                                                    <Building2 className="h-4 w-4 text-purple-400 shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{fav.label}</p>
                                                    {fav.sublabel && <p className="text-[11px] text-muted-foreground truncate">{fav.sublabel}</p>}
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recent History */}
                    {history.length > 0 && (
                        <Card className="border-border bg-card/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-blue-400" /> Acessados Recentemente
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {history.slice(0, 8).map((item) => (
                                        <Link key={item.id} href={item.href}>
                                            <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30 transition-colors cursor-pointer">
                                                <Package className="h-4 w-4 text-amber-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                                                    {item.sublabel && <p className="text-[11px] text-muted-foreground truncate">{item.sublabel}</p>}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground shrink-0">
                                                    {new Date(item.visitedAt).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </RoleGuard>
    );
}
