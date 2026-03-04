"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ValidationResult {
  uploadId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: ValidationError[];
  preview: any[];
}

interface ImportProgress {
  status: string;
  total: number;
  processed: number;
  failed: number;
  percentage: number;
  errors: any[];
}

type Step = "upload" | "validation" | "importing" | "done";

export default function ImportBarrelsPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get("/api/barrels/import/template", {
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
    } catch {
      toast.error("Erro ao baixar template");
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)
    ) {
      toast.error("Formato inválido. Aceitos: .xlsx, .xls, .csv");
      return;
    }
    setFile(selectedFile);
  };

  const handleUploadAndValidate = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(
        "/api/barrels/import/validate",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setValidation(data);
      setStep("validation");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Erro ao validar arquivo",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!validation) return;
    setStep("importing");
    try {
      await api.post("/api/barrels/import/execute", {
        uploadId: validation.uploadId,
      });

      // Polling de progresso
      pollingRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(
            `/api/barrels/import/progress/${validation.uploadId}`,
          );
          setProgress(data);
          if (data.status === "completed" || data.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setStep("done");
          }
        } catch {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }, 1000);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Erro ao iniciar importação",
      );
      setStep("validation");
    }
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setValidation(null);
    setProgress(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/barrels">
          <Button variant="outline" size="sm" className="border-border text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Importar Barris
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe barris em massa via planilha Excel ou CSV
          </p>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <Card className="border-border bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground">
                  Baixe o template, preencha com os dados dos barris e faça o
                  upload.
                </p>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="border-border text-foreground"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Template
                </Button>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium">
                  {file
                    ? file.name
                    : "Arraste o arquivo ou clique para selecionar"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos aceitos: .xlsx, .xls, .csv
                </p>
              </div>

              {file && (
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleUploadAndValidate}
                    disabled={uploading}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                  >
                    {uploading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Validar Arquivo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Validation */}
      {step === "validation" && validation && (
        <div className="space-y-4">
          {/* Indicadores */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border bg-card/50">
              <CardContent className="pt-4 flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {validation.validRows}
                  </p>
                  <p className="text-xs text-muted-foreground">Válidos</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card/50">
              <CardContent className="pt-4 flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {validation.errorRows}
                  </p>
                  <p className="text-xs text-muted-foreground">Com erro</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card/50">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {validation.duplicateRows}
                  </p>
                  <p className="text-xs text-muted-foreground">Duplicados</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          {validation.preview.length > 0 && (
            <Card className="border-border bg-card/50 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-sm text-foreground">
                  Preview (primeiros {Math.min(validation.preview.length, 100)}{" "}
                  registros)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          QR Code
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Fabricante
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Capacidade
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Material
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.preview.slice(0, 10).map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/50"
                        >
                          <td className="px-3 py-2 text-foreground font-mono">
                            {row.qrCode}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {row.manufacturer || "-"}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {row.capacityLiters}L
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {row.material || "INOX_304"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Erros */}
          {validation.errors.length > 0 && (
            <Card className="border-border bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm text-red-400">
                  Erros ({validation.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {validation.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-400">
                      {err.row > 0 ? `Linha ${err.row}: ` : ""}
                      {err.message}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-border text-foreground"
            >
              Voltar
            </Button>
            {validation.validRows > 0 && (
              <Button
                onClick={handleExecuteImport}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Importar {validation.validRows} barris válidos
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === "importing" && (
        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 text-amber-400 animate-spin mx-auto" />
              <p className="text-foreground font-medium">
                Importando barris...
              </p>
              {progress && (
                <div className="space-y-2">
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-orange-600 h-3 rounded-full transition-all"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {progress.processed} de {progress.total} (
                    {progress.percentage}%)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === "done" && progress && (
        <Card className="border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto" />
              <p className="text-xl font-bold text-foreground">
                Importação concluída
              </p>
              <div className="flex justify-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-green-400">
                    {progress.processed}
                  </p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                {progress.failed > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-red-400">
                      {progress.failed}
                    </p>
                    <p className="text-xs text-muted-foreground">Falharam</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-border text-foreground"
                >
                  Nova importação
                </Button>
                <Link href="/barrels">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                    Ver barris
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
