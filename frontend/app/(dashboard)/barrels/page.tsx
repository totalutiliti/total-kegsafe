"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { CreateBarrelDialog } from "@/components/dialogs/create-barrel-dialog";
import { ShowForRoles } from "@/components/show-for-roles";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
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
  const limit = 20;

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
    fetchBarrels();
  }, [page, statusFilter]);

  const getWorstHealth = (cycles: any[]) => {
    if (!cycles || cycles.length === 0) return "GREEN";
    if (cycles.some((c: any) => c.healthScore === "RED")) return "RED";
    if (cycles.some((c: any) => c.healthScore === "YELLOW")) return "YELLOW";
    return "GREEN";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou QR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchBarrels()}
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
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Código
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  QR Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Capacidade
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Ciclos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Saúde
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Carregando...
                  </td>
                </tr>
              ) : barrels.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Nenhum barril encontrado
                  </td>
                </tr>
              ) : (
                barrels.map((barrel) => {
                  const worst = getWorstHealth(barrel.componentCycles);
                  const hc = healthConfig[worst];
                  const sc = statusConfig[barrel.status] || statusConfig.ACTIVE;
                  return (
                    <tr
                      key={barrel.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/barrels/${barrel.id}`}
                          className="text-sm font-medium text-amber-400 hover:text-amber-300"
                        >
                          {barrel.internalCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {barrel.qrCode || (
                          <span className="text-xs text-amber-400/60 italic">
                            sem QR
                          </span>
                        )}
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
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
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
    </div>
  );
}
