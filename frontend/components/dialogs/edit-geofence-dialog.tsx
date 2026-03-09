'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface EditGeofenceDialogProps {
    geofence: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated?: () => void;
}

export function EditGeofenceDialog({ geofence, open, onOpenChange, onUpdated }: EditGeofenceDialogProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '', type: 'FACTORY', latitude: '', longitude: '', radiusMeters: 500,
    });

    useEffect(() => {
        if (geofence && open) {
            setForm({
                name: geofence.name || '',
                type: geofence.type || 'FACTORY',
                latitude: String(geofence.latitude || ''),
                longitude: String(geofence.longitude || ''),
                radiusMeters: geofence.radiusMeters || 500,
            });
        }
    }, [geofence, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!geofence?.id) return;

        setLoading(true);
        try {
            await api.patch(`/geofences/${geofence.id}`, {
                ...form,
                latitude: +form.latitude,
                longitude: +form.longitude,
            });
            toast.success('Geofence atualizada com sucesso!');
            onOpenChange(false);
            onUpdated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao atualizar geofence');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar Geofence</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Nome</Label>
                        <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: Fábrica São Paulo" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Tipo</Label>
                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                            <SelectTrigger className="border-border bg-muted/50 text-foreground"><SelectValue /></SelectTrigger>
                            <SelectContent className="border-border bg-card">
                                <SelectItem value="FACTORY">Fábrica</SelectItem>
                                <SelectItem value="CLIENT">Cliente</SelectItem>
                                <SelectItem value="RESTRICTED">Zona Restrita</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Latitude</Label>
                            <Input type="number" step="any" required value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                                placeholder="-23.5505" className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Longitude</Label>
                            <Input type="number" step="any" required value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                                placeholder="-46.6333" className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Raio (metros)</Label>
                        <Input type="number" required value={form.radiusMeters} onChange={e => setForm(f => ({ ...f, radiusMeters: +e.target.value }))}
                            className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
