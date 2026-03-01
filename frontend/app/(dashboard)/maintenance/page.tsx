'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, Plus, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const orderStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    PENDING: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
    IN_PROGRESS: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Wrench },
    COMPLETED: { label: 'Concluída', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelada', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: AlertTriangle },
};

export default function MaintenancePage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        const load = async () => {
            try {
                const params: any = { limit: 50 };
                if (statusFilter !== 'all') params.status = statusFilter;
                const { data } = await api.get('/api/maintenance/orders', { params });
                setOrders(data.items);
                setTotal(data.total);
            } catch (error) { toast.error('Erro ao carregar ordens de manutenção'); }
        };
        load();
    }, [statusFilter]);

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MAINTENANCE', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Manutenção</h1>
                        <p className="text-sm text-zinc-400 mt-1">{total} ordens de serviço</p>
                    </div>
                    <div className="flex gap-3">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-44 border-zinc-700 bg-zinc-800/50 text-zinc-300">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-700 bg-zinc-900">
                                <SelectItem value="all">Todos</SelectItem>
                                {Object.entries(orderStatusConfig).map(([key, cfg]) => (
                                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-3">
                    {orders.length === 0 ? (
                        <Card className="border-zinc-800 bg-zinc-900/50">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Wrench className="h-12 w-12 text-zinc-700 mb-3" />
                                <p className="text-zinc-400">Nenhuma ordem de serviço encontrada</p>
                            </CardContent>
                        </Card>
                    ) : orders.map((order) => {
                        const sc = orderStatusConfig[order.status] || orderStatusConfig.PENDING;
                        const Icon = sc.icon;
                        return (
                            <Card key={order.id} className="border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors">
                                <CardContent className="flex items-center gap-4 p-5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                                        <Wrench className="h-5 w-5 text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-medium text-zinc-200">{order.orderNumber}</h3>
                                            <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">{order.orderType}</Badge>
                                        </div>
                                        <p className="text-xs text-zinc-500 truncate">{order.description}</p>
                                        {order.barrel && <p className="text-xs text-zinc-600 mt-0.5">Barril: {order.barrel.internalCode}</p>}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        {order.actualCost && <p className="text-sm font-medium text-zinc-200">R$ {Number(order.actualCost).toFixed(2)}</p>}
                                        <p className="text-[11px] text-zinc-600">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </RoleGuard>
    );
}
