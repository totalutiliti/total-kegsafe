'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Package, TrendingDown, BarChart3, Download, FileText, Wrench, AlertTriangle } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';

function downloadCsv(endpoint: string, filename: string) {
    window.open(`${API_BASE}/api/v1${endpoint}`, '_blank');
}

export default function ReportsPage() {
    const [costData, setCostData] = useState<any>(null);
    const [turnoverData, setTurnoverData] = useState<any>(null);
    const [lossData, setLossData] = useState<any>(null);

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

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
                        <p className="text-sm text-muted-foreground mt-1">Análise financeira e operacional</p>
                    </div>
                </div>

                {/* CSV Export Buttons */}
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Download className="h-4 w-4" /> Exportar Relatórios (CSV)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" size="sm" onClick={() => downloadCsv('/reports/assets/csv', 'assets-report.csv')}>
                                <FileText className="h-4 w-4 mr-2" /> Ativos
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadCsv('/reports/maintenance/csv', 'maintenance-report.csv')}>
                                <Wrench className="h-4 w-4 mr-2" /> Manutenção
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadCsv('/reports/disposals/csv', 'disposals-report.csv')}>
                                <Package className="h-4 w-4 mr-2" /> Descartes
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadCsv('/reports/components/csv', 'components-report.csv')}>
                                <AlertTriangle className="h-4 w-4 mr-2" /> Componentes
                            </Button>
                        </div>
                    </CardContent>
                </Card>

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
                            <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-3">
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
                            {lossData?.lost?.barrels?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase">Barris perdidos</p>
                                    {lossData.lost.barrels.map((b: any) => (
                                        <div key={b.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                                            <span className="text-sm text-foreground font-mono">{b.internalCode}</span>
                                            <span className="text-xs text-muted-foreground">R$ {Number(b.acquisitionCost || 0).toFixed(2)}</span>
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
