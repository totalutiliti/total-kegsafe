'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { RoleGuard } from '@/components/role-guard';
import { SuperAdminSidebar } from '@/components/super-admin-sidebar';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
                <div className="flex h-screen bg-background">
                    <SuperAdminSidebar />
                    <main className="flex-1 overflow-y-auto">
                        <div className="p-6 pt-16 lg:p-8 lg:pt-8">
                            {children}
                        </div>
                    </main>
                </div>
            </RoleGuard>
        </ProtectedRoute>
    );
}
