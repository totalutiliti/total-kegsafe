'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ClipboardList,
    ChevronLeft,
    ChevronRight,
    User,
    Clock,
    Building2,
} from 'lucide-react';
import { toast } from '@/lib/toast-with-sound';

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    targetTenantId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    timestamp: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

const actionConfig: Record<string, { label: string; color: string }> = {
    TENANT_CREATED: {
        label: 'Tenant Criado',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    TENANT_SUSPENDED: {
        label: 'Tenant Suspenso',
        color: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
    TENANT_ACTIVATED: {
        label: 'Tenant Ativado',
        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    TENANT_ADMIN_CREATED: {
        label: 'Admin Criado',
        color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    USER_PASSWORD_RESET: {
        label: 'Senha Resetada',
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    USER_UNLOCKED: {
        label: 'Conta Desbloqueada',
        color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
};

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const limit = 30;
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/super-admin/audit-logs', {
                params: { page, limit },
            });
            setLogs(data.items);
            setTotal(data.total);
        } catch {
            toast.error('Erro ao carregar logs de auditoria');
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getActionDisplay = (action: string) => {
        return (
            actionConfig[action] || {
                label: action,
                color: 'bg-muted text-muted-foreground border-border',
            }
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Auditoria</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Registro de todas as ações administrativas da plataforma
                </p>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-indigo-500" />
                        <p className="text-muted-foreground text-sm">Carregando...</p>
                    </div>
                </div>
            ) : logs.length === 0 ? (
                <Card className="border-border bg-card/50">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">
                            Nenhuma ação registrada ainda
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {logs.map((log) => {
                        const actionDisplay = getActionDisplay(log.action);

                        return (
                            <Card
                                key={log.id}
                                className="border-border bg-card/50"
                            >
                                <CardContent className="p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3 flex-1">
                                            {/* Action badge */}
                                            <Badge
                                                variant="outline"
                                                className={`${actionDisplay.color} whitespace-nowrap text-xs`}
                                            >
                                                {actionDisplay.label}
                                            </Badge>

                                            <div className="flex-1 min-w-0">
                                                {/* Entity info */}
                                                <p className="text-sm text-foreground">
                                                    <span className="font-medium">
                                                        {log.entityType}
                                                    </span>
                                                    {log.details?.name && (
                                                        <span className="text-muted-foreground">
                                                            {' '}
                                                            — {log.details.name}
                                                        </span>
                                                    )}
                                                    {log.details?.email && (
                                                        <span className="text-muted-foreground">
                                                            {' '}
                                                            ({log.details.email})
                                                        </span>
                                                    )}
                                                    {log.details?.slug && (
                                                        <span className="text-muted-foreground">
                                                            {' '}
                                                            [{log.details.slug}]
                                                        </span>
                                                    )}
                                                </p>

                                                {/* Meta */}
                                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {log.user.name}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatTimestamp(log.timestamp)}
                                                    </span>
                                                    {log.targetTenantId && (
                                                        <span className="flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            Tenant: {log.targetTenantId.slice(0, 8)}...
                                                        </span>
                                                    )}
                                                    {log.ipAddress && (
                                                        <span className="opacity-60">
                                                            IP: {log.ipAddress}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Página {page} de {totalPages} &bull; {total} registros
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="border-border text-foreground hover:bg-accent"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="border-border text-foreground hover:bg-accent"
                        >
                            Próximo
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
