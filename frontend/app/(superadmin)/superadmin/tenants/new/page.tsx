'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Building2,
    ArrowLeft,
    Check,
    UserPlus,
    Eye,
    EyeOff,
    Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
}

function formatCnpjInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8)
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12)
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export default function CreateTenantPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Step 1 — Tenant form
    const [tenantForm, setTenantForm] = useState({
        name: '',
        slug: '',
        cnpj: '',
        cnpjFormatted: '',
        logoUrl: '',
    });
    const [slugManual, setSlugManual] = useState(false);

    // Step 2 — Admin form (optional)
    const [createAdmin, setCreateAdmin] = useState(true);
    const [adminForm, setAdminForm] = useState({
        name: '',
        email: '',
        password: '',
    });

    const handleNameChange = (name: string) => {
        setTenantForm((f) => ({
            ...f,
            name,
            slug: slugManual ? f.slug : slugify(name),
        }));
    };

    const handleCnpjChange = (value: string) => {
        const formatted = formatCnpjInput(value);
        const digits = value.replace(/\D/g, '').slice(0, 14);
        setTenantForm((f) => ({ ...f, cnpj: digits, cnpjFormatted: formatted }));
    };

    const handleCreateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (tenantForm.cnpj.length !== 14) {
            toast.error('CNPJ deve ter 14 dígitos');
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.post('/super-admin/tenants', {
                name: tenantForm.name,
                slug: tenantForm.slug,
                cnpj: tenantForm.cnpj,
                logoUrl: tenantForm.logoUrl || undefined,
            });
            setCreatedTenantId(data.id);
            toast.success('Tenant criado com sucesso!');
            setStep(2);
        } catch (error: any) {
            const msg = error.response?.data?.message;
            if (Array.isArray(msg)) {
                msg.forEach((m: string) => toast.error(m));
            } else {
                toast.error(msg || 'Erro ao criar tenant');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createdTenantId) return;
        setLoading(true);
        try {
            await api.post(`/super-admin/tenants/${createdTenantId}/users`, {
                name: adminForm.name,
                email: adminForm.email,
                password: adminForm.password,
            });
            toast.success('Admin criado com sucesso! Ele precisará trocar a senha no primeiro acesso.');
            router.push(`/superadmin/tenants/${createdTenantId}`);
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

    const handleSkipAdmin = () => {
        if (createdTenantId) {
            router.push(`/superadmin/tenants/${createdTenantId}`);
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/superadmin">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Voltar
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Novo Tenant</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {step === 1
                            ? 'Passo 1: Dados da empresa'
                            : 'Passo 2: Admin inicial (opcional)'}
                    </p>
                </div>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-3">
                <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        step >= 1
                            ? 'bg-indigo-500 text-white'
                            : 'bg-muted text-muted-foreground'
                    }`}
                >
                    {step > 1 ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <div
                    className={`h-0.5 flex-1 ${
                        step > 1 ? 'bg-indigo-500' : 'bg-muted'
                    }`}
                />
                <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        step >= 2
                            ? 'bg-indigo-500 text-white'
                            : 'bg-muted text-muted-foreground'
                    }`}
                >
                    2
                </div>
            </div>

            {/* Step 1: Tenant Data */}
            {step === 1 && (
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <Building2 className="h-5 w-5 text-indigo-400" />
                            Dados da Empresa
                        </CardTitle>
                        <CardDescription>
                            Preencha as informações do novo tenant
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateTenant} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Nome da Empresa *
                                </Label>
                                <Input
                                    required
                                    value={tenantForm.name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="Ex: Cervejaria Petrópolis"
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-muted-foreground">Slug *</Label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSlugManual(!slugManual);
                                            if (slugManual) {
                                                setTenantForm((f) => ({
                                                    ...f,
                                                    slug: slugify(f.name),
                                                }));
                                            }
                                        }}
                                        className="text-xs text-indigo-400 hover:text-indigo-300"
                                    >
                                        {slugManual ? 'Auto-gerar' : 'Editar manualmente'}
                                    </button>
                                </div>
                                <Input
                                    required
                                    value={tenantForm.slug}
                                    onChange={(e) =>
                                        setTenantForm((f) => ({
                                            ...f,
                                            slug: e.target.value
                                                .toLowerCase()
                                                .replace(/[^a-z0-9-]/g, ''),
                                        }))
                                    }
                                    readOnly={!slugManual}
                                    pattern="^[a-z0-9-]{3,50}$"
                                    title="3-50 caracteres: letras minúsculas, números e hífens"
                                    placeholder="cervejaria-petropolis"
                                    className={`border-border bg-muted/50 text-foreground ${
                                        !slugManual ? 'opacity-60' : ''
                                    }`}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Identificador único: letras minúsculas, números e hífens
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-muted-foreground">CNPJ *</Label>
                                <Input
                                    required
                                    value={tenantForm.cnpjFormatted}
                                    onChange={(e) => handleCnpjChange(e.target.value)}
                                    placeholder="00.000.000/0000-00"
                                    maxLength={18}
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    URL do Logo (opcional)
                                </Label>
                                <Input
                                    type="url"
                                    value={tenantForm.logoUrl}
                                    onChange={(e) =>
                                        setTenantForm((f) => ({
                                            ...f,
                                            logoUrl: e.target.value,
                                        }))
                                    }
                                    placeholder="https://..."
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Link href="/superadmin">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-muted-foreground"
                                    >
                                        Cancelar
                                    </Button>
                                </Link>
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
                                        'Criar Tenant'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Admin (optional) */}
            {step === 2 && (
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <UserPlus className="h-5 w-5 text-indigo-400" />
                            Admin Inicial
                        </CardTitle>
                        <CardDescription>
                            Crie o primeiro administrador para o tenant. O usuário
                            precisará trocar a senha no primeiro acesso.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateAdmin} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Nome do Administrador *
                                </Label>
                                <Input
                                    required
                                    value={adminForm.name}
                                    onChange={(e) =>
                                        setAdminForm((f) => ({
                                            ...f,
                                            name: e.target.value,
                                        }))
                                    }
                                    placeholder="Nome completo"
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Email *</Label>
                                <Input
                                    type="email"
                                    required
                                    value={adminForm.email}
                                    onChange={(e) =>
                                        setAdminForm((f) => ({
                                            ...f,
                                            email: e.target.value,
                                        }))
                                    }
                                    placeholder="admin@empresa.com.br"
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-muted-foreground">
                                    Senha Temporária *
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={adminForm.password}
                                        onChange={(e) =>
                                            setAdminForm((f) => ({
                                                ...f,
                                                password: e.target.value,
                                            }))
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
                                    O usuário será obrigado a trocar a senha no primeiro
                                    login.
                                </p>
                            </div>

                            <Separator className="bg-border" />

                            <div className="flex justify-between pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleSkipAdmin}
                                    className="text-muted-foreground"
                                >
                                    Pular — criar depois
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
                                        <>
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            Criar Admin
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
