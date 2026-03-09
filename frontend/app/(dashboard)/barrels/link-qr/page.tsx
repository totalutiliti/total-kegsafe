"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  QrScanner,
  playSuccessBeep,
  playErrorBeep,
} from "@/components/qr-scanner";
import {
  ArrowLeft,
  Download,
  Upload,
  QrCode,
  Link2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Breadcrumb } from '@/components/breadcrumb';
import { toast } from "sonner";

interface UnlinkedBarrel {
  id: string;
  internalCode: string;
  capacityLiters: number;
  manufacturer?: string;
}

export default function LinkQrPage() {
  const [barrels, setBarrels] = useState<UnlinkedBarrel[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedBarrel, setSelectedBarrel] = useState<UnlinkedBarrel | null>(
    null,
  );
  const [scannerActive, setScannerActive] = useState(false);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);

  // Planilha state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkResult, setLinkResult] = useState<{
    linked: number;
    errors: any[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUnlinked = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/barrels/unlinked", {
        params: { page, limit: 20 },
      });
      setBarrels(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages ?? Math.ceil(data.total / 20));
    } catch {
      toast.error("Erro ao carregar barris sem QR");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchUnlinked();
  }, [fetchUnlinked]);

  const handleScan = useCallback(
    async (qrCode: string) => {
      if (!selectedBarrel) {
        playErrorBeep();
        toast.error("Selecione um barril primeiro");
        return;
      }

      try {
        await api.patch(`/barrels/${selectedBarrel.id}/link-qr`, {
          qrCode,
        });
        playSuccessBeep();
        setFlash("success");
        setTimeout(() => setFlash(null), 500);
        toast.success(
          `QR vinculado: ${selectedBarrel.internalCode} → ${qrCode}`,
        );

        // Remover da lista e selecionar próximo
        setBarrels((prev) => {
          const updated = prev.filter((b) => b.id !== selectedBarrel.id);
          if (updated.length > 0) {
            const idx = prev.findIndex((b) => b.id === selectedBarrel.id);
            setSelectedBarrel(
              updated[Math.min(idx, updated.length - 1)] || null,
            );
          } else {
            setSelectedBarrel(null);
          }
          return updated;
        });
        setTotal((t) => t - 1);
      } catch (error: any) {
        playErrorBeep();
        setFlash("error");
        setTimeout(() => setFlash(null), 500);
        toast.error(
          error.response?.data?.message || "Erro ao vincular QR code",
        );
      }
    },
    [selectedBarrel],
  );

  const handleExportUnlinked = async () => {
    try {
      const response = await api.get("/barrels/unlinked/export", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "barrels-sem-qr.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao exportar planilha");
    }
  };

  const handleUploadLinkFile = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const { data } = await api.post("/barrels/link-qr/batch", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLinkResult(data);
      toast.success(`${data.linked} barris vinculados`);
      fetchUnlinked();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Erro ao vincular em massa",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Barris', href: '/barrels' },
        { label: 'Vincular QR Codes' },
      ]} />
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Vincular QR Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} barris aguardando vinculação
          </p>
        </div>
      </div>

      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50">
          <TabsTrigger value="scanner">
            <QrCode className="mr-2 h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="spreadsheet">
            <Upload className="mr-2 h-4 w-4" />
            Planilha
          </TabsTrigger>
        </TabsList>

        {/* Tab Scanner */}
        <TabsContent value="scanner" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lista de barris sem QR */}
            <Card className="border-border bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm text-foreground">
                  Barris sem QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Carregando...
                  </p>
                ) : barrels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Todos os barris já possuem QR code
                  </p>
                ) : (
                  <>
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {barrels.map((barrel) => (
                        <button
                          key={barrel.id}
                          onClick={() => {
                            setSelectedBarrel(barrel);
                            setScannerActive(true);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                            selectedBarrel?.id === barrel.id
                              ? "bg-amber-500/10 border border-amber-500/30"
                              : "hover:bg-muted/30 border border-transparent"
                          }`}
                        >
                          <div>
                            <span className="text-sm font-mono text-foreground">
                              {barrel.internalCode}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {barrel.capacityLiters}L
                            </span>
                          </div>
                          <Link2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Página {page} de {totalPages}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="h-7 w-7 p-0 border-border text-foreground"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page >= totalPages}
                            className="h-7 w-7 p-0 border-border text-foreground"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Scanner */}
            <div className="space-y-3">
              {selectedBarrel && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">
                      Vinculando QR para:
                    </p>
                    <p className="text-lg font-mono font-bold text-amber-400">
                      {selectedBarrel.internalCode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedBarrel.capacityLiters}L
                      {selectedBarrel.manufacturer
                        ? ` • ${selectedBarrel.manufacturer}`
                        : ""}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div
                className={`rounded-lg transition-all duration-300 ${
                  flash === "success"
                    ? "ring-4 ring-green-500"
                    : flash === "error"
                      ? "ring-4 ring-red-500"
                      : ""
                }`}
              >
                <QrScanner
                  onScan={handleScan}
                  active={scannerActive && !!selectedBarrel}
                  cooldownMs={2000}
                />
              </div>

              {!selectedBarrel && (
                <p className="text-sm text-muted-foreground text-center">
                  Selecione um barril da lista para iniciar o scan
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Planilha */}
        <TabsContent value="spreadsheet" className="space-y-4">
          <Card className="border-border bg-card/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Baixe a lista de barris pendentes, preencha a coluna qrCode e
                  faça o upload.
                </p>
                <Button
                  variant="outline"
                  onClick={handleExportUnlinked}
                  className="border-border text-foreground"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Lista Pendentes
                </Button>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUploadFile(f);
                  }}
                />
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-foreground">
                  {uploadFile
                    ? uploadFile.name
                    : "Arraste ou clique para selecionar"}
                </p>
              </div>

              {uploadFile && (
                <div className="flex justify-end">
                  <Button
                    onClick={handleUploadLinkFile}
                    disabled={uploading}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                  >
                    {uploading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Link2 className="mr-2 h-4 w-4" />
                    Vincular QR Codes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultado da vinculação */}
          {linkResult && (
            <Card className="border-border bg-card/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Check className="h-8 w-8 text-green-400" />
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {linkResult.linked} barris vinculados
                    </p>
                    {linkResult.errors.length > 0 && (
                      <p className="text-sm text-red-400">
                        {linkResult.errors.length} erros
                      </p>
                    )}
                  </div>
                </div>
                {linkResult.errors.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                    {linkResult.errors.map((err: any, i: number) => (
                      <p key={i} className="text-xs text-red-400">
                        {err.internalCode}: {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
