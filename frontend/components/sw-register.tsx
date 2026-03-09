'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            process.env.NODE_ENV === 'production'
        ) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((reg) => {
                    console.log('[SW] Registered, scope:', reg.scope);
                })
                .catch((err) => {
                    console.warn('[SW] Registration failed:', err);
                });
        }
    }, []);

    return null;
}
