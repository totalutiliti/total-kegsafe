'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface CreateTenantAdminDialogProps {
    tenantId: string;
    tenantName: string;
    onCreated?: () => void;
}

export function CreateTenantAdminDialog({
    tenantId,
    tenantName,
    onCreated,
}: CreateTenantAdminDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post(`/super-admin/tenants/${tenantId}/users`, form);
            toast.success(
                'Admin criado com sucesso! Ele precisará trocar a senha no primeiro acesso.'
            );
            setOpen(false);
            setForm({ name: '', email: '', password: '' });
            onCreated?.();
        } catch (error: any) {
            const msg = error.response?.data?.message;
            if (Array.isArray(msg)) {
                msg.forEach((m: string) => toast.error(m));
            } else {
                toast.error(msg || 'Erro ao criar admin');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar Admin
                </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Criar Admin — {tenantName}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Nome Completo</Label>
                        <Input
                            required
                            value={form.name}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, name: e.target.value }))
                            }
                            placeholder="Nome do administrador"
                            className="border-border bg-muted/50 text-foreground"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Email</Label>
                        <Input
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, email: e.target.value }))
                            }
                            placeholder="admin@empresa.com.br"
                            className="border-border bg-muted/50 text-foreground"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Senha Temporária</Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={8}
                                value={form.password}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, password: e.target.value }))
                                }
                                placeholder="Mínimo 8 caracteres"
                                className="border-border bg-muted/50 text-foreground pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            O usuário precisará trocar a senha no primeiro acesso.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="text-muted-foreground"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando...
                                </>
                            ) : (
                                'Criar Admin'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
