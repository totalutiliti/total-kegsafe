'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Lightbulb, ChevronLeft, ChevronRight, BarChart3, Undo2 } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string }> = {
    SUGGESTED: { label: 'Sugerido', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    PENDING_APPROVAL: { label: 'Aguardando', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    APPROVED: { label: 'Aprovado', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    COMPLETED: { label: 'Concluído', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20' },
    REJECTED: { label: 'Rejeitado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export default function DisposalPage() {
    const [disposals, setDisposals] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        fetchData();
    }, [page]);

    useEffect(() => {
        if (viewMode === 'analytics' && !analytics) {
            api.get('/disposals/analytics').then(({ data }) => setAnalytics(data)).catch(() => toast.error('Erro ao carregar analytics'));
        }
    }, [viewMode]);

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            api.get('/disposals', { params: { page, limit } }),
            api.get('/disposals/suggestions'),
        ]).then(([d, s]) => {
            setDisposals(d.data.items);
            setTotal(d.data.total);
            setSuggestions(s.data);
        }).catch(() => toast.error('Erro ao carregar descartes'))
          .finally(() => setLoading(false));
    };

    const handleRevert = async (id: string) => {
        if (!confirm('Reverter este descarte? O barril voltará ao status Ativo.')) return;
        try {
            await api.delete(`/disposals/${id}/revert`);
            toast.success('Descarte revertido com sucesso');
            fetchData();
        } catch { toast.error('Erro ao reverter descarte'); }
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Descarte</h1>
                        <p className="text-sm text-muted-foreground mt-1">Gestão de baixa patrimonial</p>
                    </div>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-none">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant={viewMode === 'analytics' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('analytics')} className="rounded-none">
                            <BarChart3 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {viewMode === 'analytics' && analytics ? (
                    <div className="space-y-6">
                        {/* Summary cards */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                            <Card className="border-border bg-card/50">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">{analytics.summary.totalDisposals}</p>
                                    <p className="text-[11px] text-muted-foreground">Total Descartes</p>
                                </CardContent>
                            </Card>
                            <Card className="border-border bg-card/50">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-red-400">{analytics.summary.prematureCount}</p>
                                    <p className="text-[11px] text-muted-foreground">Prematuros</p>
                                </CardContent>
                            </Card>
                            <Card className="border-border bg-card/50">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">{analytics.summary.prematurePercentage}%</p>
                                    <p className="text-[11px] text-muted-foreground">Taxa Prematura</p>
                                </CardContent>
                            </Card>
                            <Card className="border-border bg-card/50">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">{analytics.summary.avgAgeYears}a</p>
                                    <p className="text-[11px] text-muted-foreground">Idade Média</p>
                                </CardContent>
                            </Card>
                            <Card className="border-border bg-card/50">
                                <CardContent className="p-4 text-center">
                                    <p className="text-2xl font-bold text-foreground">R$ {analytics.summary.avgTco}</p>
                                    <p className="text-[11px] text-muted-foreground">TCO Médio</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* By destination */}
                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-foreground">Por Destino</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    {Object.entries(analytics.byDestination || {}).map(([dest, count]) => (
                                        <div key={dest} className="rounded-lg bg-muted/50 p-3 text-center min-w-[100px]">
                                            <p className="text-lg font-bold text-foreground">{count as number}</p>
                                            <p className="text-[11px] text-muted-foreground">{dest}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Scatter data table */}
                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-foreground">Descartes Detalhados</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {analytics.scatterData?.map((d: any) => (
                                        <div key={d.id} className={`flex items-center justify-between rounded-lg p-3 ${d.isPremature ? 'bg-red-500/5 border border-red-500/10' : 'bg-muted/30'}`}>
                                            <div>
                                                <span className="text-sm font-medium text-foreground">{d.barrelCode}</span>
                                                {d.isPremature && <Badge variant="outline" className="ml-2 text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Prematuro</Badge>}
                                                <p className="text-[11px] text-muted-foreground">{d.reason?.slice(0, 60)}...</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-foreground">{d.ageYears ?? '?'} anos</p>
                                                <p className="text-[11px] text-muted-foreground">{d.lifePercentage ?? '?'}% vida</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <>
                        {suggestions.length > 0 && (
                            <Card className="border-amber-500/20 bg-amber-500/5">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Lightbulb className="h-5 w-5 text-amber-400" />
                                        <h3 className="text-sm font-medium text-amber-300">Sugestões de Descarte</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3">Barris com custo de manutenção superior a 60% do valor de aquisição:</p>
                                    <div className="space-y-2">
                                        {suggestions.slice(0, 5).map((barrel: any) => (
                                            <div key={barrel.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <span className="text-sm font-medium text-foreground">{barrel.internalCode}</span>
                                                    <span className="ml-3 text-xs text-muted-foreground">Manutenção: R$ {Number(barrel.totalMaintenanceCost).toFixed(2)}</span>
                                                </div>
                                                <Button variant="outline" size="sm" className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10">
                                                    Solicitar
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <p className="text-muted-foreground">Carregando...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {disposals.length === 0 ? (
                                    <Card className="border-border bg-card/50">
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <Trash2 className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">Nenhuma solicitação de descarte</p>
                                        </CardContent>
                                    </Card>
                                ) : disposals.map((d) => {
                                    const sc = statusConfig[d.status] || statusConfig.PENDING_APPROVAL;
                                    return (
                                        <Card key={d.id} className="border-border bg-card/50">
                                            <CardContent className="flex items-center gap-4 p-5">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                                                    <Trash2 className="h-5 w-5 text-red-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-medium text-foreground">{d.barrel?.internalCode}</span>
                                                        <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                                        {d.destination && <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{d.destination}</Badge>}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">{d.reason}</p>
                                                    {d.requestedBy && <p className="text-[11px] text-muted-foreground mt-0.5">Solicitado por: {d.requestedBy.name}</p>}
                                                </div>
                                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                    <p className="text-sm text-foreground">TCO: R$ {Number(d.tcoAccumulated).toFixed(2)}</p>
                                                    {d.status === 'COMPLETED' && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleRevert(d.id)} className="text-amber-400 hover:text-amber-300 text-[11px] h-6 px-2">
                                                            <Undo2 className="h-3 w-3 mr-1" /> Reverter
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                                    Página {page} de {totalPages}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="border-border text-foreground hover:bg-accent"
                                    >
                                        <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline ml-1">Anterior</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        className="border-border text-foreground hover:bg-accent"
                                    >
                                        <span className="hidden sm:inline mr-1">Próximo</span><ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </RoleGuard>
    );
}
