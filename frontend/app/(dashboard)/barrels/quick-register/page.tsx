"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrScanner, playSuccessBeep, playErrorBeep } from "@/components/qr-scanner";
import { ArrowLeft, Check, X, QrCode } from "lucide-react";
import { Breadcrumb } from '@/components/breadcrumb';
import { toast } from "sonner";

interface RegisteredBarrel {
  id: string;
  internalCode: string;
  qrCode: string;
  status: "success" | "error";
  message?: string;
  action?: "found" | "activated" | "created";
}

const actionLabels: Record<string, { label: string; color: string }> = {
  found: { label: "Encontrado", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  activated: { label: "Ativado", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  created: { label: "Criado", color: "bg-green-500/10 text-green-400 border-green-500/20" },
};

export default function QuickRegisterPage() {
  const [scanning, setScanning] = useState(true);
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
        toast.error(`QR code já escaneado nesta sessão: ${qrCode}`);
        return;
      }

      try {
        const { data } = await api.post("/barrels/scan", {
          code: qrCode,
        });

        const barrel = data.barrel;
        const action = data.action as "found" | "activated" | "created";

        playSuccessBeep();
        setFlash("success");
        setTimeout(() => setFlash(null), 500);

        const actionLabel = actionLabels[action]?.label ?? action;
        toast.success(`Barril ${actionLabel.toLowerCase()}: ${barrel.internalCode}`);

        setRegistered((prev) => [
          {
            id: barrel.id,
            internalCode: barrel.internalCode,
            qrCode,
            status: "success",
            action,
          },
          ...prev,
        ]);
      } catch (error: any) {
        playErrorBeep();
        setFlash("error");
        setTimeout(() => setFlash(null), 500);
        const msg =
          error.response?.data?.message || "Erro ao processar barril";
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
    [registered],
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Barris', href: '/barrels' },
        { label: 'Cadastro Rápido' },
      ]} />
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Scan de Barris
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escaneie QR codes para identificar ou cadastrar barris
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Contador */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className="text-lg px-4 py-2 border-amber-500/30 text-amber-400"
          >
            {successCount} barris processados
          </Badge>
          <Button
            variant="outline"
            onClick={() => setScanning((s) => !s)}
            className="border-border text-foreground"
          >
            <QrCode className="mr-2 h-4 w-4" />
            {scanning ? "Pausar" : "Retomar"}
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
                    {barrel.status === "success" && barrel.action && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${actionLabels[barrel.action]?.color ?? ""}`}
                      >
                        {actionLabels[barrel.action]?.label ?? barrel.action}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
