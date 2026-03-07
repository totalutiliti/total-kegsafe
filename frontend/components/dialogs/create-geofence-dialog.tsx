'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export function CreateGeofenceDialog({ onCreated }: { onCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '', type: 'FACTORY', latitude: '', longitude: '', radiusMeters: 500,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/geofences', {
                ...form,
                latitude: +form.latitude,
                longitude: +form.longitude,
            });
            toast.success('Geofence criada com sucesso!');
            setOpen(false);
            setForm({ name: '', type: 'FACTORY', latitude: '', longitude: '', radiusMeters: 500 });
            onCreated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao criar geofence');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                    <Plus className="mr-2 h-4 w-4" /> Nova Geofence
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Cadastrar Nova Geofence</DialogTitle>
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
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? 'Salvando...' : 'Criar Geofence'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
