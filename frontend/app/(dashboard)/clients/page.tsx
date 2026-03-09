'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2, Phone, Mail, MapPin, ChevronLeft, ChevronRight, Pencil, Trash2, Search } from 'lucide-react';
import { CreateClientDialog } from '@/components/dialogs/create-client-dialog';
import { EditClientDialog } from '@/components/dialogs/edit-client-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RoleGuard } from '@/components/role-guard';
import { useSearchShortcut } from '@/hooks/use-keyboard-shortcuts';
import { toast } from 'sonner';

export default function ClientsPage() {
    const [clients, setClients] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [editClient, setEditClient] = useState<any | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [limit, setLimit] = useState(20);
    const searchRef = useSearchShortcut();
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchClients();
        }, search ? 400 : 0);
        return () => clearTimeout(timeout);
    }, [page, search, limit]);

    const fetchClients = () => {
        const params: any = { page, limit };
        if (search) params.search = search;
        api.get('/clients', { params })
            .then(r => {
                setClients(r.data.items);
                setTotal(r.data.total);
            })
            .catch(() => toast.error('Erro ao carregar clientes'));
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/clients/${deleteTarget.id}`);
            toast.success('Cliente excluído com sucesso');
            setConfirmOpen(false);
            setDeleteTarget(null);
            fetchClients();
        } catch {
            toast.error('Erro ao excluir cliente');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
                        <p className="text-sm text-muted-foreground mt-1">{total} clientes cadastrados</p>
                    </div>
                    <CreateClientDialog onCreated={fetchClients} />
                </div>

                <div className="relative sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        ref={searchRef}
                        placeholder="Buscar por nome ou CNPJ..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="border-border bg-muted/50 pl-10 text-foreground placeholder:text-muted-foreground"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {clients.map((client) => (
                        <Card key={client.id} className="border-border bg-card/50 hover:border-accent transition-colors">
                            <CardContent className="p-5">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 flex-shrink-0">
                                        <Building2 className="h-5 w-5 text-purple-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-medium text-foreground truncate">{client.tradeName || client.name}</h3>
                                                <p className="text-xs text-muted-foreground truncate">{client.name}</p>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => { setEditClient(client); setEditOpen(true); }}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Editar cliente</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                                            onClick={() => { setDeleteTarget({ id: client.id, name: client.tradeName || client.name }); setConfirmOpen(true); }}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Excluir cliente</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="mt-3 space-y-1">
                                            {client.phone && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Phone className="h-3 w-3" /> {client.phone}
                                                </div>
                                            )}
                                            {client.email && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Mail className="h-3 w-3" /> {client.email}
                                                </div>
                                            )}
                                            {client.address && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" /> <span className="truncate">{client.address}</span>
                                                </div>
                                            )}
                                        </div>
                                        {client.geofences?.length > 0 && (
                                            <Badge variant="outline" className="mt-2 text-[10px] border-border text-muted-foreground">
                                                {client.geofences.length} geofence(s)
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Itens:</span>
                                <Select value={String(limit)} onValueChange={v => { setLimit(Number(v)); setPage(1); }}>
                                    <SelectTrigger className="w-[70px] h-8 text-xs border-border bg-muted/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-border bg-card">
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                                Página {page} de {totalPages}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="border-border text-foreground hover:bg-accent"
                            >
                                <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline ml-1">Anterior</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="border-border text-foreground hover:bg-accent"
                            >
                                <span className="hidden sm:inline mr-1">Próximo</span><ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <EditClientDialog
                client={editClient}
                open={editOpen}
                onOpenChange={setEditOpen}
                onUpdated={fetchClients}
            />

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Excluir cliente"
                description={`Deseja realmente excluir o cliente "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                variant="destructive"
                loading={deleting}
                onConfirm={handleDelete}
            />
        </RoleGuard>
    );
}
