'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ArrowLeft, Package, Wrench, Calendar, MapPin, Truck, Factory,
    ArrowUp, ArrowDown, CheckCircle2, AlertTriangle, Clock,
    ArrowRightLeft, Building2, User,
} from 'lucide-react';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string }> = {
    PRE_REGISTERED: { label: 'Pré-Registrado', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    ACTIVE: { label: 'Ativo', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    IN_TRANSIT: { label: 'Em Trânsito', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    AT_CLIENT: { label: 'No Cliente', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    IN_MAINTENANCE: { label: 'Manutenção', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    BLOCKED: { label: 'Bloqueado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    DISPOSED: { label: 'Descartado', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20' },
    LOST: { label: 'Perdido', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const healthConfig: Record<string, { label: string; color: string; bg: string }> = {
    GREEN: { label: 'Saudável', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    YELLOW: { label: 'Atenção', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    RED: { label: 'Crítico', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

const timelineIcons: Record<string, { icon: typeof Truck; color: string }> = {
    EXPEDITION: { icon: ArrowUp, color: 'text-blue-400 bg-blue-500/10' },
    DELIVERY: { icon: MapPin, color: 'text-purple-400 bg-purple-500/10' },
    COLLECTION: { icon: ArrowDown, color: 'text-amber-400 bg-amber-500/10' },
    RECEPTION: { icon: Factory, color: 'text-green-400 bg-green-500/10' },
};

interface OwnershipRecord {
    id: string;
    fromTenant: { id: string; name: string };
    toTenant: { id: string; name: string };
    transferredAt: string;
    notes?: string;
}

interface TenantOption {
    id: string;
    name: string;
}

export default function BarrelDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const [barrel, setBarrel] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [ownershipHistory, setOwnershipHistory] = useState<OwnershipRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Transfer modal state
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [tenants, setTenants] = useState<TenantOption[]>([]);
    const [toTenantId, setToTenantId] = useState('');
    const [transferNotes, setTransferNotes] = useState('');

    // Maintenance modal state
    const [maintenanceOpen, setMaintenanceOpen] = useState(false);
    const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
    const [maintenanceType, setMaintenanceType] = useState('PREVENTIVE');
    const [maintenancePriority, setMaintenancePriority] = useState('MEDIUM');
    const [maintenanceDescription, setMaintenanceDescription] = useState('');
    const [maintenanceScheduledDate, setMaintenanceScheduledDate] = useState('');

    const canTransfer = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const canSendToMaintenance = (barrel?.status === 'ACTIVE' || barrel?.status === 'BLOCKED') &&
        (user?.role === 'ADMIN' || user?.role === 'MAINTENANCE' || user?.role === 'MANAGER');

    useEffect(() => {
        const load = async () => {
            try {
                const requests = [
                    api.get(`/barrels/${params.id}`),
                    api.get(`/barrels/${params.id}/timeline`),
                    api.get(`/barrels/${params.id}/ownership-history`).catch(() => ({ data: { data: [] } })),
                ];
                const [barrelRes, timelineRes, ownershipRes] = await Promise.all(requests);
                setBarrel((barrelRes as any).data);
                setTimeline((timelineRes as any).data || []);
                setOwnershipHistory((ownershipRes as any).data?.data || []);
            } catch (error) {
                toast.error('Erro ao carregar barril');
            } finally {
                setLoading(false);
            }
        };
        if (params.id) load();
    }, [params.id]);

    // Load tenants for transfer modal (try super-admin endpoint, fallback gracefully)
    const openTransferModal = async () => {
        setTransferOpen(true);
        if (tenants.length === 0) {
            try {
                const { data } = await api.get('/super-admin/tenants', {
                    params: { limit: 100 },
                });
                setTenants(
                    data.items
                        .map((t: any) => ({ id: t.id, name: t.name }))
                        .filter((t: TenantOption) => t.id !== user?.tenantId),
                );
            } catch {
                // Not a super admin — tenants won't load, user can paste tenant ID
            }
        }
    };

    const handleTransfer = async () => {
        if (!toTenantId) return;
        setTransferring(true);
        try {
            await api.post(`/barrels/${params.id}/transfer`, {
                toTenantId,
                notes: transferNotes || undefined,
            });
            toast.success('Barril transferido com sucesso');
            setTransferOpen(false);
            setToTenantId('');
            setTransferNotes('');
            // Reload barrel data
            const [barrelRes, ownershipRes] = await Promise.all([
                api.get(`/barrels/${params.id}`).catch(() => null),
                api.get(`/barrels/${params.id}/ownership-history`).catch(() => ({ data: { data: [] } })),
            ]);
            if (barrelRes) setBarrel(barrelRes.data);
            setOwnershipHistory((ownershipRes as any).data?.data || []);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro na transferência');
        } finally {
            setTransferring(false);
        }
    };

    const handleSendToMaintenance = async () => {
        setMaintenanceSubmitting(true);
        try {
            await api.post('/maintenance/orders', {
                barrelId: params.id,
                orderType: maintenanceType,
                priority: maintenancePriority,
                description: maintenanceDescription || undefined,
                scheduledDate: maintenanceScheduledDate || undefined,
            });
            const isScheduled = maintenanceScheduledDate && new Date(maintenanceScheduledDate).getTime() > Date.now() + 60 * 60 * 1000;
            toast.success(isScheduled ? 'Manutenção agendada com sucesso' : 'Barril enviado para manutenção');
            setMaintenanceOpen(false);
            setMaintenanceType('PREVENTIVE');
            setMaintenancePriority('MEDIUM');
            setMaintenanceDescription('');
            setMaintenanceScheduledDate('');
            // Reload barrel data
            const { data } = await api.get(`/barrels/${params.id}`);
            setBarrel(data);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao enviar para manutenção');
        } finally { setMaintenanceSubmitting(false); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted-foreground border-t-amber-500" />
            </div>
        );
    }

    if (!barrel) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Barril não encontrado</p>
            </div>
        );
    }

    const sc = statusConfig[barrel.status] || statusConfig.ACTIVE;
    const cycles = barrel.componentCycles || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-foreground">{barrel.internalCode}</h1>
                        <Badge variant="outline" className={`${sc.color}`}>{sc.label}</Badge>
                        {barrel.condition === 'USED' && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">Usado</Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        QR: {barrel.qrCode} • {barrel.manufacturer} • {barrel.capacityLiters}L
                        {barrel.chassisNumber && <> • Chassi: {barrel.chassisNumber}</>}
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    {canSendToMaintenance && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMaintenanceOpen(true)}
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        >
                            <Wrench className="mr-2 h-4 w-4" />
                            Manutenção
                        </Button>
                    )}
                    {canTransfer && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={openTransferModal}
                            className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                        >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Transferir
                        </Button>
                    )}
                </div>
            </div>

            {/* Info Cards Row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="border-border bg-card/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{barrel.totalCycles}</p>
                        <p className="text-[11px] text-muted-foreground">Ciclos Totais</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{barrel.capacityLiters}L</p>
                        <p className="text-[11px] text-muted-foreground">Capacidade</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{barrel.tareWeightKg}kg</p>
                        <p className="text-[11px] text-muted-foreground">Peso Tara</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">R$ {Number(barrel.acquisitionCost || 0).toFixed(0)}</p>
                        <p className="text-[11px] text-muted-foreground">Custo Aquisição</p>
                    </CardContent>
                </Card>
            </div>
            {barrel.manufactureDate && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Card className="border-border bg-card/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-foreground">
                                {new Date(barrel.manufactureDate).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-[11px] text-muted-foreground">Data de Fabricação</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Component Health Cards */}
            <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-amber-400" /> Saúde dos Componentes
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {cycles.map((cycle: any) => {
                        const hc = healthConfig[cycle.healthScore] || healthConfig.GREEN;
                        const config = cycle.componentConfig || {};
                        const percentage = config.maxCycles > 0
                            ? Math.min((cycle.cyclesSinceLastService / config.maxCycles) * 100, 100)
                            : 0;
                        return (
                            <Card key={cycle.id} className={`border ${hc.bg}`}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-medium text-foreground truncate pr-2">{config.name || 'Componente'}</h3>
                                        <Badge variant="outline" className={`text-[10px] ${hc.bg} ${hc.color}`}>{hc.label}</Badge>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full h-2 rounded-full bg-muted mb-3">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ${cycle.healthScore === 'RED' ? 'bg-red-500' :
                                                cycle.healthScore === 'YELLOW' ? 'bg-amber-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-muted-foreground">Ciclos:</span>
                                            <span className="ml-1 text-foreground">{cycle.cyclesSinceLastService}/{config.maxCycles}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Uso:</span>
                                            <span className={`ml-1 font-medium ${hc.color}`}>{percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    {cycle.lastServiceDate && (
                                        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            Última manutenção: {new Date(cycle.lastServiceDate).toLocaleDateString('pt-BR')}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Timeline */}
            <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" /> Timeline de Movimentações
                </h2>
                <Card className="border-border bg-card/50">
                    <CardContent className="p-5">
                        {timeline.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <Truck className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada</p>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Vertical line */}
                                <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                                <div className="space-y-4">
                                    {timeline.map((event: any, i: number) => {
                                        const ti = timelineIcons[event.inputType] || timelineIcons.EXPEDITION;
                                        const Icon = ti.icon;
                                        return (
                                            <div key={event.id || i} className="relative flex items-start gap-4 pl-1">
                                                <div className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${ti.color}`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0 pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-foreground">{event.inputType}</span>
                                                        {event.client && (
                                                            <span className="text-xs text-muted-foreground">→ {event.client.tradeName || event.client.name}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(event.createdAt).toLocaleDateString('pt-BR')}{' '}
                                                            {new Date(event.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {event.user && (
                                                            <span className="text-xs text-muted-foreground">por {event.user.name}</span>
                                                        )}
                                                    </div>
                                                    {event.notes && <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Ownership History */}
            {ownershipHistory.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-400" /> Histórico de Propriedade
                    </h2>
                    <Card className="border-border bg-card/50">
                        <CardContent className="p-5">
                            <div className="relative">
                                {/* Vertical line */}
                                <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                                <div className="space-y-4">
                                    {ownershipHistory.map((record, i) => (
                                        <div key={record.id} className="relative flex items-start gap-4 pl-1">
                                            <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 bg-indigo-500/10">
                                                <ArrowRightLeft className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                                                        {record.fromTenant.name}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">→</span>
                                                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                                                        {record.toTenant.name}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(record.transferredAt).toLocaleDateString('pt-BR')}{' '}
                                                        {new Date(record.transferredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                {record.notes && (
                                                    <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Maintenance Dialog */}
            <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
                <DialogContent className="border-border bg-card max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Enviar para Manutenção</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <Wrench className="h-4 w-4 text-amber-400 shrink-0" />
                            <p className="text-sm text-amber-400">
                                O barril <span className="font-medium">{barrel?.internalCode}</span> será enviado para manutenção e uma OS será criada.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-foreground">Tipo</Label>
                                <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                                    <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card">
                                        <SelectItem value="PREVENTIVE">Preventiva</SelectItem>
                                        <SelectItem value="CORRECTIVE">Corretiva</SelectItem>
                                        <SelectItem value="PREDICTIVE">Preditiva</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground">Prioridade</Label>
                                <Select value={maintenancePriority} onValueChange={setMaintenancePriority}>
                                    <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card">
                                        <SelectItem value="LOW">Baixa</SelectItem>
                                        <SelectItem value="MEDIUM">Média</SelectItem>
                                        <SelectItem value="HIGH">Alta</SelectItem>
                                        <SelectItem value="CRITICAL">Crítica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Agendar para (opcional)</Label>
                            <Input
                                type="datetime-local"
                                value={maintenanceScheduledDate}
                                onChange={(e) => setMaintenanceScheduledDate(e.target.value)}
                                className="border-border bg-muted/50 text-foreground"
                            />
                            {maintenanceScheduledDate && new Date(maintenanceScheduledDate).getTime() > Date.now() + 60 * 60 * 1000 && (
                                <p className="text-[11px] text-blue-400">
                                    O barril continuará operando até a data agendada.
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Descrição (opcional)</Label>
                            <Textarea
                                value={maintenanceDescription}
                                onChange={(e) => setMaintenanceDescription(e.target.value)}
                                placeholder="Descreva o motivo da manutenção..."
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMaintenanceOpen(false)} className="border-border text-foreground">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSendToMaintenance}
                            disabled={maintenanceSubmitting}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        >
                            {maintenanceSubmitting ? 'Enviando...' : 'Enviar para Manutenção'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer Dialog */}
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                <DialogContent className="border-border bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            Transferir Propriedade
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                            <p className="text-sm text-amber-400">
                                O barril será transferido permanentemente para outro cliente.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Transferir para</Label>
                            {tenants.length > 0 ? (
                                <Select value={toTenantId} onValueChange={setToTenantId}>
                                    <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                        <SelectValue placeholder="Selecione o tenant destino" />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card">
                                        {tenants.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={toTenantId}
                                    onChange={(e) => setToTenantId(e.target.value)}
                                    placeholder="ID do tenant destino (UUID)"
                                    className="border-border bg-muted/50 text-foreground font-mono text-sm"
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">Observações (opcional)</Label>
                            <Textarea
                                value={transferNotes}
                                onChange={(e) => setTransferNotes(e.target.value)}
                                placeholder="Motivo da transferência..."
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setTransferOpen(false)}
                            className="border-border text-foreground"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleTransfer}
                            disabled={!toTenantId || transferring}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                        >
                            {transferring ? 'Transferindo...' : 'Confirmar Transferência'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
