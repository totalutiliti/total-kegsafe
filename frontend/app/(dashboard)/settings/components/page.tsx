'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus } from 'lucide-react';
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

    const fetchComponents = () => {
        api.get('/api/components').then(r => setComponents(r.data)).catch(() => toast.error('Erro ao carregar componentes'));
    };

    useEffect(() => {
        fetchComponents();
    }, []);

    return (
        <RoleGuard allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Componentes</h1>
                        <p className="text-sm text-muted-foreground mt-1">Configuração de componentes e limites de manutenção</p>
                    </div>
                    <CreateComponentDialog onCreated={fetchComponents} />
                </div>

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
            </div>
        </RoleGuard>
    );
}
