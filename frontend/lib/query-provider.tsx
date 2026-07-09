'use client';

import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000,        // 30s
                refetchOnWindowFocus: true,
                retry: 1,
                // Quando offline, usar dados do cache sem tentar refetch
                networkMode: 'offlineFirst',
            },
            mutations: {
                // Mutations pausam quando offline e retentam quando voltar
                networkMode: 'offlineFirst',
            },
        },
    }));

    // Sincronizar React Query com estado online/offline real
    useEffect(() => {
        const setOnline = () => onlineManager.setOnline(true);
        const setOffline = () => onlineManager.setOnline(false);

        window.addEventListener('online', setOnline);
        window.addEventListener('offline', setOffline);

        // Set initial state
        onlineManager.setOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', setOnline);
            window.removeEventListener('offline', setOffline);
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
