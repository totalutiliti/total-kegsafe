'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Phone, Mail, MapPin, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { CreateClientDialog } from '@/components/dialogs/create-client-dialog';
import { EditClientDialog } from '@/components/dialogs/edit-client-dialog';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

export default function ClientsPage() {
    const [clients, setClients] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [editClient, setEditClient] = useState<any | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const totalPages = Math.ceil(total / 20);

    useEffect(() => {
        fetchClients();
    }, [page]);

    const fetchClients = () => {
        api.get('/clients', { params: { page, limit: 20 } })
            .then(r => {
                setClients(r.data.items);
                setTotal(r.data.total);
            })
            .catch(() => toast.error('Erro ao carregar clientes'));
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Deseja realmente excluir o cliente "${name}"?`)) return;
        try {
            await api.delete(`/clients/${id}`);
            toast.success('Cliente excluído com sucesso');
            fetchClients();
        } catch {
            toast.error('Erro ao excluir cliente');
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
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    onClick={() => { setEditClient(client); setEditOpen(true); }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                                    onClick={() => handleDelete(client.id, client.tradeName || client.name)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
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
                        <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
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
        </RoleGuard>
    );
}
