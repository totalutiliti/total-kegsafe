'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useTheme } from '@/lib/theme-provider';
import { cn } from '@/lib/utils';
import {
    Building2,
    Plus,
    Shield,
    Package,
    ArrowRightLeft,
    LogOut,
    Moon,
    Sun,
    Menu,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navigation = [
    { name: 'Tenants', href: '/superadmin', icon: Building2 },
    { name: 'Novo Tenant', href: '/superadmin/tenants/new', icon: Plus },
    { name: 'Lotes de Barris', href: '/superadmin/barrel-batches', icon: Package },
    { name: 'Transferências', href: '/superadmin/barrel-transfer', icon: ArrowRightLeft },
    { name: 'Auditoria', href: '/superadmin/audit', icon: Shield },
];

export function SuperAdminSidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuthStore();
    const { theme, toggleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                        <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-foreground">KegSafe</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Admin Panel</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground lg:hidden"
                    aria-label="Fechar menu"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            <Separator className="bg-border" />

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Menu Super Admin">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Gestao de Plataforma
                </p>
                {navigation.map((item) => {
                    const isActive = item.href === '/superadmin'
                        ? pathname === '/superadmin'
                        : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            aria-label={item.name}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-indigo-500/10 text-indigo-500 shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            )}
                        >
                            <item.icon className={cn('h-4 w-4', isActive ? 'text-indigo-500' : 'text-muted-foreground')} aria-hidden="true" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <Separator className="bg-border" />

            {/* User Info + Theme Toggle */}
            <div className="p-4 space-y-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTheme}
                    className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent"
                    aria-label={theme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
                >
                    {theme === 'dark' ? (
                        <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    ) : (
                        <Moon className="h-4 w-4 text-blue-400" aria-hidden="true" />
                    )}
                    <span className="text-sm">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
                </Button>

                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border">
                        <AvatarFallback className="bg-indigo-500/10 text-xs text-indigo-500">
                            SA
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                        <p className="text-[11px] text-indigo-400">SUPER ADMIN</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={logout}
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        aria-label="Sair da conta"
                    >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            </div>
        </>
    );

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(true)}
                className="fixed top-4 left-4 z-40 h-10 w-10 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent lg:hidden"
                aria-label="Abrir menu"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside className={cn(
                'flex h-screen w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out',
                'hidden lg:flex',
            )}>
                {sidebarContent}
            </aside>

            <aside className={cn(
                'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out lg:hidden',
                isOpen ? 'translate-x-0' : '-translate-x-full'
            )}>
                {sidebarContent}
            </aside>
        </>
    );
}
