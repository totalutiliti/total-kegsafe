'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Wrench, Plus, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
    CalendarDays, List, Search, Package, ClipboardCheck, Stethoscope, X,
} from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { toast } from '@/lib/toast-with-sound';

const orderStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    PENDING: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
    IN_PROGRESS: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Wrench },
    COMPLETED: { label: 'Concluída', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelada', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20', icon: AlertTriangle },
};

const typeLabels: Record<string, string> = {
    PREVENTIVE: 'Preventiva',
    CORRECTIVE: 'Corretiva',
    PREDICTIVE: 'Preditiva',
};

const priorityLabels: Record<string, string> = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
};

const actionLabels: Record<string, string> = {
    REPLACED: 'Substituído',
    REPAIRED: 'Reparado',
    INSPECTED: 'Inspecionado',
    CLEANED: 'Limpo',
};

const damageTypeLabels: Record<string, string> = {
    STRUCTURAL: 'Estrutural',
    VALVE: 'Válvula',
    WEAR: 'Desgaste',
    OTHER: 'Outro',
};

export default function MaintenancePage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [calendarData, setCalendarData] = useState<Record<string, any[]>>({});
    const [calendarLoading, setCalendarLoading] = useState(false);
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    // Create OS dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [barrelSearch, setBarrelSearch] = useState('');
    const [barrelResults, setBarrelResults] = useState<any[]>([]);
    const [searchingBarrels, setSearchingBarrels] = useState(false);
    const [selectedBarrel, setSelectedBarrel] = useState<any>(null);
    const [orderType, setOrderType] = useState('PREVENTIVE');
    const [priority, setPriority] = useState('MEDIUM');
    const [description, setDescription] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');

    // Order detail dialog
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailOrder, setDetailOrder] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Triage dialog
    const [triageOpen, setTriageOpen] = useState(false);
    const [triageSubmitting, setTriageSubmitting] = useState(false);
    const [triageIntact, setTriageIntact] = useState(true);
    const [triageDamageType, setTriageDamageType] = useState('');
    const [triageDamageNotes, setTriageDamageNotes] = useState('');

    // Checklist dialog
    const [checklistOpen, setChecklistOpen] = useState(false);
    const [checklistSubmitting, setChecklistSubmitting] = useState(false);
    const [componentConfigs, setComponentConfigs] = useState<any[]>([]);
    const [checklistItems, setChecklistItems] = useState<any[]>([]);
    const [pressureTestOk, setPressureTestOk] = useState(false);
    const [pressureTestValue, setPressureTestValue] = useState('');
    const [washCompleted, setWashCompleted] = useState(false);
    const [checklistNotes, setChecklistNotes] = useState('');
    const [checklistCost, setChecklistCost] = useState('');

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page, limit };
            if (statusFilter !== 'all') params.status = statusFilter;
            const { data } = await api.get('/maintenance/orders', { params });
            setOrders(data.items);
            setTotal(data.total);
        } catch { toast.error('Erro ao carregar ordens de manutenção'); }
        finally { setLoading(false); }
    }, [page, statusFilter]);

    useEffect(() => { loadOrders(); }, [loadOrders]);

    useEffect(() => {
        if (viewMode !== 'calendar') return;
        const loadCalendar = async () => {
            setCalendarLoading(true);
            try {
                const { data } = await api.get('/maintenance/calendar');
                setCalendarData(data);
            } catch { toast.error('Erro ao carregar calendário'); }
            finally { setCalendarLoading(false); }
        };
        loadCalendar();
    }, [viewMode]);

    // Barrel search with debounce
    useEffect(() => {
        if (barrelSearch.length < 2) { setBarrelResults([]); return; }
        const timer = setTimeout(async () => {
            setSearchingBarrels(true);
            try {
                const { data } = await api.get('/barrels', { params: { search: barrelSearch, limit: 8 } });
                setBarrelResults((data.items || []).filter((b: any) => b.status !== 'DISPOSED' && b.status !== 'LOST'));
            } catch { setBarrelResults([]); }
            finally { setSearchingBarrels(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [barrelSearch]);

    const handleCreateOrder = async () => {
        if (!selectedBarrel) return;
        setCreating(true);
        try {
            await api.post('/maintenance/orders', {
                barrelId: selectedBarrel.id,
                orderType,
                priority,
                description: description || undefined,
                scheduledDate: scheduledDate || undefined,
            });
            const isScheduled = scheduledDate && new Date(scheduledDate).getTime() > Date.now() + 60 * 60 * 1000;
            toast.success(isScheduled ? 'Manutenção agendada com sucesso' : 'Ordem de serviço criada com sucesso');
            setCreateOpen(false);
            resetCreateForm();
            loadOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao criar OS');
        } finally { setCreating(false); }
    };

    const resetCreateForm = () => {
        setBarrelSearch('');
        setBarrelResults([]);
        setSelectedBarrel(null);
        setOrderType('PREVENTIVE');
        setPriority('MEDIUM');
        setDescription('');
        setScheduledDate('');
    };

    const openOrderDetail = async (orderId: string) => {
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const { data } = await api.get(`/maintenance/orders/${orderId}`);
            setDetailOrder(data);
        } catch { toast.error('Erro ao carregar detalhes da OS'); }
        finally { setDetailLoading(false); }
    };

    const openTriage = () => {
        setTriageIntact(true);
        setTriageDamageType('');
        setTriageDamageNotes('');
        setTriageOpen(true);
    };

    const handleTriage = async () => {
        if (!detailOrder?.barrel?.id) return;
        setTriageSubmitting(true);
        try {
            await api.post('/maintenance/triage', {
                barrelId: detailOrder.barrel.id,
                intact: triageIntact,
                damageType: !triageIntact ? triageDamageType || undefined : undefined,
                damageNotes: !triageIntact ? triageDamageNotes || undefined : undefined,
            });
            toast.success(triageIntact ? 'Barril liberado para envase' : 'Triagem registrada');
            setTriageOpen(false);
            // Reload detail
            const { data } = await api.get(`/maintenance/orders/${detailOrder.id}`);
            setDetailOrder(data);
            loadOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro na triagem');
        } finally { setTriageSubmitting(false); }
    };

    const openChecklist = async () => {
        setChecklistItems([]);
        setPressureTestOk(false);
        setPressureTestValue('');
        setWashCompleted(false);
        setChecklistNotes('');
        setChecklistCost('');
        // Load component configs
        try {
            const { data } = await api.get('/components', { params: { limit: 50 } });
            const configs = data.items || [];
            setComponentConfigs(configs);
            setChecklistItems(configs.map((c: any) => ({
                componentConfigId: c.id,
                name: c.name,
                action: '',
                cost: '',
                notes: '',
            })));
        } catch { toast.error('Erro ao carregar componentes'); }
        setChecklistOpen(true);
    };

    const handleChecklist = async () => {
        if (!detailOrder?.barrel?.id) return;
        const activeItems = checklistItems.filter(i => i.action);
        if (activeItems.length === 0) { toast.error('Selecione a ação de pelo menos um componente'); return; }
        setChecklistSubmitting(true);
        try {
            await api.post('/maintenance/checklist', {
                maintenanceOrderId: detailOrder.id,
                barrelId: detailOrder.barrel.id,
                maintenanceType: detailOrder.orderType,
                pressureTestOk,
                pressureTestValue: pressureTestValue ? Number(pressureTestValue) : undefined,
                washCompleted,
                generalNotes: checklistNotes || undefined,
                totalCost: checklistCost ? Number(checklistCost) : undefined,
                items: activeItems.map(i => ({
                    componentConfigId: i.componentConfigId,
                    action: i.action,
                    cost: i.cost ? Number(i.cost) : undefined,
                    notes: i.notes || undefined,
                })),
            });
            toast.success('Checklist registrado — OS concluída');
            setChecklistOpen(false);
            // Reload detail
            const { data } = await api.get(`/maintenance/orders/${detailOrder.id}`);
            setDetailOrder(data);
            loadOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao registrar checklist');
        } finally { setChecklistSubmitting(false); }
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MAINTENANCE', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Manutenção</h1>
                        <p className="text-sm text-muted-foreground mt-1">{total} ordens de serviço</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            Nova OS
                        </Button>
                        <div className="flex rounded-lg border border-border overflow-hidden">
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                className="rounded-none"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('calendar')}
                                className="rounded-none"
                            >
                                <CalendarDays className="h-4 w-4" />
                            </Button>
                        </div>
                        {viewMode === 'list' && (
                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-full sm:w-44 border-border bg-muted/50 text-foreground">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-card">
                                    <SelectItem value="all">Todos</SelectItem>
                                    {Object.entries(orderStatusConfig).map(([key, cfg]) => (
                                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                {viewMode === 'calendar' ? (
                    calendarLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <p className="text-muted-foreground">Carregando calendário...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.keys(calendarData).length === 0 ? (
                                <Card className="border-border bg-card/50">
                                    <CardContent className="flex flex-col items-center justify-center py-12">
                                        <CalendarDays className="h-12 w-12 text-muted-foreground mb-3" />
                                        <p className="text-muted-foreground">Nenhuma manutenção no período</p>
                                    </CardContent>
                                </Card>
                            ) : Object.entries(calendarData).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayOrders]) => (
                                <div key={date}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="text-sm font-medium text-foreground">
                                            {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                        </h3>
                                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{(dayOrders as any[]).length}</Badge>
                                    </div>
                                    <div className="space-y-2 ml-6">
                                        {(dayOrders as any[]).map((order: any) => {
                                            const sc = orderStatusConfig[order.status] || orderStatusConfig.PENDING;
                                            return (
                                                <Card
                                                    key={order.id}
                                                    className="border-border bg-card/50 cursor-pointer hover:border-amber-500/40 transition-colors"
                                                    onClick={() => openOrderDetail(order.id)}
                                                >
                                                    <CardContent className="flex items-center gap-3 p-3">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                                            <Wrench className="h-4 w-4 text-amber-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-xs font-medium text-foreground">{order.orderNumber}</span>
                                                                <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground truncate">
                                                                {order.barrel?.internalCode} • {typeLabels[order.orderType] || order.orderType}
                                                            </p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : loading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Carregando...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.length === 0 ? (
                            <Card className="border-border bg-card/50">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Wrench className="h-12 w-12 text-muted-foreground mb-3" />
                                    <p className="text-muted-foreground">Nenhuma ordem de serviço encontrada</p>
                                </CardContent>
                            </Card>
                        ) : orders.map((order) => {
                            const sc = orderStatusConfig[order.status] || orderStatusConfig.PENDING;
                            return (
                                <Card
                                    key={order.id}
                                    className="border-border bg-card/50 hover:border-amber-500/40 transition-colors cursor-pointer"
                                    onClick={() => openOrderDetail(order.id)}
                                >
                                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                            <Wrench className="h-5 w-5 text-amber-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="text-sm font-medium text-foreground">{order.orderNumber}</h3>
                                                <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{typeLabels[order.orderType] || order.orderType}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">{order.description}</p>
                                            {order.barrel && <p className="text-xs text-muted-foreground mt-0.5">Barril: {order.barrel.internalCode}</p>}
                                        </div>
                                        <div className="text-left sm:text-right shrink-0">
                                            {order.actualCost && <p className="text-sm font-medium text-foreground">R$ {Number(order.actualCost).toFixed(2)}</p>}
                                            <p className="text-[11px] text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
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
            </div>

            {/* Create OS Dialog */}
            <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreateForm(); }}>
                <DialogContent className="border-border bg-card max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Nova Ordem de Serviço</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Barrel search */}
                        <div className="space-y-2">
                            <Label className="text-foreground">Barril</Label>
                            {selectedBarrel ? (
                                <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                                    <Package className="h-4 w-4 text-amber-400" />
                                    <span className="text-sm font-medium text-foreground flex-1">{selectedBarrel.internalCode}</span>
                                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{selectedBarrel.capacityLiters}L</Badge>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedBarrel(null); setBarrelSearch(''); }}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={barrelSearch}
                                        onChange={(e) => setBarrelSearch(e.target.value)}
                                        placeholder="Buscar por código do barril..."
                                        className="pl-9 border-border bg-muted/50 text-foreground"
                                    />
                                    {barrelResults.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 border border-border bg-card rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {barrelResults.map((b: any) => (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                                                    onClick={() => { setSelectedBarrel(b); setBarrelSearch(''); setBarrelResults([]); }}
                                                >
                                                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-foreground font-medium">{b.internalCode}</span>
                                                    <span className="text-muted-foreground text-xs">{b.capacityLiters}L • {b.status}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {searchingBarrels && (
                                        <div className="absolute z-50 w-full mt-1 border border-border bg-card rounded-lg p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Buscando...</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-foreground">Tipo</Label>
                                <Select value={orderType} onValueChange={setOrderType}>
                                    <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card">
                                        {Object.entries(typeLabels).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground">Prioridade</Label>
                                <Select value={priority} onValueChange={setPriority}>
                                    <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card">
                                        {Object.entries(priorityLabels).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">Agendar para (opcional)</Label>
                            <Input
                                type="datetime-local"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                className="border-border bg-muted/50 text-foreground"
                            />
                            {scheduledDate && new Date(scheduledDate).getTime() > Date.now() + 60 * 60 * 1000 && (
                                <p className="text-[11px] text-blue-400">
                                    O barril continuará operando até a data agendada. Na data, será enviado automaticamente para manutenção.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">Descrição (opcional)</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Descreva o motivo da manutenção..."
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-border text-foreground">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateOrder}
                            disabled={!selectedBarrel || creating}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        >
                            {creating ? 'Criando...' : 'Criar OS'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Order Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="border-border bg-card max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-foreground flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-amber-400" />
                            {detailOrder?.orderNumber || 'Carregando...'}
                        </DialogTitle>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-amber-500" />
                        </div>
                    ) : detailOrder ? (
                        <div className="space-y-5">
                            {/* Status & type badges */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={`${(orderStatusConfig[detailOrder.status] || orderStatusConfig.PENDING).color}`}>
                                    {(orderStatusConfig[detailOrder.status] || orderStatusConfig.PENDING).label}
                                </Badge>
                                <Badge variant="outline" className="border-border text-muted-foreground">{typeLabels[detailOrder.orderType] || detailOrder.orderType}</Badge>
                                {detailOrder.priority && (
                                    <Badge variant="outline" className="border-border text-muted-foreground">{priorityLabels[detailOrder.priority] || detailOrder.priority}</Badge>
                                )}
                            </div>

                            {/* Barrel info */}
                            {detailOrder.barrel && (
                                <div className="p-3 rounded-lg border border-border bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-blue-400" />
                                        <span className="text-sm font-medium text-foreground">{detailOrder.barrel.internalCode}</span>
                                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{detailOrder.barrel.capacityLiters}L</Badge>
                                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{detailOrder.barrel.status}</Badge>
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            {detailOrder.description && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                                    <p className="text-sm text-foreground">{detailOrder.description}</p>
                                </div>
                            )}

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-muted-foreground">Criada em</p>
                                    <p className="text-foreground">{new Date(detailOrder.createdAt).toLocaleDateString('pt-BR')} {new Date(detailOrder.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                {detailOrder.scheduledDate && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Agendada para</p>
                                        <p className="text-blue-400 font-medium">{new Date(detailOrder.scheduledDate).toLocaleDateString('pt-BR')} {new Date(detailOrder.scheduledDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                )}
                                {detailOrder.completedAt && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Concluída em</p>
                                        <p className="text-foreground">{new Date(detailOrder.completedAt).toLocaleDateString('pt-BR')} {new Date(detailOrder.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                )}
                                {detailOrder.actualCost && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Custo</p>
                                        <p className="text-foreground font-medium">R$ {Number(detailOrder.actualCost).toFixed(2)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Maintenance log */}
                            {detailOrder.maintenanceLog && detailOrder.maintenanceLog.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Registros de Manutenção</p>
                                    {detailOrder.maintenanceLog.map((log: any) => (
                                        <Card key={log.id} className="border-border bg-muted/20 mb-2">
                                            <CardContent className="p-3 space-y-2">
                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    {log.pressureTestOk != null && (
                                                        <Badge variant="outline" className={log.pressureTestOk ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}>
                                                            Pressão: {log.pressureTestOk ? 'OK' : 'Falha'} {log.pressureTestValue && `(${log.pressureTestValue})`}
                                                        </Badge>
                                                    )}
                                                    {log.washCompleted && (
                                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">Lavagem OK</Badge>
                                                    )}
                                                </div>
                                                {log.generalNotes && <p className="text-xs text-muted-foreground">{log.generalNotes}</p>}
                                                {log.items?.length > 0 && (
                                                    <div className="space-y-1">
                                                        {log.items.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-2 text-xs">
                                                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                                                    {actionLabels[item.action] || item.action}
                                                                </Badge>
                                                                {item.notes && <span className="text-muted-foreground">{item.notes}</span>}
                                                                {item.cost && <span className="text-foreground">R$ {Number(item.cost).toFixed(2)}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* Actions for non-completed orders */}
                            {detailOrder.status !== 'COMPLETED' && detailOrder.status !== 'CANCELLED' && (
                                <div className="flex gap-2 pt-2 border-t border-border">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={openTriage}
                                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    >
                                        <Stethoscope className="mr-1.5 h-4 w-4" />
                                        Triagem
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={openChecklist}
                                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                                    >
                                        <ClipboardCheck className="mr-1.5 h-4 w-4" />
                                        Checklist
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Triage Dialog */}
            <Dialog open={triageOpen} onOpenChange={setTriageOpen}>
                <DialogContent className="border-border bg-card max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground flex items-center gap-2">
                            <Stethoscope className="h-5 w-5 text-blue-400" />
                            Triagem do Barril
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">O barril está íntegro?</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant={triageIntact ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTriageIntact(true)}
                                    className={triageIntact ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-border text-foreground'}
                                >
                                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                    Sim, íntegro
                                </Button>
                                <Button
                                    variant={!triageIntact ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTriageIntact(false)}
                                    className={!triageIntact ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-border text-foreground'}
                                >
                                    <AlertTriangle className="mr-1.5 h-4 w-4" />
                                    Não, avariado
                                </Button>
                            </div>
                        </div>

                        {!triageIntact && (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-foreground">Tipo de avaria</Label>
                                    <Select value={triageDamageType} onValueChange={setTriageDamageType}>
                                        <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent className="border-border bg-card">
                                            {Object.entries(damageTypeLabels).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">Observações</Label>
                                    <Textarea
                                        value={triageDamageNotes}
                                        onChange={(e) => setTriageDamageNotes(e.target.value)}
                                        placeholder="Descreva a avaria..."
                                        className="border-border bg-muted/50 text-foreground"
                                    />
                                </div>
                                {triageDamageType === 'STRUCTURAL' && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                        <p className="text-xs text-red-400">Dano estrutural: o barril será bloqueado.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTriageOpen(false)} className="border-border text-foreground">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleTriage}
                            disabled={triageSubmitting || (!triageIntact && !triageDamageType)}
                            className={triageIntact ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                        >
                            {triageSubmitting ? 'Registrando...' : triageIntact ? 'Liberar Barril' : 'Registrar Avaria'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Checklist Dialog */}
            <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
                <DialogContent className="border-border bg-card max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-foreground flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-green-400" />
                            Checklist de Manutenção
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Components checklist */}
                        <div className="space-y-2">
                            <Label className="text-foreground">Componentes</Label>
                            {checklistItems.map((item, idx) => (
                                <div key={item.componentConfigId} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {Object.entries(actionLabels).map(([actionKey, actionLabel]) => (
                                            <Button
                                                key={actionKey}
                                                variant={item.action === actionKey ? 'default' : 'outline'}
                                                size="sm"
                                                className={`text-xs ${item.action === actionKey ? '' : 'border-border text-muted-foreground'}`}
                                                onClick={() => {
                                                    const updated = [...checklistItems];
                                                    updated[idx].action = updated[idx].action === actionKey ? '' : actionKey;
                                                    setChecklistItems(updated);
                                                }}
                                            >
                                                {actionLabel}
                                            </Button>
                                        ))}
                                    </div>
                                    {item.action && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                value={item.cost}
                                                onChange={(e) => {
                                                    const updated = [...checklistItems];
                                                    updated[idx].cost = e.target.value;
                                                    setChecklistItems(updated);
                                                }}
                                                placeholder="Custo (R$)"
                                                type="number"
                                                className="border-border bg-muted/50 text-foreground text-xs"
                                            />
                                            <Input
                                                value={item.notes}
                                                onChange={(e) => {
                                                    const updated = [...checklistItems];
                                                    updated[idx].notes = e.target.value;
                                                    setChecklistItems(updated);
                                                }}
                                                placeholder="Observação"
                                                className="border-border bg-muted/50 text-foreground text-xs"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Tests */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-foreground text-xs">Teste de pressão</Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={pressureTestOk ? 'default' : 'outline'}
                                        size="sm"
                                        className={`text-xs flex-1 ${pressureTestOk ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-border text-foreground'}`}
                                        onClick={() => setPressureTestOk(!pressureTestOk)}
                                    >
                                        {pressureTestOk ? 'OK' : 'N/A'}
                                    </Button>
                                    <Input
                                        value={pressureTestValue}
                                        onChange={(e) => setPressureTestValue(e.target.value)}
                                        placeholder="Valor"
                                        type="number"
                                        className="border-border bg-muted/50 text-foreground text-xs flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground text-xs">Lavagem</Label>
                                <Button
                                    variant={washCompleted ? 'default' : 'outline'}
                                    size="sm"
                                    className={`text-xs w-full ${washCompleted ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-border text-foreground'}`}
                                    onClick={() => setWashCompleted(!washCompleted)}
                                >
                                    {washCompleted ? 'Lavagem concluída' : 'Lavagem não realizada'}
                                </Button>
                            </div>
                        </div>

                        {/* Cost & notes */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-foreground text-xs">Custo total (R$)</Label>
                                <Input
                                    value={checklistCost}
                                    onChange={(e) => setChecklistCost(e.target.value)}
                                    placeholder="0.00"
                                    type="number"
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground text-xs">Observações gerais</Label>
                                <Input
                                    value={checklistNotes}
                                    onChange={(e) => setChecklistNotes(e.target.value)}
                                    placeholder="Observações..."
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setChecklistOpen(false)} className="border-border text-foreground">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleChecklist}
                            disabled={checklistSubmitting || checklistItems.every(i => !i.action)}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                        >
                            {checklistSubmitting ? 'Salvando...' : 'Concluir Manutenção'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </RoleGuard>
    );
}
