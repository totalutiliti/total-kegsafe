'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Building2,
    Plus,
    ChevronLeft,
    ChevronRight,
    Search,
    Users,
    Package,
    Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    cnpj: string;
    isActive: boolean;
    createdAt: string;
    userCount: number;
    barrelCount: number;
}

export default function SuperAdminTenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        fetchTenants();
    }, [page, search]);

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const params: Record<string, any> = { page, limit };
            if (search) params.search = search;
            const { data } = await api.get('/super-admin/tenants', { params });
            setTenants(data.items);
            setTotal(data.total);
        } catch {
            toast.error('Erro ao carregar tenants');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput);
    };

    const formatCnpj = (cnpj: string) => {
        if (!cnpj || cnpj.length !== 14) return cnpj;
        return cnpj.replace(
            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
            '$1.$2.$3/$4-$5'
        );
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Tenants</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {total} {total === 1 ? 'empresa cadastrada' : 'empresas cadastradas'}
                    </p>
                </div>
                <Link href="/superadmin/tenants/new">
                    <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Tenant
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, slug ou CNPJ..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="pl-10 border-border bg-muted/50 text-foreground"
                    />
                </div>
                <Button
                    type="submit"
                    variant="outline"
                    className="border-border text-foreground hover:bg-accent"
                >
                    Buscar
                </Button>
                {search && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            setSearch('');
                            setSearchInput('');
                            setPage(1);
                        }}
                        className="text-muted-foreground"
                    >
                        Limpar
                    </Button>
                )}
            </form>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-indigo-500" />
                        <p className="text-muted-foreground text-sm">Carregando...</p>
                    </div>
                </div>
            ) : tenants.length === 0 ? (
                <Card className="border-border bg-card/50">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Building2 className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">
                            {search
                                ? 'Nenhum tenant encontrado para esta busca'
                                : 'Nenhum tenant cadastrado'}
                        </p>
                        {!search && (
                            <Link href="/superadmin/tenants/new" className="mt-4">
                                <Button
                                    variant="outline"
                                    className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Criar primeiro tenant
                                </Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {tenants.map((tenant) => (
                        <Link key={tenant.id} href={`/superadmin/tenants/${tenant.id}`}>
                            <Card className="border-border bg-card/50 hover:border-indigo-500/30 hover:bg-card/80 transition-all cursor-pointer group">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 text-sm font-bold group-hover:bg-indigo-500/20 transition-colors">
                                                {tenant.name
                                                    .split(' ')
                                                    .map((n) => n[0])
                                                    .join('')
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-foreground">
                                                    {tenant.name}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    {tenant.slug}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                tenant.isActive
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }
                                        >
                                            {tenant.isActive ? 'Ativo' : 'Suspenso'}
                                        </Badge>
                                    </div>

                                    <p className="text-xs text-muted-foreground mb-4">
                                        CNPJ: {formatCnpj(tenant.cnpj)}
                                    </p>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5" />
                                            <span>
                                                {tenant.userCount}{' '}
                                                {tenant.userCount === 1
                                                    ? 'usuário'
                                                    : 'usuários'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Package className="h-3.5 w-3.5" />
                                            <span>
                                                {tenant.barrelCount}{' '}
                                                {tenant.barrelCount === 1
                                                    ? 'barril'
                                                    : 'barris'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span>{formatDate(tenant.createdAt)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

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
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="border-border text-foreground hover:bg-accent"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="border-border text-foreground hover:bg-accent"
                        >
                            Próximo
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
