'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface EditClientDialogProps {
    client: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated?: () => void;
}

export function EditClientDialog({ client, open, onOpenChange, onUpdated }: EditClientDialogProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        tradeName: '',
        cnpj: '',
        phone: '',
        email: '',
        address: '',
        latitude: '',
        longitude: '',
    });

    useEffect(() => {
        if (client) {
            setForm({
                name: client.name || '',
                tradeName: client.tradeName || '',
                cnpj: client.cnpj || '',
                phone: client.phone || '',
                email: client.email || '',
                address: client.address || '',
                latitude: client.latitude ? String(client.latitude) : '',
                longitude: client.longitude ? String(client.longitude) : '',
            });
        }
    }, [client, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!client) return;

        setLoading(true);
        try {
            await api.patch(`/clients/${client.id}`, {
                ...form,
                latitude: form.latitude ? +form.latitude : undefined,
                longitude: form.longitude ? +form.longitude : undefined,
            });
            toast.success('Cliente atualizado com sucesso!');
            onOpenChange(false);
            onUpdated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao atualizar cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Editar Cliente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Razão Social</Label>
                            <Input
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Nome Fantasia</Label>
                            <Input
                                required
                                value={form.tradeName}
                                onChange={e => setForm(f => ({ ...f, tradeName: e.target.value }))}
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">CNPJ</Label>
                            <Input
                                required
                                value={form.cnpj}
                                onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                                placeholder="00000000000000"
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Telefone</Label>
                            <Input
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="(11) 99999-9999"
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Email</Label>
                        <Input
                            type="email"
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="border-border bg-muted/50 text-foreground"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Endereço</Label>
                        <Input
                            value={form.address}
                            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            className="border-border bg-muted/50 text-foreground"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Latitude</Label>
                            <Input
                                type="number"
                                step="any"
                                value={form.latitude}
                                onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                                placeholder="-23.5505"
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Longitude</Label>
                            <Input
                                type="number"
                                step="any"
                                value={form.longitude}
                                onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                                placeholder="-46.6333"
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="text-muted-foreground"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        >
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
