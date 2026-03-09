import { useEffect, useRef } from 'react';

function isInputFocused() {
    const el = document.activeElement;
    return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.getAttribute('contenteditable') === 'true'
    );
}

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
