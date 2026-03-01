'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Plus } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const criticalityConfig: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Baixa', color: 'bg-zinc-500/10 text-zinc-400' },
    MEDIUM: { label: 'Média', color: 'bg-blue-500/10 text-blue-400' },
    HIGH: { label: 'Alta', color: 'bg-amber-500/10 text-amber-400' },
    CRITICAL: { label: 'Crítica', color: 'bg-red-500/10 text-red-400' },
};

export default function ComponentsPage() {
    const [components, setComponents] = useState<any[]>([]);

    useEffect(() => {
        api.get('/api/components').then(r => setComponents(r.data)).catch(() => toast.error('Erro ao carregar componentes'));
    }, []);

    return (
        <RoleGuard allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Componentes</h1>
                        <p className="text-sm text-zinc-400 mt-1">Configuração de componentes e limites de manutenção</p>
                    </div>
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                        <Plus className="mr-2 h-4 w-4" /> Novo Componente
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {components.map((comp) => {
                        const cc = criticalityConfig[comp.criticality] || criticalityConfig.MEDIUM;
                        return (
                            <Card key={comp.id} className="border-zinc-800 bg-zinc-900/50">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-medium text-zinc-200">{comp.name}</h3>
                                        <Badge variant="outline" className={`text-[10px] ${cc.color}`}>{cc.label}</Badge>
                                    </div>
                                    <p className="text-xs text-zinc-500 mb-4">{comp.description || 'Sem descrição'}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
                                            <p className="text-lg font-bold text-zinc-200">{comp.maxCycles}</p>
                                            <p className="text-[10px] text-zinc-500">Ciclos Máx.</p>
                                        </div>
                                        <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
                                            <p className="text-lg font-bold text-zinc-200">{comp.maxDays}</p>
                                            <p className="text-[10px] text-zinc-500">Dias Máx.</p>
                                        </div>
                                    </div>
                                    {comp.averageReplacementCost && (
                                        <p className="mt-3 text-xs text-zinc-600">Custo médio: R$ {Number(comp.averageReplacementCost).toFixed(2)}</p>
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
