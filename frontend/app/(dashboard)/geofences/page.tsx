'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map, Radio, ChevronLeft, ChevronRight, LayoutGrid, Pencil, Trash2 } from 'lucide-react';
import { CreateGeofenceDialog } from '@/components/dialogs/create-geofence-dialog';
import { EditGeofenceDialog } from '@/components/dialogs/edit-geofence-dialog';
import { GeofenceMap } from '@/components/geofence-map-wrapper';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const typeConfig: Record<string, { label: string; color: string }> = {
    FACTORY: { label: 'Fábrica', color: 'bg-orange-500/10 text-orange-400' },
    CLIENT: { label: 'Cliente', color: 'bg-purple-500/10 text-purple-400' },
    RESTRICTED: { label: 'Restrita', color: 'bg-red-500/10 text-red-400' },
};

export default function GeofencesPage() {
    const [geofences, setGeofences] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
    const [editGeofence, setEditGeofence] = useState<any | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        fetchGeofences();
    }, [page]);

    const fetchGeofences = () => {
        setLoading(true);
        api.get('/geofences', { params: { page, limit } })
            .then(r => {
                setGeofences(r.data.items);
                setTotal(r.data.total);
            })
            .catch(() => toast.error('Erro ao carregar geofences'))
            .finally(() => setLoading(false));
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Deseja realmente excluir a geofence "${name}"?`)) return;
        try {
            await api.delete(`/geofences/${id}`);
            toast.success('Geofence excluída com sucesso');
            fetchGeofences();
        } catch {
            toast.error('Erro ao excluir geofence');
        }
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Geofences</h1>
                        <p className="text-sm text-muted-foreground mt-1">{total} zonas cadastradas</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex rounded-lg border border-border overflow-hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewMode('cards')}
                                className={`rounded-none px-3 ${viewMode === 'cards' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewMode('map')}
                                className={`rounded-none px-3 ${viewMode === 'map' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                            >
                                <Map className="h-4 w-4" />
                            </Button>
                        </div>
                        <CreateGeofenceDialog onCreated={fetchGeofences} />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Carregando...</p>
                    </div>
                ) : geofences.length === 0 ? (
                    <Card className="border-border bg-card/50">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Map className="h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">Nenhuma geofence cadastrada</p>
                        </CardContent>
                    </Card>
                ) : viewMode === 'map' ? (
                    <GeofenceMap geofences={geofences} />
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {geofences.map((geo) => {
                                const tc = typeConfig[geo.type] || typeConfig.CLIENT;
                                return (
                                    <Card key={geo.id} className="border-border bg-card/50">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-medium text-foreground truncate">{geo.name}</h3>
                                                <div className="flex items-center gap-1">
                                                    <Badge variant="outline" className={`text-[10px] ${tc.color}`}>{tc.label}</Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                        onClick={() => { setEditGeofence(geo); setEditOpen(true); }}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                                        onClick={() => handleDelete(geo.id, geo.name)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Radio className="h-3 w-3" /> Raio: {geo.radiusMeters}m
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 font-mono">
                                                {Number(geo.latitude).toFixed(4)}, {Number(geo.longitude).toFixed(4)}
                                            </p>
                                            {geo.client && <p className="text-xs text-muted-foreground mt-2">Cliente: {geo.client.name}</p>}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

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

            <EditGeofenceDialog
                geofence={editGeofence}
                open={editOpen}
                onOpenChange={setEditOpen}
                onUpdated={fetchGeofences}
            />
        </RoleGuard>
    );
}
