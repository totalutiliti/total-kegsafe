'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Package, Wrench, Calendar, MapPin, Truck, Factory,
    ArrowUp, ArrowDown, CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string }> = {
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

export default function BarrelDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [barrel, setBarrel] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [barrelRes, timelineRes] = await Promise.all([
                    api.get(`/barrels/${params.id}`),
                    api.get(`/barrels/${params.id}/timeline`),
                ]);
                setBarrel(barrelRes.data);
                setTimeline(timelineRes.data || []);
            } catch (error) {
                toast.error('Erro ao carregar barril');
            } finally {
                setLoading(false);
            }
        };
        if (params.id) load();
    }, [params.id]);

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
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-foreground">{barrel.internalCode}</h1>
                        <Badge variant="outline" className={`${sc.color}`}>{sc.label}</Badge>
                        {barrel.condition === 'USED' && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">Usado</Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">QR: {barrel.qrCode} • {barrel.manufacturer} • {barrel.capacityLiters}L</p>
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
                        const percentage = Math.min(cycle.healthPercentage || 0, 100);
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
        </div>
    );
}
