'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ShortcutItem {
    keys: string[];
    description: string;
}

const shortcuts: ShortcutItem[] = [
    { keys: ['Ctrl', 'K'], description: 'Busca global' },
    { keys: ['/'], description: 'Focar busca na lista' },
    { keys: ['?'], description: 'Mostrar atalhos' },
    { keys: ['N'], description: 'Cadastro rápido de barril' },
    { keys: ['Ctrl', 'I'], description: 'Importar barris' },
    { keys: ['Esc'], description: 'Fechar diálogo' },
];

function Kbd({ children }: { children: string }) {
    return (
        <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
            {children}
        </kbd>
    );
}

export function KeyboardShortcutsDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Atalhos de Teclado</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    {shortcuts.map((shortcut) => (
                        <div
                            key={shortcut.description}
                            className="flex items-center justify-between"
                        >
                            <span className="text-sm text-muted-foreground">
                                {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        {i > 0 && (
                                            <span className="text-[10px] text-muted-foreground">+</span>
                                        )}
                                        <Kbd>{key}</Kbd>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                    Atalhos não funcionam quando um campo de texto está focado.
                </p>
            </DialogContent>
        </Dialog>
    );
}
