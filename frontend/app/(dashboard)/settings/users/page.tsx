'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Plus, Shield } from 'lucide-react';
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

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = () => {
        api.get('/api/users').then(r => setUsers(r.data)).catch(() => toast.error('Erro ao carregar usuários'));
    };

    return (
        <RoleGuard allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Usuários</h1>
                        <p className="text-sm text-zinc-400 mt-1">{users.length} usuários</p>
                    </div>
                    <CreateUserDialog onCreated={fetchUsers} />
                </div>

                <div className="space-y-3">
                    {users.map((user) => {
                        const rc = roleConfig[user.role] || roleConfig.LOGISTICS;
                        return (
                            <Card key={user.id} className="border-zinc-800 bg-zinc-900/50">
                                <CardContent className="flex items-center gap-4 p-5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 text-sm font-bold">
                                        {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="text-sm font-medium text-zinc-200">{user.name}</h3>
                                            <Badge variant="outline" className={`text-[10px] ${rc.color}`}>{rc.label}</Badge>
                                            {!user.isActive && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Inativo</Badge>}
                                        </div>
                                        <p className="text-xs text-zinc-500">{user.email}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </RoleGuard>
    );
}
