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

const initialForm = {
    qrCode: '', chassisNumber: '', manufacturer: '', valveModel: 'TYPE_S', capacityLiters: 50,
    tareWeightKg: 13.2, material: 'INOX_304', acquisitionCost: 800,
    condition: 'NEW' as 'NEW' | 'USED', manufactureDate: '', initialCycles: '' as string | number,
};

export function CreateBarrelDialog({ onCreated }: { onCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ ...initialForm });

    const isUsed = form.condition === 'USED';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: Record<string, unknown> = { ...form };
            if (!isUsed) {
                delete payload.initialCycles;
            } else {
                payload.initialCycles = form.initialCycles === '' ? 0 : Number(form.initialCycles);
            }
            if (!form.manufactureDate) {
                delete payload.manufactureDate;
            }
            if (!form.chassisNumber) {
                delete payload.chassisNumber;
            }
            await api.post('/barrels', payload);
            toast.success('Barril criado com sucesso!');
            setOpen(false);
            setForm({ ...initialForm });
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
            <DialogContent className="border-border bg-background text-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Cadastrar Novo Barril</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">QR Code</Label>
                        <Input required value={form.qrCode} onChange={e => setForm(f => ({ ...f, qrCode: e.target.value }))}
                            placeholder="Ex: QR-000051" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Número do Chassi</Label>
                        <Input value={form.chassisNumber} onChange={e => setForm(f => ({ ...f, chassisNumber: e.target.value }))}
                            placeholder="Ex: CH-000001" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Fabricante</Label>
                            <Input required value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                                placeholder="Ex: Franke" className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Modelo Válvula</Label>
                            <Select value={form.valveModel} onValueChange={v => setForm(f => ({ ...f, valveModel: v }))}>
                                <SelectTrigger className="border-border bg-muted/50 text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="border-border bg-card">
                                    <SelectItem value="TYPE_S">Type S</SelectItem>
                                    <SelectItem value="TYPE_D">Type D</SelectItem>
                                    <SelectItem value="TYPE_A">Type A</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Capacidade (L)</Label>
                            <Input type="number" required value={form.capacityLiters} onChange={e => setForm(f => ({ ...f, capacityLiters: +e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Peso Tara (kg)</Label>
                            <Input type="number" step="0.1" required value={form.tareWeightKg} onChange={e => setForm(f => ({ ...f, tareWeightKg: +e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Material</Label>
                            <Select value={form.material} onValueChange={v => setForm(f => ({ ...f, material: v }))}>
                                <SelectTrigger className="border-border bg-muted/50 text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="border-border bg-card">
                                    <SelectItem value="INOX_304">Inox 304</SelectItem>
                                    <SelectItem value="INOX_316">Inox 316</SelectItem>
                                    <SelectItem value="POLIETILENO">Polietileno</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Custo Aquisição (R$)</Label>
                            <Input type="number" step="0.01" required value={form.acquisitionCost} onChange={e => setForm(f => ({ ...f, acquisitionCost: +e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    {/* Condição e Data de Fabricação */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Condição</Label>
                            <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v as 'NEW' | 'USED', ...(v === 'NEW' ? { initialCycles: '', manufactureDate: '' } : {}) }))}>
                                <SelectTrigger className="border-border bg-muted/50 text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="border-border bg-card">
                                    <SelectItem value="NEW">Novo</SelectItem>
                                    <SelectItem value="USED">Usado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">
                                Data de Fabricação {isUsed && <span className="text-red-400">*</span>}
                            </Label>
                            <Input type="date" required={isUsed} value={form.manufactureDate}
                                onChange={e => setForm(f => ({ ...f, manufactureDate: e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    {isUsed && (
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">
                                Ciclos Aproximados <span className="text-red-400">*</span>
                            </Label>
                            <Input type="number" required min={0} value={form.initialCycles}
                                onChange={e => setForm(f => ({ ...f, initialCycles: e.target.value === '' ? '' : +e.target.value }))}
                                placeholder="Ex: 150"
                                className="border-border bg-muted/50 text-foreground" />
                            <p className="text-xs text-muted-foreground">
                                Todos os componentes receberão este número de ciclos iniciais
                            </p>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? 'Salvando...' : 'Criar Barril'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
