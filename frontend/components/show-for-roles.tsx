'use client';

import { useAuthStore } from '@/lib/auth-store';

type Role = 'ADMIN' | 'MANAGER' | 'LOGISTICS' | 'MAINTENANCE';

interface ShowForRolesProps {
    roles: Role[];
    children: React.ReactNode;
}

/**
 * Renderiza os children somente se o usuário logado tiver um dos roles permitidos.
 * Retorna null silenciosamente — ideal para ocultar botões e ações individuais.
 * Para proteção de página inteira com mensagem 403, use <RoleGuard>.
 */
export function ShowForRoles({ roles, children }: ShowForRolesProps) {
    const { user } = useAuthStore();

    if (!user || !roles.includes(user.role)) {
        return null;
    }

    return <>{children}</>;
}
