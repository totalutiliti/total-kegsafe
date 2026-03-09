'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Trash2,
    Lightbulb,
    ChevronLeft,
    ChevronRight,
    BarChart3,
    Undo2,
    Plus,
    Search,
    Eye,
    CheckCircle2,
    PackageCheck,
    Calendar,
    User,
    DollarSign,
} from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from '@/lib/toast-with-sound';

const statusConfig: Record<string, { label: string; color: string }> = {
    SUGGESTED: { label: 'Sugerido', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    PENDING_APPROVAL: { label: 'Aguardando', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    APPROVED: { label: 'Aprovado', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    COMPLETED: { label: 'Concluído', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20' },
    REJECTED: { label: 'Rejeitado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const destinationLabels: Record<string, string> = {
    SCRAP_SALE: 'Venda Sucata',
    RECYCLING: 'Reciclagem',
    DONATION: 'Doação',
};

const disposalReasons = [
    { value: 'CORROSION', label: 'Corrosão' },
    { value: 'STRUCTURAL_DAMAGE', label: 'Dano Estrutural' },
    { value: 'VALVE_FAILURE', label: 'Falha de Válvula' },
    { value: 'EXCESSIVE_WEAR', label: 'Desgaste Excessivo' },
    { value: 'LOGISTICS_ACCIDENT', label: 'Acidente Logístico' },
    { value: 'REGULATORY', label: 'Regulatório' },
    { value: 'HIGH_TCO', label: 'TCO Elevado' },
    { value: 'OTHER', label: 'Outro' },
];

const reasonLabels: Record<string, string> = Object.fromEntries(
    disposalReasons.map((r) => [r.value, r.label]),
);

const statusFilters = [
    { value: '', label: 'Todos' },
    { value: 'PENDING_APPROVAL', label: 'Aguardando' },
    { value: 'APPROVED', label: 'Aprovados' },
    { value: 'COMPLETED', label: 'Concluídos' },
    { value: 'REJECTED', label: 'Rejeitados' },
];

export default function DisposalPage() {
    const [disposals, setDisposals] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');
    const [statusFilter, setStatusFilter] = useState('');
    const [limit, setLimit] = useState(20);
    const totalPages = Math.ceil(total / limit);

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [barrelSearch, setBarrelSearch] = useState('');
    const [barrelResults, setBarrelResults] = useState<any[]>([]);
    const [selectedBarrel, setSelectedBarrel] = useState<any>(null);
    const [createDisposalReason, setCreateDisposalReason] = useState('');
    const [createReason, setCreateReason] = useState('');
    const [creating, setCreating] = useState(false);

    // Detail dialog
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedDisposal, setSelectedDisposal] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Complete dialog
    const [completeOpen, setCompleteOpen] = useState(false);
    const [completeDestination, setCompleteDestination] = useState('SCRAP_SALE');
    const [completeScrapValue, setCompleteScrapValue] = useState('');
    const [completeNotes, setCompleteNotes] = useState('');
    const [completing, setCompleting] = useState(false);

    // Approve
    const [approving, setApproving] = useState(false);

    // Revert confirm
    const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
    const [revertTarget, setRevertTarget] = useState<string | null>(null);
    const [reverting, setReverting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [page, statusFilter, limit]);

    useEffect(() => {
        if (viewMode === 'analytics' && !analytics) {
            api.get('/disposals/analytics').then(({ data }) => setAnalytics(data)).catch(() => toast.error('Erro ao carregar analytics'));
        }
    }, [viewMode]);

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            api.get('/disposals', { params: { page, limit, ...(statusFilter ? { status: statusFilter } : {}) } }),
            api.get('/disposals/suggestions'),
        ]).then(([d, s]) => {
            setDisposals(d.data.items);
            setTotal(d.data.total);
            setSuggestions(s.data);
        }).catch(() => toast.error('Erro ao carregar descartes'))
          .finally(() => setLoading(false));
    };

    // Barrel search for create dialog
    const searchBarrels = useCallback(async (q: string) => {
        if (q.length < 2) { setBarrelResults([]); return; }
        try {
            const { data } = await api.get('/barrels', { params: { search: q, limit: 8 } });
            setBarrelResults(data.items || []);
        } catch { setBarrelResults([]); }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => searchBarrels(barrelSearch), 300);
        return () => clearTimeout(t);
    }, [barrelSearch, searchBarrels]);

    const handleCreate = async () => {
        if (!selectedBarrel || createReason.length < 3) {
            toast.error('Selecione um barril e forneça um motivo (mín. 3 caracteres)');
            return;
        }
        setCreating(true);
        try {
            await api.post('/disposals', {
                barrelId: selectedBarrel.id,
                reason: createReason,
                ...(createDisposalReason ? { disposalReason: createDisposalReason } : {}),
            });
            toast.success('Solicitação de descarte criada');
            setCreateOpen(false);
            resetCreateForm();
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao criar descarte');
        } finally { setCreating(false); }
    };

    const handleCreateFromSuggestion = (barrel: any) => {
        setSelectedBarrel(barrel);
        setBarrelSearch(barrel.internalCode);
        setCreateDisposalReason('HIGH_TCO');
        setCreateReason(`TCO acumulado (R$ ${Number(barrel.totalMaintenanceCost).toFixed(2)}) excede limite recomendado. Descarte sugerido pelo sistema.`);
        setCreateOpen(true);
    };

    const resetCreateForm = () => {
        setBarrelSearch('');
        setBarrelResults([]);
        setSelectedBarrel(null);
        setCreateDisposalReason('');
        setCreateReason('');
    };

    const openDetail = async (disposal: any) => {
        setDetailLoading(true);
        setDetailOpen(true);
        try {
            const { data } = await api.get(`/disposals/${disposal.id}`);
            setSelectedDisposal(data);
        } catch {
            setSelectedDisposal(disposal);
        } finally { setDetailLoading(false); }
    };

    const handleApprove = async () => {
        if (!selectedDisposal) return;
        setApproving(true);
        try {
            await api.post(`/disposals/${selectedDisposal.id}/approve`);
            toast.success('Descarte aprovado');
            setDetailOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao aprovar');
        } finally { setApproving(false); }
    };

    const openComplete = () => {
        setCompleteDestination('SCRAP_SALE');
        setCompleteScrapValue('');
        setCompleteNotes('');
        setCompleteOpen(true);
    };

    const handleComplete = async () => {
        if (!selectedDisposal) return;
        setCompleting(true);
        try {
            await api.post(`/disposals/${selectedDisposal.id}/complete`, {
                destination: completeDestination,
                ...(completeScrapValue ? { scrapValue: Number(completeScrapValue) } : {}),
                ...(completeNotes ? { notes: completeNotes } : {}),
            });
            toast.success('Descarte concluído');
            setCompleteOpen(false);
            setDetailOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao concluir');
        } finally { setCompleting(false); }
    };

    const handleRevert = async () => {
        if (!revertTarget) return;
        setReverting(true);
        try {
            await api.delete(`/disposals/${revertTarget}/revert`);
            toast.success('Descarte revertido com sucesso');
            setRevertConfirmOpen(false);
            setRevertTarget(null);
            setDetailOpen(false);
            fetchData();
        } catch { toast.error('Erro ao reverter descarte'); }
        finally { setReverting(false); }
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Descarte</h1>
                        <p className="text-sm text-muted-foreground mt-1">Gestão de baixa patrimonial</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => { resetCreateForm(); setCreateOpen(true); }}
                            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-900/20"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Novo Descarte
                        </Button>
                        <div className="flex rounded-lg border border-border overflow-hidden">
                            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-none">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant={viewMode === 'analytics' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('analytics')} className="rounded-none">
                                <BarChart3 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {viewMode === 'analytics' && analytics ? (
                    <div className="space-y-6">
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

                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-foreground">Por Destino</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    {Object.entries(analytics.byDestination || {}).map(([dest, count]) => (
                                        <div key={dest} className="rounded-lg bg-muted/50 p-3 text-center min-w-[100px]">
                                            <p className="text-lg font-bold text-foreground">{count as number}</p>
                                            <p className="text-[11px] text-muted-foreground">{destinationLabels[dest] || dest}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

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
                        {/* Status filter */}
                        <div className="flex gap-2 flex-wrap">
                            {statusFilters.map((f) => (
                                <Button
                                    key={f.value}
                                    variant={statusFilter === f.value ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => { setStatusFilter(f.value); setPage(1); }}
                                    className={statusFilter === f.value ? '' : 'border-border text-muted-foreground hover:bg-accent'}
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>

                        {/* Suggestions */}
                        {suggestions.length > 0 && !statusFilter && (
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
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                                                    onClick={() => handleCreateFromSuggestion(barrel)}
                                                >
                                                    Solicitar
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Disposal list */}
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
                                        <Card
                                            key={d.id}
                                            className="border-border bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                                            onClick={() => openDetail(d)}
                                        >
                                            <CardContent className="flex items-center gap-4 p-5">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                                                    <Trash2 className="h-5 w-5 text-red-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="text-sm font-medium text-foreground">{d.barrel?.internalCode}</span>
                                                        <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                                        {d.disposalReason && <Badge variant="outline" className="text-[10px] border-red-500/20 text-red-400 bg-red-500/5">{reasonLabels[d.disposalReason] || d.disposalReason}</Badge>}
                                                        {d.destination && <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{destinationLabels[d.destination] || d.destination}</Badge>}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">{d.reason}</p>
                                                    {d.requestedBy && <p className="text-[11px] text-muted-foreground mt-0.5">Solicitado por: {d.requestedBy.name}</p>}
                                                </div>
                                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                    <p className="text-sm text-foreground">R$ {Number(d.tcoAccumulated).toFixed(2)}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {new Date(d.createdAt).toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">Itens:</span>
                                        <Select value={String(limit)} onValueChange={v => { setLimit(Number(v)); setPage(1); }}>
                                            <SelectTrigger className="w-[70px] h-8 text-xs border-border bg-muted/50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="border-border bg-card">
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                                        Página {page} de {totalPages}
                                    </p>
                                </div>
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

            {/* ── Create Disposal Dialog ── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nova Solicitação de Descarte</DialogTitle>
                        <DialogDescription className="sr-only">Solicite o descarte de um barril</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Barrel search */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Barril</label>
                            {selectedBarrel ? (
                                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                                    <div>
                                        <span className="text-sm font-medium text-foreground">{selectedBarrel.internalCode}</span>
                                        {selectedBarrel.chassisNumber && (
                                            <span className="ml-2 text-xs text-muted-foreground">Chassi: {selectedBarrel.chassisNumber}</span>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => { setSelectedBarrel(null); setBarrelSearch(''); }}>
                                        Trocar
                                    </Button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por código ou chassi..."
                                        value={barrelSearch}
                                        onChange={(e) => setBarrelSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                    {barrelResults.length > 0 && (
                                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-xl max-h-48 overflow-y-auto">
                                            {barrelResults.map((b: any) => (
                                                <button
                                                    key={b.id}
                                                    className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm flex items-center justify-between"
                                                    onClick={() => { setSelectedBarrel(b); setBarrelSearch(b.internalCode); setBarrelResults([]); }}
                                                >
                                                    <span className="font-medium text-foreground">{b.internalCode}</span>
                                                    <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Disposal Reason Category */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">Categoria do motivo</label>
                            <div className="grid grid-cols-2 gap-2">
                                {disposalReasons.map((r) => (
                                    <button
                                        key={r.value}
                                        className={`rounded-lg border p-2 text-xs text-left transition-colors ${
                                            createDisposalReason === r.value
                                                ? 'border-red-500 bg-red-500/10 text-red-400'
                                                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                                        }`}
                                        onClick={() => setCreateDisposalReason(r.value)}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Descrição do motivo</label>
                            <Textarea
                                placeholder="Descreva o motivo do descarte (mín. 10 caracteres)..."
                                value={createReason}
                                onChange={(e) => setCreateReason(e.target.value)}
                                rows={4}
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">{createReason.length}/500 caracteres</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={creating || !selectedBarrel || createReason.length < 3}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {creating ? 'Criando...' : 'Solicitar Descarte'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-400" />
                            Descarte — {selectedDisposal?.barrel?.internalCode}
                        </DialogTitle>
                        <DialogDescription className="sr-only">Detalhes do descarte selecionado</DialogDescription>
                    </DialogHeader>
                    {detailLoading ? (
                        <p className="text-center text-muted-foreground py-8">Carregando...</p>
                    ) : selectedDisposal && (
                        <div className="space-y-4">
                            {/* Status */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`${statusConfig[selectedDisposal.status]?.color}`}>
                                    {statusConfig[selectedDisposal.status]?.label}
                                </Badge>
                                {selectedDisposal.disposalReason && (
                                    <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-500/5">
                                        {reasonLabels[selectedDisposal.disposalReason] || selectedDisposal.disposalReason}
                                    </Badge>
                                )}
                                {selectedDisposal.destination && (
                                    <Badge variant="outline" className="border-border text-muted-foreground">
                                        {destinationLabels[selectedDisposal.destination] || selectedDisposal.destination}
                                    </Badge>
                                )}
                            </div>

                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[11px] text-muted-foreground">TCO Acumulado</span>
                                    </div>
                                    <p className="text-sm font-medium text-foreground">R$ {Number(selectedDisposal.tcoAccumulated).toFixed(2)}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[11px] text-muted-foreground">Custo Reposição</span>
                                    </div>
                                    <p className="text-sm font-medium text-foreground">R$ {Number(selectedDisposal.replacementCost).toFixed(2)}</p>
                                </div>
                                {selectedDisposal.scrapValue && (
                                    <div className="rounded-lg bg-muted/30 p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <DollarSign className="h-3.5 w-3.5 text-green-400" />
                                            <span className="text-[11px] text-muted-foreground">Valor Sucata</span>
                                        </div>
                                        <p className="text-sm font-medium text-green-400">R$ {Number(selectedDisposal.scrapValue).toFixed(2)}</p>
                                    </div>
                                )}
                                <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[11px] text-muted-foreground">Solicitado em</span>
                                    </div>
                                    <p className="text-sm font-medium text-foreground">
                                        {new Date(selectedDisposal.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="rounded-lg bg-muted/30 p-3">
                                <span className="text-[11px] text-muted-foreground block mb-1">Motivo</span>
                                <p className="text-sm text-foreground">{selectedDisposal.reason}</p>
                            </div>

                            {/* Notes */}
                            {selectedDisposal.notes && (
                                <div className="rounded-lg bg-muted/30 p-3">
                                    <span className="text-[11px] text-muted-foreground block mb-1">Observações</span>
                                    <p className="text-sm text-foreground">{selectedDisposal.notes}</p>
                                </div>
                            )}

                            {/* People */}
                            <div className="space-y-2">
                                {selectedDisposal.requestedBy && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Solicitado por:</span>
                                        <span className="text-foreground">{selectedDisposal.requestedBy.name}</span>
                                    </div>
                                )}
                                {selectedDisposal.approvedBy && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                        <span className="text-muted-foreground">Aprovado por:</span>
                                        <span className="text-foreground">{selectedDisposal.approvedBy.name}</span>
                                        {selectedDisposal.approvedAt && (
                                            <span className="text-[11px] text-muted-foreground">
                                                em {new Date(selectedDisposal.approvedAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {selectedDisposal.completedAt && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <PackageCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Concluído em:</span>
                                        <span className="text-foreground">
                                            {new Date(selectedDisposal.completedAt).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-2">
                                {selectedDisposal.status === 'PENDING_APPROVAL' && (
                                    <Button
                                        onClick={handleApprove}
                                        disabled={approving}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        {approving ? 'Aprovando...' : 'Aprovar'}
                                    </Button>
                                )}
                                {selectedDisposal.status === 'APPROVED' && (
                                    <Button
                                        onClick={openComplete}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        <PackageCheck className="h-4 w-4 mr-2" />
                                        Concluir Descarte
                                    </Button>
                                )}
                                {selectedDisposal.status === 'COMPLETED' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => { setRevertTarget(selectedDisposal.id); setRevertConfirmOpen(true); }}
                                        className="flex-1 border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                                    >
                                        <Undo2 className="h-4 w-4 mr-2" /> Reverter
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Complete Dialog ── */}
            <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Concluir Descarte</DialogTitle>
                        <DialogDescription className="sr-only">Preencha os dados para concluir o descarte</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">Destino Final</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['SCRAP_SALE', 'RECYCLING', 'DONATION'] as const).map((dest) => (
                                    <button
                                        key={dest}
                                        className={`rounded-lg border p-3 text-center text-sm transition-colors ${
                                            completeDestination === dest
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                                        }`}
                                        onClick={() => setCompleteDestination(dest)}
                                    >
                                        {destinationLabels[dest]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {completeDestination === 'SCRAP_SALE' && (
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Valor obtido (R$)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={completeScrapValue}
                                    onChange={(e) => setCompleteScrapValue(e.target.value)}
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
                            <Textarea
                                placeholder="Observações sobre a conclusão..."
                                value={completeNotes}
                                onChange={(e) => setCompleteNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleComplete}
                            disabled={completing}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {completing ? 'Concluindo...' : 'Confirmar Conclusão'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={revertConfirmOpen}
                onOpenChange={setRevertConfirmOpen}
                title="Reverter descarte"
                description="Reverter este descarte? O barril voltará ao status Bloqueado."
                confirmLabel="Reverter"
                variant="default"
                loading={reverting}
                onConfirm={handleRevert}
            />
        </RoleGuard>
    );
}
