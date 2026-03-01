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

export function CreateBarrelDialog({ onCreated }: { onCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        manufacturer: '', valveModel: 'TYPE_S', capacityLiters: 50,
        tareWeightKg: 13.2, material: 'INOX_304', acquisitionCost: 800,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/barrels', form);
            toast.success('Barril criado com sucesso!');
            setOpen(false);
            setForm({ manufacturer: '', valveModel: 'TYPE_S', capacityLiters: 50, tareWeightKg: 13.2, material: 'INOX_304', acquisitionCost: 800 });
            onCreated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao criar barril');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                    <Plus className="mr-2 h-4 w-4" /> Novo Barril
                </Button>
            </DialogTrigger>
            <DialogContent className="border-zinc-800 bg-zinc-950 text-white sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Cadastrar Novo Barril</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-400">Fabricante</Label>
                            <Input required value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                                placeholder="Ex: Franke" className="border-zinc-700 bg-zinc-800/50 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-400">Modelo Válvula</Label>
                            <Select value={form.valveModel} onValueChange={v => setForm(f => ({ ...f, valveModel: v }))}>
                                <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="border-zinc-700 bg-zinc-900">
                                    <SelectItem value="TYPE_S">Type S</SelectItem>
                                    <SelectItem value="TYPE_D">Type D</SelectItem>
                                    <SelectItem value="TYPE_A">Type A</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-400">Capacidade (L)</Label>
                            <Input type="number" required value={form.capacityLiters} onChange={e => setForm(f => ({ ...f, capacityLiters: +e.target.value }))}
                                className="border-zinc-700 bg-zinc-800/50 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-400">Peso Tara (kg)</Label>
                            <Input type="number" step="0.1" required value={form.tareWeightKg} onChange={e => setForm(f => ({ ...f, tareWeightKg: +e.target.value }))}
                                className="border-zinc-700 bg-zinc-800/50 text-white" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-400">Material</Label>
                            <Select value={form.material} onValueChange={v => setForm(f => ({ ...f, material: v }))}>
                                <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="border-zinc-700 bg-zinc-900">
                                    <SelectItem value="INOX_304">Inox 304</SelectItem>
                                    <SelectItem value="INOX_316">Inox 316</SelectItem>
                                    <SelectItem value="POLIETILENO">Polietileno</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-400">Custo Aquisição (R$)</Label>
                            <Input type="number" step="0.01" required value={form.acquisitionCost} onChange={e => setForm(f => ({ ...f, acquisitionCost: +e.target.value }))}
                                className="border-zinc-700 bg-zinc-800/50 text-white" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? 'Salvando...' : 'Criar Barril'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
