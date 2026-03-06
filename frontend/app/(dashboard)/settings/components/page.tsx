'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { CreateComponentDialog } from '@/components/dialogs/create-component-dialog';
import { toast } from 'sonner';

const criticalityConfig: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Baixa', color: 'bg-zinc-500/10 text-muted-foreground' },
    MEDIUM: { label: 'Média', color: 'bg-blue-500/10 text-blue-400' },
    HIGH: { label: 'Alta', color: 'bg-amber-500/10 text-amber-400' },
    CRITICAL: { label: 'Crítica', color: 'bg-red-500/10 text-red-400' },
};

export default function ComponentsPage() {
    const [components, setComponents] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    const fetchComponents = () => {
        setLoading(true);
        api.get('/components', { params: { page, limit } })
            .then(r => {
                setComponents(r.data.items);
                setTotal(r.data.total);
            })
            .catch(() => toast.error('Erro ao carregar componentes'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchComponents();
    }, [page]);

    return (
        <RoleGuard allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Componentes</h1>
                        <p className="text-sm text-muted-foreground mt-1">{total} componentes configurados</p>
                    </div>
                    <CreateComponentDialog onCreated={fetchComponents} />
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Carregando...</p>
                    </div>
                ) : components.length === 0 ? (
                    <Card className="border-border bg-card/50">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Settings className="h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">Nenhum componente cadastrado</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {components.map((comp) => {
                            const cc = criticalityConfig[comp.criticality] || criticalityConfig.MEDIUM;
                            return (
                                <Card key={comp.id} className="border-border bg-card/50">
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-medium text-foreground">{comp.name}</h3>
                                            <Badge variant="outline" className={`text-[10px] ${cc.color}`}>{cc.label}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-4">{comp.description || 'Sem descrição'}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                                                <p className="text-lg font-bold text-foreground">{comp.maxCycles}</p>
                                                <p className="text-[10px] text-muted-foreground">Ciclos Máx.</p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                                                <p className="text-lg font-bold text-foreground">{comp.maxDays}</p>
                                                <p className="text-[10px] text-muted-foreground">Dias Máx.</p>
                                            </div>
                                        </div>
                                        {comp.averageReplacementCost && (
                                            <p className="mt-3 text-xs text-muted-foreground">Custo médio: R$ {Number(comp.averageReplacementCost).toFixed(2)}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Página {page} de {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="border-border text-foreground hover:bg-accent"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="border-border text-foreground hover:bg-accent"
                            >
                                Próximo <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
