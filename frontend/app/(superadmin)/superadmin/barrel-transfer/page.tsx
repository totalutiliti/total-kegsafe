'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
    ArrowRightLeft,
    Search,
    X,
    Check,
    AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Tenant {
    id: string;
    name: string;
}

interface BarrelResult {
    id: string;
    internalCode: string;
    tenantId: string;
    tenantName?: string;
    status: string;
}

export default function BarrelTransferPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [searching, setSearching] = useState(false);
    const [selectedBarrels, setSelectedBarrels] = useState<BarrelResult[]>([]);
    const [toTenantId, setToTenantId] = useState('');
    const [notes, setNotes] = useState('');
    const [confirmDialog, setConfirmDialog] = useState(false);
    const [transferring, setTransferring] = useState(false);

    const fetchTenants = useCallback(async () => {
        if (loaded) return;
        try {
            const { data } = await api.get('/super-admin/tenants', {
                params: { limit: 100 },
            });
            setTenants(data.items.map((t: any) => ({ id: t.id, name: t.name })));
            setLoaded(true);
        } catch {
            toast.error('Erro ao carregar tenants');
        }
    }, [loaded]);

    // Fetch on mount
    useState(() => { fetchTenants(); });

    const handleSearch = async () => {
        const code = searchCode.trim();
        if (!code) return;
        if (selectedBarrels.some((b) => b.internalCode === code)) {
            toast.error('Barril já adicionado');
            return;
        }
        setSearching(true);
        try {
            // Try to find barrel by scan endpoint (cross-tenant)
            const { data } = await api.post('/barrels/scan', { code });
            const barrel = data.barrel;
            const tenantName =
                tenants.find((t) => t.id === barrel.tenantId)?.name ??
                'Desconhecido';
            setSelectedBarrels((prev) => [
                ...prev,
                {
                    id: barrel.id,
                    internalCode: barrel.internalCode,
                    tenantId: barrel.tenantId,
                    tenantName,
                    status: barrel.status,
                },
            ]);
            setSearchCode('');
            toast.success(`Barril ${barrel.internalCode} adicionado`);
        } catch (err: any) {
            toast.error(
                err.response?.data?.message || 'Barril não encontrado',
            );
        } finally {
            setSearching(false);
        }
    };

    const removeBarrel = (id: string) => {
        setSelectedBarrels((prev) => prev.filter((b) => b.id !== id));
    };

    const handleTransfer = async () => {
        if (!toTenantId || selectedBarrels.length === 0) return;
        setTransferring(true);
        try {
            const { data } = await api.post('/super-admin/barrels/transfer-batch', {
                barrelIds: selectedBarrels.map((b) => b.id),
                toTenantId,
                notes: notes || undefined,
            });
            toast.success(
                `${data.transferred} barris transferidos para ${data.toTenant.name}`,
            );
            setSelectedBarrels([]);
            setToTenantId('');
            setNotes('');
            setConfirmDialog(false);
        } catch (err: any) {
            toast.error(
                err.response?.data?.message || 'Erro na transferência',
            );
        } finally {
            setTransferring(false);
        }
    };

    const targetTenant = tenants.find((t) => t.id === toTenantId);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    Transferência de Barris
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Transferência em lote de barris entre clientes
                </p>
            </div>

            {/* Search + Add */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Search className="h-5 w-5 text-indigo-400" />
                        Buscar Barris
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSearch();
                        }}
                        className="flex gap-2"
                    >
                        <Input
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            placeholder="Digite o código (ex: KS-BAR-000000001)"
                            className="border-border bg-muted/50 text-foreground font-mono flex-1"
                        />
                        <Button
                            type="submit"
                            disabled={searching}
                            variant="outline"
                            className="border-border text-foreground"
                        >
                            {searching ? '...' : 'Adicionar'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Selected Barrels */}
            {selectedBarrels.length > 0 && (
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-foreground">
                                Barris selecionados ({selectedBarrels.length})
                            </CardTitle>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => setSelectedBarrels([])}
                            >
                                Limpar tudo
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {selectedBarrels.map((barrel) => (
                                <div
                                    key={barrel.id}
                                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm text-foreground">
                                            {barrel.internalCode}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                        >
                                            {barrel.tenantName}
                                        </Badge>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                                        onClick={() => removeBarrel(barrel.id)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {/* Transfer destination */}
                        <div className="mt-4 pt-4 border-t border-border space-y-4">
                            <div className="space-y-2">
                                <Label className="text-foreground">
                                    Transferir para
                                </Label>
                                <Select
                                    value={toTenantId}
                                    onValueChange={setToTenantId}
                                >
                                    <SelectTrigger className="border-border bg-muted/50 text-foreground">
                                        <SelectValue placeholder="Selecione o tenant destino" />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card">
                                        {tenants.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground">
                                    Observações (opcional)
                                </Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Motivo da transferência..."
                                    className="border-border bg-muted/50 text-foreground"
                                />
                            </div>
                            <Button
                                onClick={() => setConfirmDialog(true)}
                                disabled={!toTenantId}
                                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                            >
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Transferir {selectedBarrels.length} barris
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Confirm Dialog */}
            <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
                <DialogContent className="border-border bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            Confirmar Transferência
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                            <p className="text-sm text-amber-400">
                                Esta ação é irreversível. Os barris serão
                                transferidos permanentemente.
                            </p>
                        </div>
                        <p className="text-sm text-foreground">
                            Transferir{' '}
                            <span className="font-bold">
                                {selectedBarrels.length} barris
                            </span>{' '}
                            para{' '}
                            <span className="font-bold">
                                {targetTenant?.name}
                            </span>
                            ?
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog(false)}
                            className="border-border text-foreground"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleTransfer}
                            disabled={transferring}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                        >
                            {transferring ? 'Transferindo...' : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
