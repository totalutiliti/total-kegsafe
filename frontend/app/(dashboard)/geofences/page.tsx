'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Map, Radio, ChevronLeft, ChevronRight, LayoutGrid, Pencil, Trash2, Search } from 'lucide-react';
import { CreateGeofenceDialog } from '@/components/dialogs/create-geofence-dialog';
import { EditGeofenceDialog } from '@/components/dialogs/edit-geofence-dialog';
import { GeofenceMap } from '@/components/geofence-map-wrapper';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RoleGuard } from '@/components/role-guard';
import { useSearchShortcut } from '@/hooks/use-keyboard-shortcuts';
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
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'cards' | 'map'>('cards');
    const [editGeofence, setEditGeofence] = useState<any | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [limit, setLimit] = useState(20);
    const searchRef = useSearchShortcut();
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchGeofences();
        }, search ? 400 : 0);
        return () => clearTimeout(timeout);
    }, [page, search, limit]);

    const fetchGeofences = () => {
        setLoading(true);
        const params: any = { page, limit };
        if (search) params.search = search;
        api.get('/geofences', { params })
            .then(r => {
                setGeofences(r.data.items);
                setTotal(r.data.total);
            })
            .catch(() => toast.error('Erro ao carregar geofences'))
            .finally(() => setLoading(false));
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/geofences/${deleteTarget.id}`);
            toast.success('Geofence excluída com sucesso');
            setConfirmOpen(false);
            setDeleteTarget(null);
            fetchGeofences();
        } catch {
            toast.error('Erro ao excluir geofence');
        } finally {
            setDeleting(false);
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

                <div className="relative sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        ref={searchRef}
                        placeholder="Buscar por nome..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="border-border bg-muted/50 pl-10 text-foreground placeholder:text-muted-foreground"
                    />
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
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                                onClick={() => { setEditGeofence(geo); setEditOpen(true); }}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Editar geofence</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                                                onClick={() => { setDeleteTarget({ id: geo.id, name: geo.name }); setConfirmOpen(true); }}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Excluir geofence</TooltipContent>
                                                    </Tooltip>
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

            <EditGeofenceDialog
                geofence={editGeofence}
                open={editOpen}
                onOpenChange={setEditOpen}
                onUpdated={fetchGeofences}
            />

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Excluir geofence"
                description={`Deseja realmente excluir a geofence "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                variant="destructive"
                loading={deleting}
                onConfirm={handleDelete}
            />
        </RoleGuard>
    );
}
