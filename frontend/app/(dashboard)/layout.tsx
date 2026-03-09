'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { OnboardingDialog } from '@/components/onboarding-dialog';
import { GlobalSearch } from '@/components/global-search';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { OfflineIndicator } from '@/components/offline-indicator';
import { useGlobalShortcuts } from '@/hooks/use-keyboard-shortcuts';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [showShortcuts, setShowShortcuts] = useState(false);
    useGlobalShortcuts({ onShowHelp: () => setShowShortcuts(true) });

    return (
        <ProtectedRoute>
            <OfflineIndicator />
            <div className="flex h-screen bg-background">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 pt-16 lg:p-8 lg:pt-8">
                        {children}
                    </div>
                </main>
            </div>
            <OnboardingDialog />
            <GlobalSearch />
            <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
        </ProtectedRoute>
    );
}
