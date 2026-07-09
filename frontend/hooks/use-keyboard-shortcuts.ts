import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

function isInputFocused() {
    const el = document.activeElement;
    return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.getAttribute('contenteditable') === 'true'
    );
}

/**
 * Hook para focar o input de busca ao pressionar `/`.
 */
export function useSearchShortcut() {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    return inputRef;
}

/**
 * Hook de atalhos globais para o dashboard.
 * Atalhos:
 *   ? → Abrir dialog de atalhos
 *   N → Cadastro rápido de barril
 *   Ctrl+I / Cmd+I → Importar barris
 */
export function useGlobalShortcuts({ onShowHelp }: { onShowHelp: () => void }) {
    const router = useRouter();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isInputFocused()) return;

            const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

            // ? → Mostrar atalhos
            if (e.key === '?' && !hasModifier) {
                e.preventDefault();
                onShowHelp();
                return;
            }

            // N → Cadastro rápido
            if (e.key === 'n' && !hasModifier) {
                e.preventDefault();
                router.push('/barrels/quick-register');
                return;
            }

            // Ctrl+I / Cmd+I → Importar barris
            if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                router.push('/barrels/import');
                return;
            }
        };

        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [router, onShowHelp]);
}
