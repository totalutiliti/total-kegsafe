'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    ChevronLeft,
    ChevronRight,
    Bell,
    BellOff,
    ShieldAlert,
    Clock,
    Info,
    MapPin,
    Wrench,
    Skull,
    UserX,
    Gauge,
    PackageX,
    Timer,
    Truck,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const priorityConfig: Record<string, { label: string; color: string }> = {
    CRITICAL: { label: 'Critico', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    HIGH: { label: 'Alto', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    MEDIUM: { label: 'Medio', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    LOW: { label: 'Baixo', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20' },
};

const alertTypeConfig: Record<string, { label: string; icon: typeof AlertTriangle }> = {
    COMPONENT_END_OF_LIFE: { label: 'Fim de Vida', icon: Gauge },
    MANDATORY_INSPECTION: { label: 'Inspeção Obrigatória', icon: Wrench },
    IDLE_AT_CLIENT: { label: 'Ocioso no Cliente', icon: Timer },
    IDLE_AT_FACTORY: { label: 'Ocioso na Fábrica', icon: Clock },
    GEOFENCE_VIOLATION: { label: 'Violação Geofence', icon: MapPin },
    AFTER_HOURS_MOVEMENT: { label: 'Mov. Fora do Horário', icon: Truck },
    SUPPLIER_SLA_BREACH: { label: 'SLA Fornecedor', icon: ShieldAlert },
    DISPOSAL_SUGGESTED: { label: 'Descarte Sugerido', icon: Skull },
    CLIENT_DEACTIVATED_WITH_BARRELS: { label: 'Cliente Desativado', icon: UserX },
    MAINTENANCE_DUE_ON_RETURN: { label: 'Manutenção no Retorno', icon: Wrench },
    PREMATURE_DISPOSAL: { label: 'Descarte Prematuro', icon: PackageX },
};

const alertTypeFilters = [
    { value: '', label: 'Todos os Tipos' },
    { value: 'COMPONENT_END_OF_LIFE', label: 'Fim de Vida' },
    { value: 'MANDATORY_INSPECTION', label: 'Inspeção' },
    { value: 'IDLE_AT_CLIENT', label: 'Ocioso Cliente' },
    { value: 'IDLE_AT_FACTORY', label: 'Ocioso Fábrica' },
    { value: 'GEOFENCE_VIOLATION', label: 'Geofence' },
    { value: 'DISPOSAL_SUGGESTED', label: 'Descarte Sugerido' },
    { value: 'CLIENT_DEACTIVATED_WITH_BARRELS', label: 'Cliente Desativado' },
    { value: 'MAINTENANCE_DUE_ON_RETURN', label: 'Manutenção Retorno' },
    { value: 'PREMATURE_DISPOSAL', label: 'Descarte Prematuro' },
];

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d atrás`;
    return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [counts, setCounts] = useState<{ total: number; pending: number; critical: number } | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [resolved, setResolved] = useState<string>('false');
    const [typeFilter, setTypeFilter] = useState('');
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    // Detail dialog
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Resolve dialog
    const [resolveOpen, setResolveOpen] = useState(false);
    const [resolveNotes, setResolveNotes] = useState('');
    const [resolving, setResolving] = useState(false);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const params: any = { page, limit };
            if (resolved !== 'all') params.resolved = resolved === 'true';
            if (typeFilter) params.type = typeFilter;
            const { data } = await api.get('/alerts', { params });
            setAlerts(data.items);
            setTotal(data.total);
        } catch {
            toast.error('Erro ao carregar alertas');
        } finally {
            setLoading(false);
        }
    };

    const fetchCounts = async () => {
        try {
            const { data } = await api.get('/alerts/counts');
            setCounts(data);
        } catch { /* silent */ }
    };

    useEffect(() => {
        fetchAlerts();
    }, [page, resolved, typeFilter]);

    useEffect(() => {
        fetchCounts();
    }, []);

    const handleAcknowledge = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await api.post(`/alerts/${id}/acknowledge`);
            toast.success('Alerta reconhecido');
            fetchAlerts();
            fetchCounts();
            if (selectedAlert?.id === id) {
                setSelectedAlert((prev: any) => prev ? { ...prev, acknowledgedAt: new Date().toISOString(), status: 'ACKNOWLEDGED' } : prev);
            }
        } catch {
            toast.error('Erro ao reconhecer alerta');
        }
    };

    const openResolveDialog = (alert: any, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSelectedAlert(alert);
        setResolveNotes('');
        setResolveOpen(true);
    };

    const handleResolve = async () => {
        if (!selectedAlert) return;
        setResolving(true);
        try {
            await api.post(`/alerts/${selectedAlert.id}/resolve`, {
                resolution: resolveNotes || 'Resolvido manualmente',
            });
            toast.success('Alerta resolvido');
            setResolveOpen(false);
            setDetailOpen(false);
            fetchAlerts();
            fetchCounts();
        } catch {
            toast.error('Erro ao resolver alerta');
        } finally {
            setResolving(false);
        }
    };

    const openDetail = async (alert: any) => {
        setDetailLoading(true);
        setDetailOpen(true);
        try {
            const { data } = await api.get(`/alerts/${alert.id}`);
            setSelectedAlert(data);
        } catch {
            setSelectedAlert(alert);
        } finally {
            setDetailLoading(false);
        }
    };

    const getAlertIcon = (alertType: string, priority: string) => {
        const config = alertTypeConfig[alertType];
        const Icon = config?.icon || AlertTriangle;
        const colorClass = priority === 'CRITICAL' ? 'text-red-400' : priority === 'HIGH' ? 'text-orange-400' : 'text-amber-400';
        return <Icon className={`h-5 w-5 ${colorClass}`} />;
    };

    const getAlertIconBg = (priority: string) => {
        if (priority === 'CRITICAL') return 'bg-red-500/10';
        if (priority === 'HIGH') return 'bg-orange-500/10';
        return 'bg-amber-500/10';
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'MAINTENANCE']}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
                        <p className="text-sm text-muted-foreground mt-1">{total} alertas encontrados</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={typeFilter || 'all'} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-48 border-border bg-muted/50 text-foreground">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent className="border-border bg-card">
                                {alertTypeFilters.map((f) => (
                                    <SelectItem key={f.value || 'all'} value={f.value || 'all'}>{f.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={resolved} onValueChange={(v) => { setResolved(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-40 border-border bg-muted/50 text-foreground">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-border bg-card">
                                <SelectItem value="false">Pendentes</SelectItem>
                                <SelectItem value="true">Resolvidos</SelectItem>
                                <SelectItem value="all">Todos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* KPI Cards */}
                {counts && (
                    <div className="grid grid-cols-3 gap-3">
                        <Card className="border-border bg-card/50">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                                    <Bell className="h-5 w-5 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">{counts.total}</p>
                                    <p className="text-[11px] text-muted-foreground">Nao Resolvidos</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card/50">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                    <BellOff className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">{counts.pending}</p>
                                    <p className="text-[11px] text-muted-foreground">Nao Vistos</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-border bg-card/50">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                                    <ShieldAlert className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-400">{counts.critical}</p>
                                    <p className="text-[11px] text-muted-foreground">Criticos</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Alert List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Carregando...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.length === 0 ? (
                            <Card className="border-border bg-card/50">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                                    <p className="text-muted-foreground">Nenhum alerta encontrado</p>
                                </CardContent>
                            </Card>
                        ) : alerts.map((alert) => {
                            const pc = priorityConfig[alert.priority] || priorityConfig.LOW;
                            const tc = alertTypeConfig[alert.alertType];
                            return (
                                <Card
                                    key={alert.id}
                                    className="border-border bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                                    onClick={() => openDetail(alert)}
                                >
                                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${getAlertIconBg(alert.priority)}`}>
                                            {getAlertIcon(alert.alertType, alert.priority)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="text-sm font-medium text-foreground truncate">{alert.title}</h3>
                                                <Badge variant="outline" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                                                {tc && (
                                                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                                        {tc.label}
                                                    </Badge>
                                                )}
                                                {alert.acknowledgedAt && !alert.resolvedAt && (
                                                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">Visto</Badge>
                                                )}
                                                {alert.resolvedAt && (
                                                    <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">Resolvido</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                {alert.barrel && (
                                                    <span className="text-[11px] text-muted-foreground">Barril: {alert.barrel.internalCode}</span>
                                                )}
                                                <span className="text-[11px] text-muted-foreground">{timeAgo(alert.createdAt)}</span>
                                            </div>
                                        </div>
                                        {!alert.resolvedAt && (
                                            <div className="flex gap-2 shrink-0">
                                                {!alert.acknowledgedAt && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => handleAcknowledge(alert.id, e)}
                                                        className="border-border text-foreground hover:border-blue-500 hover:text-blue-400"
                                                    >
                                                        <Eye className="h-3.5 w-3.5 mr-1" /> Visto
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => openResolveDialog(alert, e)}
                                                    className="border-border text-foreground hover:border-green-500 hover:text-green-400"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                            Pagina {page} de {totalPages}
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
                                <span className="hidden sm:inline mr-1">Proximo</span><ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                            Detalhe do Alerta
                        </DialogTitle>
                    </DialogHeader>
                    {detailLoading ? (
                        <p className="text-center text-muted-foreground py-8">Carregando...</p>
                    ) : selectedAlert && (
                        <div className="space-y-4">
                            {/* Title */}
                            <h3 className="text-sm font-medium text-foreground">{selectedAlert.title}</h3>

                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`${priorityConfig[selectedAlert.priority]?.color}`}>
                                    {priorityConfig[selectedAlert.priority]?.label}
                                </Badge>
                                {alertTypeConfig[selectedAlert.alertType] && (
                                    <Badge variant="outline" className="border-border text-muted-foreground">
                                        {alertTypeConfig[selectedAlert.alertType].label}
                                    </Badge>
                                )}
                                {selectedAlert.status === 'ACKNOWLEDGED' && (
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">Visto</Badge>
                                )}
                                {selectedAlert.status === 'RESOLVED' && (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Resolvido</Badge>
                                )}
                            </div>

                            {/* Description */}
                            <div className="rounded-lg bg-muted/30 p-3">
                                <span className="text-[11px] text-muted-foreground block mb-1">Descricao</span>
                                <p className="text-sm text-foreground">{selectedAlert.description}</p>
                            </div>

                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {selectedAlert.barrel && (
                                    <div className="rounded-lg bg-muted/30 p-3">
                                        <span className="text-[11px] text-muted-foreground block mb-1">Barril</span>
                                        <p className="text-sm font-medium text-foreground">{selectedAlert.barrel.internalCode}</p>
                                        {selectedAlert.barrel.chassisNumber && (
                                            <p className="text-[11px] text-muted-foreground">Chassi: {selectedAlert.barrel.chassisNumber}</p>
                                        )}
                                    </div>
                                )}
                                <div className="rounded-lg bg-muted/30 p-3">
                                    <span className="text-[11px] text-muted-foreground block mb-1">Criado em</span>
                                    <p className="text-sm font-medium text-foreground">
                                        {new Date(selectedAlert.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {new Date(selectedAlert.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {selectedAlert.acknowledgedAt && (
                                    <div className="rounded-lg bg-muted/30 p-3">
                                        <span className="text-[11px] text-muted-foreground block mb-1">Reconhecido em</span>
                                        <p className="text-sm font-medium text-foreground">
                                            {new Date(selectedAlert.acknowledgedAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                                {selectedAlert.resolvedAt && (
                                    <div className="rounded-lg bg-muted/30 p-3">
                                        <span className="text-[11px] text-muted-foreground block mb-1">Resolvido em</span>
                                        <p className="text-sm font-medium text-green-400">
                                            {new Date(selectedAlert.resolvedAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Metadata */}
                            {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                                <div className="rounded-lg bg-muted/30 p-3">
                                    <span className="text-[11px] text-muted-foreground block mb-2">Dados Adicionais</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(selectedAlert.metadata).map(([key, value]) => (
                                            <div key={key}>
                                                <span className="text-[10px] text-muted-foreground">{key}</span>
                                                <p className="text-xs text-foreground truncate">{String(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Resolution notes */}
                            {selectedAlert.resolutionNotes && (
                                <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-3">
                                    <span className="text-[11px] text-green-400 block mb-1">Notas de Resolucao</span>
                                    <p className="text-sm text-foreground">{selectedAlert.resolutionNotes}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {!selectedAlert.resolvedAt && (
                                <div className="flex gap-2 pt-2">
                                    {!selectedAlert.acknowledgedAt && (
                                        <Button
                                            variant="outline"
                                            onClick={() => handleAcknowledge(selectedAlert.id)}
                                            className="flex-1 border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> Marcar como Visto
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => { setResolveNotes(''); setResolveOpen(true); }}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" /> Resolver
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Resolve Dialog ── */}
            <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                            Resolver Alerta
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedAlert && (
                            <div className="rounded-lg bg-muted/30 p-3">
                                <p className="text-sm font-medium text-foreground">{selectedAlert.title}</p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedAlert.description}</p>
                            </div>
                        )}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Notas de resolucao (opcional)</label>
                            <Textarea
                                placeholder="Descreva como o alerta foi resolvido..."
                                value={resolveNotes}
                                onChange={(e) => setResolveNotes(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResolveOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleResolve}
                            disabled={resolving}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {resolving ? 'Resolvendo...' : 'Confirmar Resolucao'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </RoleGuard>
    );
}
