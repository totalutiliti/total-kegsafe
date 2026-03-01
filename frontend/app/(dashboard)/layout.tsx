'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <div className="flex h-screen bg-zinc-950">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 pt-16 lg:p-8 lg:pt-8">
                        {children}
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
