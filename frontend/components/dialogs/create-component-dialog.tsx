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

export function CreateComponentDialog({ onCreated }: { onCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '', description: '', maxCycles: 100, maxDays: 365,
        criticality: 'MEDIUM', alertThreshold: 80, averageReplacementCost: 0,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/components', {
                ...form,
                averageReplacementCost: form.averageReplacementCost || undefined,
            });
            toast.success('Componente criado com sucesso!');
            setOpen(false);
            setForm({ name: '', description: '', maxCycles: 100, maxDays: 365, criticality: 'MEDIUM', alertThreshold: 80, averageReplacementCost: 0 });
            onCreated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao criar componente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                    <Plus className="mr-2 h-4 w-4" /> Novo Componente
                </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-background text-foreground sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Cadastrar Novo Componente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Nome do Componente</Label>
                        <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: Válvula de Saída" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Descrição</Label>
                        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Descrição opcional" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Ciclos Máximos</Label>
                            <Input type="number" required min={1} value={form.maxCycles} onChange={e => setForm(f => ({ ...f, maxCycles: +e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Dias Máximos</Label>
                            <Input type="number" required min={1} value={form.maxDays} onChange={e => setForm(f => ({ ...f, maxDays: +e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Criticidade</Label>
                            <Select value={form.criticality} onValueChange={v => setForm(f => ({ ...f, criticality: v }))}>
                                <SelectTrigger className="border-border bg-muted/50 text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="border-border bg-card">
                                    <SelectItem value="LOW">Baixa</SelectItem>
                                    <SelectItem value="MEDIUM">Média</SelectItem>
                                    <SelectItem value="HIGH">Alta</SelectItem>
                                    <SelectItem value="CRITICAL">Crítica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Limiar de Alerta (%)</Label>
                            <Input type="number" min={0} max={100} value={form.alertThreshold} onChange={e => setForm(f => ({ ...f, alertThreshold: +e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Custo Médio de Substituição (R$)</Label>
                        <Input type="number" step="0.01" min={0} value={form.averageReplacementCost} onChange={e => setForm(f => ({ ...f, averageReplacementCost: +e.target.value }))}
                            placeholder="0.00" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? 'Salvando...' : 'Criar Componente'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
