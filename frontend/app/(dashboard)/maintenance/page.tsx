'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, Plus, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const orderStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    PENDING: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
    IN_PROGRESS: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Wrench },
    COMPLETED: { label: 'Concluída', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelada', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20', icon: AlertTriangle },
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

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const params: any = { page, limit };
                if (statusFilter !== 'all') params.status = statusFilter;
                const { data } = await api.get('/maintenance/orders', { params });
                setOrders(data.items);
                setTotal(data.total);
            } catch (error) { toast.error('Erro ao carregar ordens de manutenção'); }
            finally { setLoading(false); }
        };
        load();
    }, [page, statusFilter]);

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

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MAINTENANCE', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Manutenção</h1>
                        <p className="text-sm text-muted-foreground mt-1">{total} ordens de serviço</p>
                    </div>
                    <div className="flex gap-3">
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
                                                <Card key={order.id} className="border-border bg-card/50">
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
                                                                {order.barrel?.internalCode} • {order.orderType}
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
                            const Icon = sc.icon;
                            return (
                                <Card key={order.id} className="border-border bg-card/50 hover:border-accent transition-colors">
                                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                            <Wrench className="h-5 w-5 text-amber-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="text-sm font-medium text-foreground">{order.orderNumber}</h3>
                                                <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{order.orderType}</Badge>
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
        </RoleGuard>
    );
}
