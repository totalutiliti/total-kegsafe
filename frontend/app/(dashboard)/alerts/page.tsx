'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Eye, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const priorityConfig: Record<string, { label: string; color: string }> = {
    CRITICAL: { label: 'Crítico', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    HIGH: { label: 'Alto', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    MEDIUM: { label: 'Médio', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    LOW: { label: 'Baixo', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [resolved, setResolved] = useState<string>('false');

    const fetchAlerts = async () => {
        try {
            const params: any = { page, limit: 20 };
            if (resolved !== 'all') params.resolved = resolved === 'true';
            const { data } = await api.get('/api/alerts', { params });
            setAlerts(data.items);
            setTotal(data.total);
        } catch (error) {
            toast.error('Erro ao carregar alertas');
        }
    };

    useEffect(() => { fetchAlerts(); }, [page, resolved]);

    const handleAcknowledge = async (id: string) => {
        try {
            await api.post(`/api/alerts/${id}/acknowledge`);
            fetchAlerts();
        } catch (error) { toast.error('Erro ao reconhecer alerta'); }
    };

    const handleResolve = async (id: string) => {
        try {
            await api.post(`/api/alerts/${id}/resolve`, { resolution: 'Resolvido manualmente' });
            fetchAlerts();
        } catch (error) { toast.error('Erro ao resolver alerta'); }
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Alertas</h1>
                        <p className="text-sm text-zinc-400 mt-1">{total} alertas no total</p>
                    </div>
                    <Select value={resolved} onValueChange={setResolved}>
                        <SelectTrigger className="w-44 border-zinc-700 bg-zinc-800/50 text-zinc-300">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-700 bg-zinc-900">
                            <SelectItem value="false">Pendentes</SelectItem>
                            <SelectItem value="true">Resolvidos</SelectItem>
                            <SelectItem value="all">Todos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    {alerts.length === 0 ? (
                        <Card className="border-zinc-800 bg-zinc-900/50">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                                <p className="text-zinc-400">Nenhum alerta pendente</p>
                            </CardContent>
                        </Card>
                    ) : alerts.map((alert) => {
                        const pc = priorityConfig[alert.priority] || priorityConfig.LOW;
                        return (
                            <Card key={alert.id} className="border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors">
                                <CardContent className="flex items-start gap-4 p-5">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${alert.priority === 'CRITICAL' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                                        <AlertTriangle className={`h-5 w-5 ${alert.priority === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-medium text-zinc-200 truncate">{alert.title}</h3>
                                            <Badge variant="outline" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                                            {alert.acknowledgedAt && !alert.resolvedAt && (
                                                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">Visto</Badge>
                                            )}
                                            {alert.resolvedAt && (
                                                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">Resolvido</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-500 line-clamp-1">{alert.description}</p>
                                        {alert.barrel && (
                                            <p className="text-xs text-zinc-600 mt-1">Barril: {alert.barrel.internalCode}</p>
                                        )}
                                    </div>
                                    {!alert.resolvedAt && (
                                        <div className="flex gap-2 flex-shrink-0">
                                            {!alert.acknowledgedAt && (
                                                <Button variant="outline" size="sm" onClick={() => handleAcknowledge(alert.id)} className="border-zinc-700 text-zinc-300 hover:border-blue-500 hover:text-blue-400">
                                                    <Eye className="h-3.5 w-3.5 mr-1" /> Visto
                                                </Button>
                                            )}
                                            <Button variant="outline" size="sm" onClick={() => handleResolve(alert.id)} className="border-zinc-700 text-zinc-300 hover:border-green-500 hover:text-green-400">
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </RoleGuard>
    );
}
