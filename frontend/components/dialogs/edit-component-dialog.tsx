'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast-with-sound';

interface ComponentData {
    id: string;
    name: string;
    description?: string;
    maxCycles: number;
    maxDays: number;
    criticality: string;
    alertThreshold: number | string;
    averageReplacementCost?: number | string | null;
}

interface EditComponentDialogProps {
    component: ComponentData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated?: () => void;
}

export function EditComponentDialog({ component, open, onOpenChange, onUpdated }: EditComponentDialogProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '', description: '', maxCycles: 100, maxDays: 365,
        criticality: 'MEDIUM', alertThreshold: 80, averageReplacementCost: 0,
    });

    useEffect(() => {
        if (component) {
            setForm({
                name: component.name,
                description: component.description || '',
                maxCycles: component.maxCycles,
                maxDays: component.maxDays,
                criticality: component.criticality,
                alertThreshold: Number(component.alertThreshold) > 1
                    ? Number(component.alertThreshold)
                    : Math.round(Number(component.alertThreshold) * 100),
                averageReplacementCost: component.averageReplacementCost ? Number(component.averageReplacementCost) : 0,
            });
        }
    }, [component]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!component) return;
        if (!form.name.trim()) { toast.error('O campo "Nome do Componente" é obrigatório'); return; }
        if (!form.maxCycles || form.maxCycles < 1) { toast.error('O campo "Ciclos Máximos" é obrigatório'); return; }
        if (!form.maxDays || form.maxDays < 1) { toast.error('O campo "Dias Máximos" é obrigatório'); return; }
        setLoading(true);
        try {
            await api.patch(`/components/${component.id}`, {
                ...form,
                // alertThreshold: converter porcentagem (0-100) para decimal (0-1) conforme schema Decimal(3,2)
                alertThreshold: form.alertThreshold ? form.alertThreshold / 100 : undefined,
                averageReplacementCost: form.averageReplacementCost || undefined,
            });
            toast.success('Componente atualizado com sucesso!');
            onOpenChange(false);
            onUpdated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao atualizar componente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Editar Componente</DialogTitle>
                    <DialogDescription className="sr-only">Edite os dados do componente</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Nome do Componente <span className="text-red-400">*</span></Label>
                        <Input required aria-required="true" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: Válvula de Saída" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Descrição</Label>
                        <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Descrição opcional" className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Ciclos Máximos <span className="text-red-400">*</span></Label>
                            <Input type="number" required aria-required="true" min={1} value={form.maxCycles} onChange={e => setForm(f => ({ ...f, maxCycles: +e.target.value }))}
                                className="border-border bg-muted/50 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Dias Máximos <span className="text-red-400">*</span></Label>
                            <Input type="number" required aria-required="true" min={1} value={form.maxDays} onChange={e => setForm(f => ({ ...f, maxDays: +e.target.value }))}
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
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : 'Salvar Alterações'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
