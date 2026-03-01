'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Package, TrendingDown, BarChart3 } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

export default function ReportsPage() {
    const [costData, setCostData] = useState<any>(null);
    const [turnoverData, setTurnoverData] = useState<any>(null);
    const [lossData, setLossData] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            api.get('/api/dashboard/cost-per-liter'),
            api.get('/api/dashboard/asset-turnover'),
            api.get('/api/dashboard/loss-report'),
        ]).then(([c, t, l]) => {
            setCostData(c.data);
            setTurnoverData(t.data);
            setLossData(l.data);
        }).catch(() => toast.error('Erro ao carregar relatórios'));
    }, []);

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Relatórios</h1>
                    <p className="text-sm text-zinc-400 mt-1">Análise financeira e operacional</p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                                <DollarSign className="h-4 w-4 text-green-400" /> Custo por Litro
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-4xl font-bold text-white">R$ {costData?.costPerLiter || '0.00'}</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-zinc-800/50 p-3">
                                    <p className="text-lg font-bold text-zinc-200">R$ {Number(costData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    <p className="text-xs text-zinc-500">Custo Total</p>
                                </div>
                                <div className="rounded-lg bg-zinc-800/50 p-3">
                                    <p className="text-lg font-bold text-zinc-200">{Number(costData?.totalLiters || 0).toLocaleString('pt-BR')}L</p>
                                    <p className="text-xs text-zinc-500">Litros Transportados</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                                <BarChart3 className="h-4 w-4 text-purple-400" /> Giro de Ativos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-4xl font-bold text-white">{turnoverData?.avgCyclesPerBarrel || 0} <span className="text-lg text-zinc-500 font-normal">ciclos/barril</span></p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-zinc-800/50 p-3">
                                    <p className="text-lg font-bold text-zinc-200">{turnoverData?.totalBarrels || 0}</p>
                                    <p className="text-xs text-zinc-500">Barris Analisados</p>
                                </div>
                                <div className="rounded-lg bg-zinc-800/50 p-3">
                                    <p className="text-lg font-bold text-zinc-200">{turnoverData?.totalCycles || 0}</p>
                                    <p className="text-xs text-zinc-500">Ciclos Totais</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-800 bg-zinc-900/50 lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                                <TrendingDown className="h-4 w-4 text-red-400" /> Relatório de Perdas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-4 text-center">
                                    <p className="text-2xl font-bold text-red-400">{lossData?.lost?.count || 0}</p>
                                    <p className="text-xs text-zinc-500">Perdidos</p>
                                    <p className="text-sm text-red-400 mt-1">R$ {Number(lossData?.lost?.estimatedValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-4 text-center">
                                    <p className="text-2xl font-bold text-amber-400">{lossData?.blocked || 0}</p>
                                    <p className="text-xs text-zinc-500">Bloqueados</p>
                                </div>
                                <div className="rounded-lg bg-zinc-500/5 border border-zinc-500/10 p-4 text-center">
                                    <p className="text-2xl font-bold text-zinc-400">{lossData?.disposed || 0}</p>
                                    <p className="text-xs text-zinc-500">Descartados</p>
                                </div>
                            </div>
                            {lossData?.lost?.barrels?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-zinc-500 uppercase">Barris perdidos</p>
                                    {lossData.lost.barrels.map((b: any) => (
                                        <div key={b.id} className="flex items-center justify-between rounded-lg bg-zinc-800/30 p-3">
                                            <span className="text-sm text-zinc-300 font-mono">{b.internalCode}</span>
                                            <span className="text-xs text-zinc-500">R$ {Number(b.acquisitionCost || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </RoleGuard>
    );
}
