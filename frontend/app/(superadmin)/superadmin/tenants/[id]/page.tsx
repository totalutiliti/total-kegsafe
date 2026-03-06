'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Building2,
    ArrowLeft,
    Users,
    Package,
    Calendar,
    Shield,
    ShieldOff,
    Unlock,
    Lock,
    Loader2,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CreateTenantAdminDialog } from '@/components/dialogs/create-tenant-admin-dialog';
import { ResetPasswordDialog } from '@/components/dialogs/reset-password-dialog';

interface TenantDetail {
    id: string;
    name: string;
    slug: string;
    cnpj: string;
    isActive: boolean;
    logoUrl?: string;
    settings: any;
    createdAt: string;
    userCount: number;
    barrelCount: number;
}

interface TenantUser {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    failedLoginAttempts: number;
    lockedUntil: string | null;
    createdAt: string;
}

const roleConfig: Record<string, { label: string; color: string }> = {
    ADMIN: { label: 'Admin', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    MANAGER: { label: 'Gestor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    LOGISTICS: { label: 'Logística', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    MAINTENANCE: {
        label: 'Manutenção',
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
};

export default function TenantDetailPage() {
    const params = useParams();
    const tenantId = params.id as string;

    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [users, setUsers] = useState<TenantUser[]>([]);
    const [usersTotal, setUsersTotal] = useState(0);
    const [usersPage, setUsersPage] = useState(1);
    const [loadingTenant, setLoadingTenant] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const [unlockingUser, setUnlockingUser] = useState<string | null>(null);

    const usersLimit = 20;
    const usersTotalPages = Math.ceil(usersTotal / usersLimit);

    const fetchTenant = useCallback(async () => {
        setLoadingTenant(true);
        try {
            const { data } = await api.get(`/super-admin/tenants/${tenantId}`);
            setTenant(data);
        } catch {
            toast.error('Erro ao carregar tenant');
        } finally {
            setLoadingTenant(false);
        }
    }, [tenantId]);

    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const { data } = await api.get(
                `/super-admin/tenants/${tenantId}/users`,
                { params: { page: usersPage, limit: usersLimit } }
            );
            setUsers(data.items);
            setUsersTotal(data.total);
        } catch {
            toast.error('Erro ao carregar usuários');
        } finally {
            setLoadingUsers(false);
        }
    }, [tenantId, usersPage]);

    useEffect(() => {
        fetchTenant();
    }, [fetchTenant]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleToggleStatus = async () => {
        if (!tenant) return;
        setTogglingStatus(true);
        try {
            await api.patch(`/super-admin/tenants/${tenantId}/status`, {
                isActive: !tenant.isActive,
            });
            toast.success(
                tenant.isActive
                    ? 'Tenant suspenso com sucesso'
                    : 'Tenant ativado com sucesso'
            );
            fetchTenant();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao alterar status');
        } finally {
            setTogglingStatus(false);
        }
    };

    const handleUnlockUser = async (userId: string) => {
        setUnlockingUser(userId);
        try {
            await api.post(`/super-admin/users/${userId}/unlock`);
            toast.success('Conta desbloqueada com sucesso');
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao desbloquear conta');
        } finally {
            setUnlockingUser(null);
        }
    };

    const formatCnpj = (cnpj: string) => {
        if (!cnpj || cnpj.length !== 14) return cnpj;
        return cnpj.replace(
            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
            '$1.$2.$3/$4-$5'
        );
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const isUserLocked = (user: TenantUser) => {
        return user.lockedUntil && new Date(user.lockedUntil) > new Date();
    };

    if (loadingTenant) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-indigo-500" />
                    <p className="text-muted-foreground text-sm">Carregando...</p>
                </div>
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <AlertTriangle className="h-12 w-12 text-red-400" />
                <p className="text-muted-foreground">Tenant não encontrado</p>
                <Link href="/superadmin">
                    <Button variant="outline" className="border-border text-foreground">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-foreground">
                                {tenant.name}
                            </h1>
                            <Badge
                                variant="outline"
                                className={
                                    tenant.isActive
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }
                            >
                                {tenant.isActive ? 'Ativo' : 'Suspenso'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {tenant.slug} &bull; CNPJ: {formatCnpj(tenant.cnpj)}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handleToggleStatus}
                    disabled={togglingStatus}
                    className={
                        tenant.isActive
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                    }
                >
                    {togglingStatus ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : tenant.isActive ? (
                        <ShieldOff className="mr-2 h-4 w-4" />
                    ) : (
                        <Shield className="mr-2 h-4 w-4" />
                    )}
                    {tenant.isActive ? 'Suspender' : 'Ativar'}
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-border bg-card/50">
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                            <Users className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">
                                {tenant.userCount}
                            </p>
                            <p className="text-xs text-muted-foreground">Usuários</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card/50">
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                            <Package className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">
                                {tenant.barrelCount}
                            </p>
                            <p className="text-xs text-muted-foreground">Barris</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card/50">
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                            <Calendar className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">
                                {formatDate(tenant.createdAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Data de criação
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Users Section */}
            <Card className="border-border bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-400" />
                        Usuários ({usersTotal})
                    </CardTitle>
                    <CreateTenantAdminDialog
                        tenantId={tenantId}
                        tenantName={tenant.name}
                        onCreated={() => {
                            fetchUsers();
                            fetchTenant();
                        }}
                    />
                </CardHeader>
                <CardContent>
                    {loadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                            <p className="text-muted-foreground text-sm">
                                Carregando usuários...
                            </p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Users className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground text-sm">
                                Nenhum usuário neste tenant
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {users.map((user) => {
                                const rc =
                                    roleConfig[user.role] || roleConfig.LOGISTICS;
                                const locked = isUserLocked(user);

                                return (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-4 rounded-lg border border-border p-4 bg-background/50"
                                    >
                                        {/* Avatar */}
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground text-sm font-bold">
                                            {user.name
                                                ?.split(' ')
                                                .map((n) => n[0])
                                                .join('')
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <h4 className="text-sm font-medium text-foreground truncate">
                                                    {user.name}
                                                </h4>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] ${rc.color}`}
                                                >
                                                    {rc.label}
                                                </Badge>
                                                {!user.isActive && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20"
                                                    >
                                                        Inativo
                                                    </Badge>
                                                )}
                                                {locked && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20"
                                                    >
                                                        <Lock className="h-3 w-3 mr-1" />
                                                        Bloqueado
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {user.email}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <ResetPasswordDialog
                                                userId={user.id}
                                                userName={user.name}
                                                onReset={fetchUsers}
                                            />
                                            {locked && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleUnlockUser(user.id)
                                                    }
                                                    disabled={
                                                        unlockingUser === user.id
                                                    }
                                                    className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                                >
                                                    {unlockingUser === user.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Unlock className="h-3.5 w-3.5 mr-1" />
                                                    )}
                                                    Desbloquear
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Users Pagination */}
                    {usersTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                            <p className="text-sm text-muted-foreground">
                                Página {usersPage} de {usersTotalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setUsersPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={usersPage === 1}
                                    className="border-border text-foreground hover:bg-accent"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setUsersPage((p) =>
                                            Math.min(usersTotalPages, p + 1)
                                        )
                                    }
                                    disabled={usersPage >= usersTotalPages}
                                    className="border-border text-foreground hover:bg-accent"
                                >
                                    Próximo
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
