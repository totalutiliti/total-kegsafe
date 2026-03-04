'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle2, Clock, Lightbulb } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string }> = {
    SUGGESTED: { label: 'Sugerido', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    PENDING_APPROVAL: { label: 'Aguardando', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    APPROVED: { label: 'Aprovado', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    COMPLETED: { label: 'Concluído', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20' },
    REJECTED: { label: 'Rejeitado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export default function DisposalPage() {
    const [disposals, setDisposals] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    useEffect(() => {
        Promise.all([
            api.get('/api/disposals'),
            api.get('/api/disposals/suggestions'),
        ]).then(([d, s]) => {
            setDisposals(d.data);
            setSuggestions(s.data);
        }).catch(() => toast.error('Erro ao carregar descartes'));
    }, []);

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'MAINTENANCE']}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Descarte</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gestão de baixa patrimonial</p>
                </div>

                {suggestions.length > 0 && (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <Lightbulb className="h-5 w-5 text-amber-400" />
                                <h3 className="text-sm font-medium text-amber-300">Sugestões de Descarte</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">Barris com custo de manutenção superior a 60% do valor de aquisição:</p>
                            <div className="space-y-2">
                                {suggestions.slice(0, 5).map((barrel: any) => (
                                    <div key={barrel.id} className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
                                        <div>
                                            <span className="text-sm font-medium text-foreground">{barrel.internalCode}</span>
                                            <span className="ml-3 text-xs text-muted-foreground">Manutenção: R$ {Number(barrel.totalMaintenanceCost).toFixed(2)}</span>
                                        </div>
                                        <Button variant="outline" size="sm" className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10">
                                            Solicitar
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-3">
                    {disposals.length === 0 ? (
                        <Card className="border-border bg-card/50">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Trash2 className="h-12 w-12 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground">Nenhuma solicitação de descarte</p>
                            </CardContent>
                        </Card>
                    ) : disposals.map((d) => {
                        const sc = statusConfig[d.status] || statusConfig.PENDING_APPROVAL;
                        return (
                            <Card key={d.id} className="border-border bg-card/50">
                                <CardContent className="flex items-center gap-4 p-5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                                        <Trash2 className="h-5 w-5 text-red-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-foreground">{d.barrel?.internalCode}</span>
                                            <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{d.reason}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-foreground">TCO: R$ {Number(d.tcoAccumulated).toFixed(2)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </RoleGuard>
    );
}
