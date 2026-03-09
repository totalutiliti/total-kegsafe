"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Package,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  QrCode,
  Upload,
  Link2,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  List,
  Filter,
  X as XIcon,
  Star,
} from "lucide-react";
import { CreateBarrelDialog } from "@/components/dialogs/create-barrel-dialog";
import { ShowForRoles } from "@/components/show-for-roles";
import { useSearchShortcut } from "@/hooks/use-keyboard-shortcuts";
import { useFavorites } from "@/hooks/use-favorites";
import { toast } from "@/lib/toast-with-sound";

const statusConfig: Record<string, { label: string; color: string }> = {
  PRE_REGISTERED: {
    label: "Pré-Registrado",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  ACTIVE: {
    label: "Ativo",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  IN_TRANSIT: {
    label: "Em Trânsito",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  AT_CLIENT: {
    label: "No Cliente",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  IN_YARD: {
    label: "No Pátio",
    color: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  IN_MAINTENANCE: {
    label: "Manutenção",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  BLOCKED: {
    label: "Bloqueado",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  DISPOSED: {
    label: "Descartado",
    color: "bg-zinc-500/10 text-muted-foreground border-zinc-500/20",
  },
  LOST: {
    label: "Perdido",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

const healthConfig: Record<string, { label: string; color: string }> = {
  GREEN: { label: "●", color: "text-green-400" },
  YELLOW: { label: "●", color: "text-amber-400" },
  RED: { label: "●", color: "text-red-400" },
};

export default function BarrelsPage() {
  const searchParams = useSearchParams();
  const [barrels, setBarrels] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all",
  );
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('kegsafe-barrels-view') as 'table' | 'grid') || 'table';
    }
    return 'table';
  });
  const [filterCapacity, setFilterCapacity] = useState<string[]>([]);
  const [filterHealth, setFilterHealth] = useState<string[]>([]);
  const [filterManufacturer, setFilterManufacturer] = useState<string>('');
  const searchRef = useSearchShortcut();
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get("/barrels/import/template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "template-importacao-barris.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Template baixado!");
    } catch {
      toast.error("Erro ao baixar template");
    }
  };

  const fetchBarrels = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      const { data } = await api.get("/barrels", { params });
      setBarrels(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages ?? Math.ceil(data.total / limit));
    } catch (error) {
      toast.error("Erro ao carregar barris");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchBarrels();
    }, search ? 400 : 0);
    return () => clearTimeout(timeout);
  }, [page, statusFilter, search, limit]);

  useEffect(() => {
    localStorage.setItem('kegsafe-barrels-view', viewMode);
  }, [viewMode]);

  const getWorstHealth = (cycles: any[]) => {
    if (!cycles || cycles.length === 0) return "GREEN";
    if (cycles.some((c: any) => c.healthScore === "RED")) return "RED";
    if (cycles.some((c: any) => c.healthScore === "YELLOW")) return "YELLOW";
    return "GREEN";
  };

  const manufacturers = [...new Set(barrels.map((b: any) => b.manufacturer).filter(Boolean))].sort();

  const filteredBarrels = barrels.filter((barrel: any) => {
    if (filterCapacity.length > 0 && !filterCapacity.includes(String(barrel.capacityLiters))) return false;
    if (filterHealth.length > 0) {
      const worst = getWorstHealth(barrel.componentCycles);
      if (!filterHealth.includes(worst)) return false;
    }
    if (filterManufacturer && barrel.manufacturer !== filterManufacturer) return false;
    return true;
  });

  const sortedBarrels = [...filteredBarrels].sort((a, b) => {
    if (!sortBy) return 0;
    const dir = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
        case 'internalCode':
            return dir * (a.internalCode || '').localeCompare(b.internalCode || '');
        case 'capacityLiters':
            return dir * ((a.capacityLiters || 0) - (b.capacityLiters || 0));
        case 'totalCycles':
            return dir * ((a.totalCycles || 0) - (b.totalCycles || 0));
        case 'status':
            return dir * (a.status || '').localeCompare(b.status || '');
        default:
            return 0;
    }
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedBarrels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedBarrels.map(b => b.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBatchStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    try {
      await api.patch('/barrels/batch-status', {
        barrelIds: Array.from(selectedIds),
        status: newStatus,
      });
      toast.success(`${selectedIds.size} barris atualizados para ${(statusConfig[newStatus] || { label: newStatus }).label}`);
      clearSelection();
      fetchBarrels();
    } catch {
      toast.error('Erro ao atualizar barris em massa');
    }
  };

  const activeFilterCount = filterCapacity.length + filterHealth.length + (filterManufacturer ? 1 : 0);

  const clearFilters = () => {
    setFilterCapacity([]);
    setFilterHealth([]);
    setFilterManufacturer('');
  };

  const toggleCapacity = (val: string) => {
    setFilterCapacity(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const toggleHealth = (val: string) => {
    setFilterHealth(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const SortHeader = ({ column, label }: { column: string; label: string }) => (
    <button
        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
        onClick={() => {
            if (sortBy === column) {
                setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
            } else {
                setSortBy(column);
                setSortOrder('asc');
            }
        }}
    >
        {label}
        {sortBy === column ? (
            sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Barris</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} barris cadastrados
          </p>
        </div>
        <ShowForRoles roles={['ADMIN', 'MANAGER']}>
          <div className="flex gap-2">
            <CreateBarrelDialog onCreated={fetchBarrels} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-border text-foreground"
                >
                  Operações em Massa
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-border bg-card w-72">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/barrels/quick-register">
                      <DropdownMenuItem className="cursor-pointer">
                        <QrCode className="mr-2 h-4 w-4 shrink-0" />
                        <div>
                          <p>Cadastro Rápido (scan)</p>
                          <p className="text-xs text-muted-foreground font-normal">Escaneie QR codes para cadastrar barris um a um</p>
                        </div>
                      </DropdownMenuItem>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p>Use a câmera para escanear o QR code de cada barril novo. Ideal para recebimento de lotes pequenos no chão de fábrica.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/barrels/import">
                      <DropdownMenuItem className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4 shrink-0" />
                        <div>
                          <p>Importar Planilha</p>
                          <p className="text-xs text-muted-foreground font-normal">Importe barris em massa via arquivo .xlsx ou .csv</p>
                        </div>
                      </DropdownMenuItem>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p>Faça upload de uma planilha com os dados dos barris. Colunas: QR Code, Fabricante, Válvula, Capacidade, Tara, Material, Custo.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/barrels/link-qr">
                      <DropdownMenuItem className="cursor-pointer">
                        <Link2 className="mr-2 h-4 w-4 shrink-0" />
                        <div>
                          <p>Vincular QR Codes</p>
                          <p className="text-xs text-muted-foreground font-normal">Associe QR codes a barris já cadastrados sem QR</p>
                        </div>
                      </DropdownMenuItem>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p>Para barris importados sem QR code. Selecione o barril na lista e escaneie a etiqueta QR, ou faça upload de uma planilha com o mapeamento código → QR.</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1">Templates</DropdownMenuLabel>
                <DropdownMenuItem className="cursor-pointer" onSelect={(e) => { e.preventDefault(); handleDownloadTemplate(); }}>
                  <Download className="mr-2 h-4 w-4 shrink-0" />
                  <div>
                    <p>Template Importação (.xlsx)</p>
                    <p className="text-xs text-muted-foreground font-normal">Planilha modelo para cadastro em massa</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ShowForRoles>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Buscar por código ou QR..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border-border bg-muted/50 pl-10 text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 border-border bg-muted/50 text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="border-border bg-card">
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="border-border text-foreground gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="outline" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 border-border bg-card" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Filtros Avançados</h4>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    <XIcon className="h-3 w-3" /> Limpar
                  </button>
                )}
              </div>

              {/* Capacity filter */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Capacidade</p>
                <div className="flex flex-wrap gap-2">
                  {['30', '50'].map(cap => (
                    <button
                      key={cap}
                      onClick={() => toggleCapacity(cap)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        filterCapacity.includes(cap)
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {cap}L
                    </button>
                  ))}
                </div>
              </div>

              {/* Health filter */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Saúde</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'GREEN', label: 'Saudável', color: 'text-green-400 border-green-500/30 bg-green-500/20' },
                    { value: 'YELLOW', label: 'Atenção', color: 'text-amber-400 border-amber-500/30 bg-amber-500/20' },
                    { value: 'RED', label: 'Crítico', color: 'text-red-400 border-red-500/30 bg-red-500/20' },
                  ].map(h => (
                    <button
                      key={h.value}
                      onClick={() => toggleHealth(h.value)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        filterHealth.includes(h.value) ? h.color : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manufacturer filter */}
              {manufacturers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Fabricante</p>
                  <Select value={filterManufacturer || '__all__'} onValueChange={v => setFilterManufacturer(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs border-border bg-muted/50">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="__all__">Todos</SelectItem>
                      {manufacturers.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            title="Visualização em tabela"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            title="Visualização em grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table / Grid */}
      {viewMode === 'table' ? (
        <Card className="border-border bg-card/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={sortedBarrels.length > 0 && selectedIds.size === sortedBarrels.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-border"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    <SortHeader column="internalCode" label="Código" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    QR Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">
                    Chassi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    <SortHeader column="capacityLiters" label="Capacidade" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    <SortHeader column="totalCycles" label="Ciclos" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Saúde
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    <SortHeader column="status" label="Status" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Carregando...
                    </td>
                  </tr>
                ) : barrels.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum barril encontrado
                    </td>
                  </tr>
                ) : (
                  sortedBarrels.map((barrel) => {
                    const worst = getWorstHealth(barrel.componentCycles);
                    const hc = healthConfig[worst];
                    const sc = statusConfig[barrel.status] || statusConfig.ACTIVE;
                    return (
                      <tr
                        key={barrel.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(barrel.id)}
                            onCheckedChange={() => toggleSelect(barrel.id)}
                            className="border-border"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite({
                                  id: barrel.id,
                                  type: 'barrel',
                                  label: barrel.internalCode,
                                  sublabel: `${barrel.capacityLiters}L • ${(statusConfig[barrel.status] || statusConfig.ACTIVE).label}`,
                                  href: `/barrels/${barrel.id}`,
                                });
                              }}
                              className="text-muted-foreground hover:text-amber-400 transition-colors"
                              title={isFavorite(barrel.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                            >
                              <Star className={`h-4 w-4 ${isFavorite(barrel.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>
                            <Link
                              href={`/barrels/${barrel.id}`}
                              className="text-sm font-medium text-amber-400 hover:text-amber-300"
                            >
                              {barrel.internalCode}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {barrel.qrCode || (
                            <span className="text-xs text-amber-400/60 italic">
                              sem QR
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono hidden lg:table-cell">
                          {barrel.chassisNumber || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {barrel.capacityLiters}L
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {barrel.totalCycles}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-lg ${hc.color}`}>
                            {hc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs ${sc.color}`}
                          >
                            {sc.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 gap-2">
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-border text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="border-border text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted-foreground border-t-amber-500" />
            </div>
          ) : sortedBarrels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum barril encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedBarrels.map((barrel) => {
                const worst = getWorstHealth(barrel.componentCycles);
                const hc = healthConfig[worst];
                const sc = statusConfig[barrel.status] || statusConfig.ACTIVE;
                return (
                  <Link key={barrel.id} href={`/barrels/${barrel.id}`}>
                    <Card className="border-border bg-card/50 hover:bg-muted/30 transition-colors cursor-pointer h-full">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFavorite({
                                  id: barrel.id,
                                  type: 'barrel',
                                  label: barrel.internalCode,
                                  sublabel: `${barrel.capacityLiters}L • ${(statusConfig[barrel.status] || statusConfig.ACTIVE).label}`,
                                  href: `/barrels/${barrel.id}`,
                                });
                              }}
                              className="text-muted-foreground hover:text-amber-400 transition-colors"
                            >
                              <Star className={`h-3.5 w-3.5 ${isFavorite(barrel.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>
                            <span className="text-sm font-medium text-amber-400">{barrel.internalCode}</span>
                          </div>
                          <span className={`text-lg ${hc.color}`}>{hc.label}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <span>{barrel.capacityLiters}L</span>
                          <span className="text-right">{barrel.totalCycles} ciclos</span>
                          {barrel.qrCode && <span className="col-span-2 font-mono truncate">{barrel.qrCode}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
          {/* Grid pagination */}
          {totalPages > 1 && (
            <Card className="border-border bg-card/50">
              <div className="flex items-center justify-between px-4 py-3 gap-2">
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="border-border text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="border-border text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-xl">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="h-5 w-px bg-border" />
          <Select onValueChange={handleBatchStatus}>
            <SelectTrigger className="w-[180px] h-8 text-xs border-border bg-muted/50">
              <SelectValue placeholder="Alterar status..." />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar selecao
          </button>
        </div>
      )}
    </div>
  );
}
