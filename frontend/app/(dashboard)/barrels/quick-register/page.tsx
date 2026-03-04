"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrScanner, playSuccessBeep, playErrorBeep } from "@/components/qr-scanner";
import { ArrowLeft, QrCode, Check, X } from "lucide-react";
import { toast } from "sonner";

interface RegisteredBarrel {
  id: string;
  internalCode: string;
  qrCode: string;
  status: "success" | "error";
  message?: string;
}

const defaultTemplate = {
  manufacturer: "",
  valveModel: "TYPE_S",
  capacityLiters: "50",
  tareWeightKg: "13.2",
  material: "INOX_304",
  acquisitionCost: "800",
};

export default function QuickRegisterPage() {
  const [template, setTemplate] = useState(defaultTemplate);
  const [scanning, setScanning] = useState(false);
  const [registered, setRegistered] = useState<RegisteredBarrel[]>([]);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);

  const successCount = registered.filter((r) => r.status === "success").length;

  const handleScan = useCallback(
    async (qrCode: string) => {
      // Verificar se já foi escaneado nesta sessão
      if (registered.some((r) => r.qrCode === qrCode && r.status === "success")) {
        playErrorBeep();
        setFlash("error");
        setTimeout(() => setFlash(null), 500);
        toast.error(`QR code já registrado nesta sessão: ${qrCode}`);
        return;
      }

      try {
        const { data } = await api.post("/api/barrels/quick-register", {
          qrCode,
          manufacturer: template.manufacturer || undefined,
          valveModel: template.valveModel,
          capacityLiters: Number(template.capacityLiters),
          tareWeightKg: Number(template.tareWeightKg),
          material: template.material,
          acquisitionCost: Number(template.acquisitionCost),
        });

        playSuccessBeep();
        setFlash("success");
        setTimeout(() => setFlash(null), 500);
        setRegistered((prev) => [
          {
            id: data.id,
            internalCode: data.internalCode,
            qrCode,
            status: "success",
          },
          ...prev,
        ]);
      } catch (error: any) {
        playErrorBeep();
        setFlash("error");
        setTimeout(() => setFlash(null), 500);
        const msg =
          error.response?.data?.message || "Erro ao cadastrar barril";
        toast.error(msg);
        setRegistered((prev) => [
          {
            id: "",
            internalCode: "",
            qrCode,
            status: "error",
            message: msg,
          },
          ...prev,
        ]);
      }
    },
    [template, registered],
  );

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
            Cadastro Rápido
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina o template e escaneie QR codes em sequência
          </p>
        </div>
      </div>

      {!scanning ? (
        /* Etapa 1: Template */
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-foreground">
              Template do Barril
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Fabricante</Label>
                <Input
                  value={template.manufacturer}
                  onChange={(e) =>
                    setTemplate({ ...template, manufacturer: e.target.value })
                  }
                  placeholder="Ex: Franke, Portinox"
                  className="border-border bg-muted/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Modelo Válvula</Label>
                <Select
                  value={template.valveModel}
                  onValueChange={(v) =>
                    setTemplate({ ...template, valveModel: v })
                  }
                >
                  <SelectTrigger className="border-border bg-muted/50 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="TYPE_S">Type S (Europeu)</SelectItem>
                    <SelectItem value="TYPE_D">Type D (Alemão)</SelectItem>
                    <SelectItem value="TYPE_A">Type A (Americano)</SelectItem>
                    <SelectItem value="TYPE_G">Type G (Gás)</SelectItem>
                    <SelectItem value="TYPE_M">Type M (Misto)</SelectItem>
                    <SelectItem value="OTHER">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Capacidade (L)</Label>
                <Input
                  type="number"
                  value={template.capacityLiters}
                  onChange={(e) =>
                    setTemplate({ ...template, capacityLiters: e.target.value })
                  }
                  className="border-border bg-muted/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Peso Tara (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={template.tareWeightKg}
                  onChange={(e) =>
                    setTemplate({ ...template, tareWeightKg: e.target.value })
                  }
                  className="border-border bg-muted/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Material</Label>
                <Select
                  value={template.material}
                  onValueChange={(v) =>
                    setTemplate({ ...template, material: v })
                  }
                >
                  <SelectTrigger className="border-border bg-muted/50 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="INOX_304">Inox 304</SelectItem>
                    <SelectItem value="INOX_316">Inox 316</SelectItem>
                    <SelectItem value="PET_SLIM">PET Slim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Custo Aquisição (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={template.acquisitionCost}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      acquisitionCost: e.target.value,
                    })
                  }
                  className="border-border bg-muted/50 text-foreground"
                />
              </div>
            </div>
            <div className="mt-6">
              <Button
                onClick={() => setScanning(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
              >
                <QrCode className="mr-2 h-4 w-4" />
                Iniciar Cadastro
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Etapa 2: Scan contínuo */
        <div className="space-y-4">
          {/* Contador */}
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-lg px-4 py-2 border-amber-500/30 text-amber-400"
            >
              {successCount} barris cadastrados
            </Badge>
            <Button
              variant="outline"
              onClick={() => setScanning(false)}
              className="border-border text-foreground"
            >
              Finalizar
            </Button>
          </div>

          {/* Scanner com flash de feedback */}
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
              active={scanning}
              cooldownMs={2000}
            />
          </div>

          {/* Lista de registros */}
          {registered.length > 0 && (
            <Card className="border-border bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm text-foreground">
                  Registros desta sessão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {registered.map((barrel, i) => (
                    <div
                      key={`${barrel.qrCode}-${i}`}
                      className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {barrel.status === "success" ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <X className="h-4 w-4 text-red-400" />
                        )}
                        <span className="text-sm font-mono text-foreground">
                          {barrel.status === "success"
                            ? barrel.internalCode
                            : barrel.qrCode}
                        </span>
                      </div>
                      {barrel.status === "error" && (
                        <span className="text-xs text-red-400">
                          {barrel.message}
                        </span>
                      )}
                      {barrel.status === "success" && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-green-500/10 text-green-400 border-green-500/20"
                        >
                          Criado ✓
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
