'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { CreateBarrelDialog } from '@/components/dialogs/create-barrel-dialog';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'Ativo', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    IN_TRANSIT: { label: 'Em Trânsito', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    AT_CLIENT: { label: 'No Cliente', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    IN_MAINTENANCE: { label: 'Manutenção', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    BLOCKED: { label: 'Bloqueado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    DISPOSED: { label: 'Descartado', color: 'bg-zinc-500/10 text-muted-foreground border-zinc-500/20' },
    LOST: { label: 'Perdido', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const healthConfig: Record<string, { label: string; color: string }> = {
    GREEN: { label: '●', color: 'text-green-400' },
    YELLOW: { label: '●', color: 'text-amber-400' },
    RED: { label: '●', color: 'text-red-400' },
};

export default function BarrelsPage() {
    const searchParams = useSearchParams();
    const [barrels, setBarrels] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
    const [loading, setLoading] = useState(true);

    const fetchBarrels = async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 20 };
            if (search) params.search = search;
            if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
            const { data } = await api.get('/api/barrels', { params });
            setBarrels(data.items);
            setTotal(data.total);
        } catch (error) {
            toast.error('Erro ao carregar barris');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBarrels(); }, [page, statusFilter]);

    const getWorstHealth = (cycles: any[]) => {
        if (!cycles || cycles.length === 0) return 'GREEN';
        if (cycles.some((c: any) => c.healthScore === 'RED')) return 'RED';
        if (cycles.some((c: any) => c.healthScore === 'YELLOW')) return 'YELLOW';
        return 'GREEN';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Barris</h1>
                    <p className="text-sm text-muted-foreground mt-1">{total} barris cadastrados</p>
                </div>
                <CreateBarrelDialog onCreated={fetchBarrels} />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por código ou QR..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchBarrels()}
                        className="border-border bg-muted/50 pl-10 text-foreground placeholder:text-muted-foreground"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44 border-border bg-muted/50 text-foreground">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                        <SelectItem value="all">Todos</SelectItem>
                        {Object.entries(statusConfig).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card className="border-border bg-card/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Código</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">QR Code</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Capacidade</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ciclos</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Saúde</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
                            ) : barrels.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum barril encontrado</td></tr>
                            ) : barrels.map((barrel) => {
                                const worst = getWorstHealth(barrel.componentCycles);
                                const hc = healthConfig[worst];
                                const sc = statusConfig[barrel.status] || statusConfig.ACTIVE;
                                return (
                                    <tr key={barrel.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                                        <td className="px-4 py-3">
                                            <Link href={`/barrels/${barrel.id}`} className="text-sm font-medium text-amber-400 hover:text-amber-300">
                                                {barrel.internalCode}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{barrel.qrCode}</td>
                                        <td className="px-4 py-3 text-sm text-foreground">{barrel.capacityLiters}L</td>
                                        <td className="px-4 py-3 text-sm text-foreground">{barrel.totalCycles}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-lg ${hc.color}`}>{hc.label}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {total > 20 && (
                    <div className="flex items-center justify-between border-t border-border px-4 py-3">
                        <p className="text-sm text-muted-foreground">Página {page} de {Math.ceil(total / 20)}</p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="border-border text-foreground">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="border-border text-foreground">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
