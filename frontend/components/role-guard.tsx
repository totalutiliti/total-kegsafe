'use client';

import { useAuthStore, ROLE_HOME } from '@/lib/auth-store';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Role = 'ADMIN' | 'MANAGER' | 'LOGISTICS' | 'MAINTENANCE' | 'SUPER_ADMIN';

interface RoleGuardProps {
    allowedRoles: Role[];
    children: React.ReactNode;
}

/**
 * Checks if the authenticated user has one of the allowed roles.
 * If not, shows a 403 "Access Denied" message with a link back.
 */
export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
    const { user } = useAuthStore();

    if (!user) return null;

    if (!allowedRoles.includes(user.role)) {
        const homeRoute = ROLE_HOME[user.role] || '/barrels';
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
                    <p className="text-muted-foreground max-w-md">
                        Seu perfil <span className="font-semibold text-foreground">({user.role})</span> não
                        tem permissão para acessar esta página.
                    </p>
                </div>
                <Link href={homeRoute}>
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar à página inicial
                    </Button>
                </Link>
            </div>
        );
    }

    return <>{children}</>;
}
