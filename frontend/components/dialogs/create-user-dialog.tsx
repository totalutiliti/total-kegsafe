'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast-with-sound';

export function CreateUserDialog({ onCreated }: { onCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '', email: '', password: '', role: 'LOGISTICS',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('O campo "Nome" é obrigatório'); return; }
        if (!form.email.trim()) { toast.error('O campo "Email" é obrigatório'); return; }
        if (!form.password.trim()) { toast.error('O campo "Senha" é obrigatório'); return; }
        if (form.password.length < 8) { toast.error('A senha deve ter no mínimo 8 caracteres'); return; }
        setLoading(true);
        try {
            await api.post('/users', form);
            toast.success('Usuário criado com sucesso!');
            setOpen(false);
            setForm({ name: '', email: '', password: '', role: 'LOGISTICS' });
            onCreated?.();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao criar usuário');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                    <Plus className="mr-2 h-4 w-4" /> Novo Usuário
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                    <DialogDescription className="sr-only">Preencha os dados do novo usuário</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2" noValidate>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Nome Completo <span className="text-red-400">*</span></Label>
                        <Input required aria-required="true" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Email <span className="text-red-400">*</span></Label>
                        <Input type="email" required aria-required="true" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Senha <span className="text-red-400">*</span></Label>
                        <Input type="password" required aria-required="true" minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            className="border-border bg-muted/50 text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Perfil</Label>
                        <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                            <SelectTrigger className="border-border bg-muted/50 text-foreground"><SelectValue /></SelectTrigger>
                            <SelectContent className="border-border bg-card">
                                <SelectItem value="ADMIN">Administrador</SelectItem>
                                <SelectItem value="MANAGER">Gerente</SelectItem>
                                <SelectItem value="LOGISTICS">Logística</SelectItem>
                                <SelectItem value="MAINTENANCE">Manutenção</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground">Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : 'Criar Usuário'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
