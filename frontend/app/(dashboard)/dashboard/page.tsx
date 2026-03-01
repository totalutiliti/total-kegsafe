'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/lib/use-api';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { Package, TrendingUp, AlertTriangle, DollarSign, Wrench, Truck, MapPin, Ban } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { RoleGuard } from '@/components/role-guard';

const STATUS_COLORS: Record<string, string> = {
    active: '#22c55e',
    inTransit: '#3b82f6',
    atClient: '#a855f7',
    inMaintenance: '#f59e0b',
    blocked: '#ef4444',
    disposed: '#6b7280',
    lost: '#dc2626',
};

export default function DashboardPage() {
    const { data: fleetData, isLoading: loadingFleet } = useApiQuery(['dashboard', 'fleet'], '/api/dashboard/fleet-health');
    const { data: costData } = useApiQuery(['dashboard', 'cost'], '/api/dashboard/cost-per-liter');
    const { data: turnoverData } = useApiQuery(['dashboard', 'turnover'], '/api/dashboard/asset-turnover');
    const { data: alertCounts } = useApiQuery(['alerts', 'counts'], '/api/alerts/counts');

    if (loadingFleet) {
        return <DashboardSkeleton />;
    }

    const barrels = fleetData?.barrels || {};
    const health = fleetData?.componentHealth || {};

    const pieData = [
        { name: 'Ativos', value: barrels.active || 0, color: STATUS_COLORS.active },
        { name: 'Em Trânsito', value: barrels.inTransit || 0, color: STATUS_COLORS.inTransit },
        { name: 'No Cliente', value: barrels.atClient || 0, color: STATUS_COLORS.atClient },
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
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-sm text-zinc-400 mt-1">Visão geral da frota e indicadores-chave</p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Barris</p>
                                    <p className="mt-2 text-3xl font-bold text-white">{barrels.total || 0}</p>
                                    <p className="mt-1 text-xs text-zinc-500">{barrels.active || 0} disponíveis</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                                    <Package className="h-6 w-6 text-blue-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Custo/Litro</p>
                                    <p className="mt-2 text-3xl font-bold text-white">R$ {costData?.costPerLiter || '0.00'}</p>
                                    <p className="mt-1 text-xs text-zinc-500">{costData?.totalLiters || 0}L transportados</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                                    <DollarSign className="h-6 w-6 text-green-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Giro Médio</p>
                                    <p className="mt-2 text-3xl font-bold text-white">{turnoverData?.avgCyclesPerBarrel || 0}</p>
                                    <p className="mt-1 text-xs text-zinc-500">ciclos/barril</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10">
                                    <TrendingUp className="h-6 w-6 text-purple-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Alertas Ativos</p>
                                    <p className="mt-2 text-3xl font-bold text-white">{alertCounts?.total || 0}</p>
                                    <p className="mt-1 text-xs text-zinc-500">{alertCounts?.critical || 0} críticos</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                                    <AlertTriangle className="h-6 w-6 text-red-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Fleet Distribution */}
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-300">Distribuição da Frota</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-8">
                                <div className="h-48 w-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                                {pieData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} stroke="transparent" />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1 space-y-2">
                                    {pieData.map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                <span className="text-zinc-400">{entry.name}</span>
                                            </div>
                                            <span className="font-medium text-zinc-200">{entry.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Component Health */}
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-300">Saúde dos Componentes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={healthBarData} layout="vertical" margin={{ left: 10 }}>
                                        <XAxis type="number" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                                        <YAxis dataKey="name" type="category" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 12 }} width={70} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                            labelStyle={{ color: '#e4e4e7' }}
                                            itemStyle={{ color: '#a1a1aa' }}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
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

                {/* Status Quick Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                        { label: 'Em Trânsito', icon: Truck, value: barrels.inTransit, color: 'text-blue-400 bg-blue-500/10' },
                        { label: 'No Cliente', icon: MapPin, value: barrels.atClient, color: 'text-purple-400 bg-purple-500/10' },
                        { label: 'Manutenção', icon: Wrench, value: barrels.inMaintenance, color: 'text-amber-400 bg-amber-500/10' },
                        { label: 'Bloqueados', icon: Ban, value: barrels.blocked, color: 'text-red-400 bg-red-500/10' },
                        { label: 'Descartados', icon: Package, value: barrels.disposed, color: 'text-zinc-400 bg-zinc-500/10' },
                        { label: 'Perdidos', icon: AlertTriangle, value: barrels.lost, color: 'text-red-400 bg-red-500/10' },
                    ].map((item, i) => (
                        <Card key={i} className="border-zinc-800 bg-zinc-900/50">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.color.split(' ')[1]}`}>
                                    <item.icon className={`h-4.5 w-4.5 ${item.color.split(' ')[0]}`} />
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-white">{item.value || 0}</p>
                                    <p className="text-[11px] text-zinc-500">{item.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </RoleGuard>
    );
}
