'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useTheme } from '@/lib/theme-provider';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Package,
    Truck,
    Wrench,
    AlertTriangle,
    Users,
    Settings,
    LogOut,
    Map,
    Trash2,
    BarChart3,
    Building2,
    Moon,
    Sun,
    Menu,
    X,
    BookOpen,
    Search,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getSoundEnabled, setSoundEnabled } from '@/lib/sounds';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Barris', href: '/barrels', icon: Package, roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'] },
    { name: 'Logística', href: '/logistics', icon: Truck, roles: ['ADMIN', 'LOGISTICS'] },
    { name: 'Manutenção', href: '/maintenance', icon: Wrench, roles: ['ADMIN', 'MANAGER', 'MAINTENANCE'] },
    { name: 'Alertas', href: '/alerts', icon: AlertTriangle, roles: ['ADMIN', 'MANAGER', 'MAINTENANCE'] },
    { name: 'Clientes', href: '/clients', icon: Building2, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Geofences', href: '/geofences', icon: Map, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Descarte', href: '/disposal', icon: Trash2, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Relatórios', href: '/reports', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
];

const settingsNav = [
    { name: 'Usuários', href: '/settings/users', icon: Users, roles: ['ADMIN'] },
    { name: 'Componentes', href: '/settings/components', icon: Settings, roles: ['ADMIN'] },
    { name: 'Manual', href: '/manual', icon: BookOpen, roles: ['ADMIN', 'MANAGER', 'LOGISTICS', 'MAINTENANCE'] },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuthStore();
    const { theme, toggleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [soundEnabled, setSoundState] = useState(true);

    useEffect(() => { setSoundState(getSoundEnabled()); }, []);

    const toggleSound = () => {
        const next = !soundEnabled;
        setSoundState(next);
        setSoundEnabled(next);
    };

    const filteredNav = navigation.filter(item => user && item.roles.includes(user.role));
    const filteredSettings = settingsNav.filter(item => user && item.roles.includes(user.role));

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                        <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-foreground">KegSafe</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tech Platform</p>
                    </div>
                </div>
                {/* Close button — mobile only */}
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
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">
                <button
                    onClick={() => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2 mb-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                    <Search className="h-4 w-4" />
                    <span className="flex-1 text-left text-xs">Buscar...</span>
                    <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                        Ctrl+K
                    </kbd>
                </button>
                <p className="mb-1 px-3 text-[10px] text-muted-foreground/60">
                    Pressione <kbd className="px-1 rounded border border-border bg-muted text-[10px]">?</kbd> para ver atalhos
                </p>
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Menu</p>
                {filteredNav.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
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
                                    ? 'bg-amber-500/10 text-amber-500 shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            )}
                        >
                            <item.icon className={cn('h-4 w-4', isActive ? 'text-amber-500' : 'text-muted-foreground')} aria-hidden="true" />
                            {item.name}
                        </Link>
                    );
                })}

                {filteredSettings.length > 0 && (
                    <>
                        <Separator className="my-3 bg-border" />
                        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Configurações</p>
                        {filteredSettings.map((item) => {
                            const isActive = pathname === item.href;
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
                                            ? 'bg-amber-500/10 text-amber-500'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    )}
                                >
                                    <item.icon className={cn('h-4 w-4', isActive ? 'text-amber-500' : 'text-muted-foreground')} aria-hidden="true" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </>
                )}
            </nav>

            <Separator className="bg-border" />

            {/* User Info + Theme Toggle */}
            <div className="p-4 space-y-3">
                {/* Sound toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSound}
                    className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent"
                    aria-label={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
                >
                    {soundEnabled ? (
                        <Volume2 className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    ) : (
                        <VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="text-sm">{soundEnabled ? 'Sons Ligados' : 'Sons Desligados'}</span>
                </Button>

                {/* Theme toggle */}
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

                {/* User info */}
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border">
                        <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                        <p className="text-[11px] text-muted-foreground">{user?.role}</p>
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
            {/* Mobile hamburger button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(true)}
                className="fixed top-4 left-4 z-40 h-10 w-10 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent lg:hidden"
                aria-label="Abrir menu"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Mobile overlay backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar — desktop: always visible; mobile: overlay */}
            <aside
                className={cn(
                    'flex h-screen w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out',
                    // Desktop: static
                    'hidden lg:flex',
                    // Mobile: fixed overlay (shown via isOpen below)
                )}
            >
                {sidebarContent}
            </aside>

            {/* Sidebar — mobile overlay */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out lg:hidden',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
