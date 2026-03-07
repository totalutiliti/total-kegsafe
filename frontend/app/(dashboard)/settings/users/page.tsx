'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Plus, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { CreateUserDialog } from '@/components/dialogs/create-user-dialog';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const roleConfig: Record<string, { label: string; color: string }> = {
    ADMIN: { label: 'Admin', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    MANAGER: { label: 'Gestor', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    LOGISTICS: { label: 'Logística', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    MAINTENANCE: { label: 'Manutenção', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        fetchUsers();
    }, [page]);

    const fetchUsers = () => {
        setLoading(true);
        api.get('/users', { params: { page, limit } })
            .then(r => {
                setUsers(r.data.items);
                setTotal(r.data.total);
            })
            .catch(() => toast.error('Erro ao carregar usuários'))
            .finally(() => setLoading(false));
    };

    return (
        <RoleGuard allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
                        <p className="text-sm text-muted-foreground mt-1">{total} usuários</p>
                    </div>
                    <CreateUserDialog onCreated={fetchUsers} />
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Carregando...</p>
                    </div>
                ) : users.length === 0 ? (
                    <Card className="border-border bg-card/50">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Users className="h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {users.map((user) => {
                            const rc = roleConfig[user.role] || roleConfig.LOGISTICS;
                            return (
                                <Card key={user.id} className="border-border bg-card/50">
                                    <CardContent className="flex items-center gap-4 p-5">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground text-sm font-bold">
                                            {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="text-sm font-medium text-foreground">{user.name}</h3>
                                                <Badge variant="outline" className={`text-[10px] ${rc.color}`}>{rc.label}</Badge>
                                                {!user.isActive && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Inativo</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                            Página {page} de {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="border-border text-foreground hover:bg-accent"
                            >
                                <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline ml-1">Anterior</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="border-border text-foreground hover:bg-accent"
                            >
                                <span className="hidden sm:inline mr-1">Próximo</span><ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
