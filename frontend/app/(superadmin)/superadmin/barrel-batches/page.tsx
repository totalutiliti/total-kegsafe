'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    Package,
    Printer,
    Download,
    AlertTriangle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface Tenant {
    id: string;
    name: string;
}

interface BatchPrint {
    id: string;
    printedBy: string;
    printedAt: string;
    reason: string | null;
}

interface Batch {
    id: string;
    codeStart: string;
    codeEnd: string;
    quantity: number;
    tenant: Tenant | null;
    printCount: number;
    createdBy: string;
    createdAt: string;
    prints: BatchPrint[];
}

interface Stats {
    totalBarrels: number;
    preRegisteredCount: number;
    activeCount: number;
    pendingBatches: number;
}

export default function BarrelBatchesPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    // Generate form
    const [genQuantity, setGenQuantity] = useState('100');
    const [genTenantId, setGenTenantId] = useState('none');
    const [generating, setGenerating] = useState(false);
    const [lastBatch, setLastBatch] = useState<{
        batchId: string;
        range: { start: string; end: string };
        quantity: number;
        tenant: string | null;
    } | null>(null);

    // Print dialog
    const [printDialog, setPrintDialog] = useState<{
        batchId: string;
        printCount: number;
    } | null>(null);
    const [printReason, setPrintReason] = useState('');

    // Expand details
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        // Buscar lotes e stats de forma independente para que a falha de um não afete o outro
        const [batchResult, statsResult] = await Promise.allSettled([
            api.get('/super-admin/batches', { params: { page, limit } }),
            api.get('/super-admin/batches/stats'),
        ]);

        if (batchResult.status === 'fulfilled') {
            setBatches(batchResult.value.data.items);
            setTotal(batchResult.value.data.total);
        } else {
            toast.error('Erro ao carregar lotes');
        }

        if (statsResult.status === 'fulfilled') {
            setStats(statsResult.value.data);
        }

        setLoading(false);
    }, [page]);

    const fetchTenants = useCallback(async () => {
        try {
            const { data } = await api.get('/super-admin/tenants', {
                params: { limit: 100 },
            });
            setTenants(data.items.map((t: any) => ({ id: t.id, name: t.name })));
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchTenants();
    }, [fetchData, fetchTenants]);

    const handleGenerate = async () => {
        const qty = Number(genQuantity);
        if (!qty || qty < 1 || qty > 50000) {
            toast.error('Quantidade deve ser entre 1 e 50.000');
            return;
        }
        setGenerating(true);
        try {
            const body: any = { quantity: qty };
            if (genTenantId !== 'none') body.tenantId = genTenantId;
            const { data } = await api.post('/barrels/generate-batch', body);
            setLastBatch({
                batchId: data.batchId,
                range: data.range,
                quantity: data.quantity,
                tenant: data.tenant,
            });
            toast.success(`Lote gerado: ${data.quantity} barris`);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao gerar lote');
        } finally {
            setGenerating(false);
        }
    };

    const handleExport = async (batchId: string) => {
        try {
            const res = await api.get(`/super-admin/batches/${batchId}/export`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `lote-${batchId.slice(0, 8)}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            const warning = res.headers['x-print-warning'];
            if (warning) toast.warning(warning);
            else toast.success('CSV exportado com sucesso');
            fetchData();
        } catch {
            toast.error('Erro ao exportar lote');
        }
    };

    const handlePrint = async () => {
        if (!printDialog) return;
        if (printDialog.printCount >= 1 && !printReason.trim()) {
            toast.error('Motivo obrigatório para reimpressão');
            return;
        }
        try {
            const { data } = await api.post(
                `/super-admin/batches/${printDialog.batchId}/print`,
                { reason: printReason || undefined },
            );
            if (data.warning) toast.warning(data.warning);
            else toast.success('Impressão registrada');
            // Download CSV
            await handleExport(printDialog.batchId);
            setPrintDialog(null);
            setPrintReason('');
        } catch {
            toast.error('Erro ao registrar impressão');
        }
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    Lotes de Barris
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Geração e controle de lotes de códigos para gravação a laser
                </p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="border-border bg-card/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-foreground">
                                {stats.totalBarrels.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Total de barris
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-border bg-card/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-cyan-400">
                                {stats.preRegisteredCount.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Pré-registrados
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-border bg-card/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-green-400">
                                {stats.activeCount.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Ativos
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-border bg-card/50">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-red-400">
                                {stats.pendingBatches}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Lotes sem impressão
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Generate Form */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Package className="h-5 w-5 text-indigo-400" />
                        Gerar Novo Lote
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="space-y-2 flex-1 sm:max-w-[200px]">
                            <Label className="text-foreground">Quantidade</Label>
                            <Input
                                type="number"
                                min={1}
                                max={50000}
                                value={genQuantity}
                                onChange={(e) => setGenQuantity(e.target.value)}
                                className="border-border bg-muted/50 text-foreground"
                            />
                        </div>
                        <div className="space-y-2 flex-1 sm:max-w-[300px]">
                            <Label className="text-foreground">
                                Cliente (opcional)
                            </Label>
                            <Select
                                value={genTenantId}
                                onValueChange={setGenTenantId}
                            >
                                <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-card">
                                    <SelectItem value="none">
                                        Sem vínculo
                                    </SelectItem>
                                    {tenants.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                        >
                            {generating ? 'Gerando...' : 'Gerar Lote'}
                        </Button>
                    </div>

                    {lastBatch && (
                        <div className="mt-4 p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                            <div className="flex items-center gap-2 mb-2">
                                <Check className="h-4 w-4 text-green-400" />
                                <span className="text-sm font-medium text-green-400">
                                    Lote gerado com sucesso
                                </span>
                            </div>
                            <p className="text-sm text-foreground">
                                Faixa:{' '}
                                <span className="font-mono">
                                    {lastBatch.range.start}
                                </span>{' '}
                                a{' '}
                                <span className="font-mono">
                                    {lastBatch.range.end}
                                </span>{' '}
                                ({lastBatch.quantity.toLocaleString('pt-BR')} barris)
                                {lastBatch.tenant && (
                                    <> — Cliente: {lastBatch.tenant}</>
                                )}
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                                onClick={() => handleExport(lastBatch.batchId)}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Baixar CSV para Gravação
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Batches Table */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground">
                        Lotes Gerados
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-indigo-500" />
                        </div>
                    ) : batches.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            Nenhum lote gerado ainda
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {batches.map((batch) => (
                                <div
                                    key={batch.id}
                                    className="border border-border rounded-lg p-4"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-sm text-foreground">
                                                    {batch.codeStart}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    →
                                                </span>
                                                <span className="font-mono text-sm text-foreground">
                                                    {batch.codeEnd}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                                <span>
                                                    {batch.quantity.toLocaleString(
                                                        'pt-BR',
                                                    )}{' '}
                                                    barris
                                                </span>
                                                {batch.tenant && (
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                                    >
                                                        {batch.tenant.name}
                                                    </Badge>
                                                )}
                                                <span>
                                                    por {batch.createdBy}
                                                </span>
                                                <span>
                                                    {formatDate(batch.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    batch.printCount === 0
                                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                        : batch.printCount === 1
                                                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }
                                            >
                                                {batch.printCount === 0 ? (
                                                    'Nunca impresso'
                                                ) : batch.printCount === 1 ? (
                                                    'OK'
                                                ) : (
                                                    <>
                                                        <AlertTriangle className="mr-1 h-3 w-3" />
                                                        Reimpresso{' '}
                                                        {batch.printCount}x
                                                    </>
                                                )}
                                            </Badge>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-border text-foreground"
                                                onClick={() =>
                                                    setPrintDialog({
                                                        batchId: batch.id,
                                                        printCount:
                                                            batch.printCount,
                                                    })
                                                }
                                            >
                                                <Printer className="mr-1 h-3 w-3" />
                                                {batch.printCount === 0
                                                    ? 'Imprimir'
                                                    : 'Reimprimir'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-muted-foreground"
                                                onClick={() =>
                                                    setExpandedBatch(
                                                        expandedBatch ===
                                                            batch.id
                                                            ? null
                                                            : batch.id,
                                                    )
                                                }
                                            >
                                                <ChevronDown
                                                    className={`h-4 w-4 transition-transform ${expandedBatch === batch.id ? 'rotate-180' : ''}`}
                                                />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded print history */}
                                    {expandedBatch === batch.id &&
                                        batch.prints.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-border">
                                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                                    Histórico de impressões
                                                </p>
                                                <div className="space-y-1">
                                                    {batch.prints.map(
                                                        (print) => (
                                                            <div
                                                                key={print.id}
                                                                className="flex items-center gap-2 text-xs text-muted-foreground"
                                                            >
                                                                <Printer className="h-3 w-3" />
                                                                <span>
                                                                    {formatDate(
                                                                        print.printedAt,
                                                                    )}
                                                                </span>
                                                                <span>
                                                                    por{' '}
                                                                    {
                                                                        print.printedBy
                                                                    }
                                                                </span>
                                                                {print.reason && (
                                                                    <span className="text-amber-400">
                                                                        —{' '}
                                                                        {
                                                                            print.reason
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Página {page} de {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={page === 1}
                                    className="border-border text-foreground"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={page >= totalPages}
                                    className="border-border text-foreground"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Print Dialog */}
            <Dialog
                open={!!printDialog}
                onOpenChange={() => {
                    setPrintDialog(null);
                    setPrintReason('');
                }}
            >
                <DialogContent className="border-border bg-card max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {printDialog && printDialog.printCount >= 1
                                ? 'Reimprimir Lote'
                                : 'Imprimir Lote'}
                        </DialogTitle>
                    </DialogHeader>
                    {printDialog && printDialog.printCount >= 1 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                            <p className="text-sm text-amber-400">
                                Este lote já foi impresso{' '}
                                {printDialog.printCount}x. Informe o motivo da
                                reimpressão.
                            </p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label className="text-foreground">
                            Motivo{' '}
                            {printDialog && printDialog.printCount >= 1
                                ? '(obrigatório)'
                                : '(opcional)'}
                        </Label>
                        <Textarea
                            value={printReason}
                            onChange={(e) => setPrintReason(e.target.value)}
                            placeholder="Ex: Reimpressão - etiquetas danificadas"
                            className="border-border bg-muted/50 text-foreground"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setPrintDialog(null);
                                setPrintReason('');
                            }}
                            className="border-border text-foreground"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handlePrint}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Confirmar e Baixar CSV
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
