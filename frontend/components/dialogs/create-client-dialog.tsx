'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export function CreateClientDialog({ onCreated }: { onCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '', tradeName: '', cnpj: '', phone: '', email: '',
        address: '', latitude: '', longitude: '', connectorType: 'TYPE_S',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('O campo "Razão Social" é obrigatório'); return; }
        if (!form.tradeName.trim()) { toast.error('O campo "Nome Fantasia" é obrigatório'); return; }
        if (!form.cnpj.trim()) { toast.error('O campo "CNPJ" é obrigatório'); return; }
        setLoading(true);
        try {
            await api.post('/clients', {
                ...form,
                latitude: form.latitude ? +form.latitude : undefined,
                longitude: form.longitude ? +form.longitude : undefined,
            });
            toast.success('Cliente criado com sucesso!');
            setOpen(false);
            setForm({ name: '', tradeName: '', cnpj: '', phone: '', email: '', address: '', latitude: '', longitude: '', connectorType: 'TYPE_S' });
            onCreated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao criar cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                    <Plus className="mr-2 h-4 w-4" /> Novo Cliente
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                    <DialogDescription className="sr-only">Preencha os dados do novo cliente</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2" noValidate>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Razão Social <span className="text-red-400">*</span></Label>
                            <Input required aria-required="true" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Nome Fantasia <span className="text-red-400">*</span></Label>
                            <Input required aria-required="true" value={form.tradeName} onChange={e => setForm(f => ({ ...f, tradeName: e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">CNPJ <span className="text-red-400">*</span></Label>
                            <Input required aria-required="true" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                                placeholder="00000000000000" className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Telefone</Label>
                            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="(11) 99999-9999" className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Email</Label>
                        <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Endereço</Label>
                        <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Latitude</Label>
                            <Input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                                placeholder="-23.5505" className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Longitude</Label>
                            <Input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                                placeholder="-46.6333" className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : 'Criar Cliente'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
