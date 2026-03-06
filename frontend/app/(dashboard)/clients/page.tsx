'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Phone, Mail, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { CreateClientDialog } from '@/components/dialogs/create-client-dialog';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

export default function ClientsPage() {
    const [clients, setClients] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
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

    return (
        <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
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
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-medium text-foreground truncate">{client.tradeName || client.name}</h3>
                                        <p className="text-xs text-muted-foreground truncate">{client.name}</p>
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
                                disabled={page === totalPages}
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
