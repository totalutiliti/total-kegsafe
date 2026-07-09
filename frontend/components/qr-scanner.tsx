"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { playSuccess, playError } from "@/lib/sounds";

// Re-export para compatibilidade com imports existentes
export { playSuccess as playSuccessBeep, playError as playErrorBeep } from "@/lib/sounds";

interface QrScannerProps {
  onScan: (qrCode: string) => void;
  onError?: (error: string) => void;
  active?: boolean;
  cooldownMs?: number;
}

export function QrScanner({
  onScan,
  onError,
  active = true,
  cooldownMs = 1500,
}: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const cooldownRef = useRef(false);
  const mountedRef = useRef(true);

  const handleScan = useCallback(
    (decodedText: string) => {
      if (cooldownRef.current) return;
      cooldownRef.current = true;
      onScan(decodedText);
      setTimeout(() => {
        cooldownRef.current = false;
      }, cooldownMs);
    },
    [onScan, cooldownMs],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const elementId = containerRef.current.id;
    if (!elementId) return;

    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            handleScan(decodedText);
          },
          () => {
            // Scan error silenciado (normal quando não há QR na frente da câmera)
          },
        );
        if (mountedRef.current) setIsRunning(true);
      } catch (err: any) {
        onError?.(err?.message || "Erro ao iniciar câmera");
      }
    };

    const stopScanner = async () => {
      if (scanner) {
        try {
          await scanner.stop();
        } catch {
          // Ignorar erros no stop
        }
        try {
          scanner.clear();
        } catch {
          // Ignorar erros no clear
        }
        scannerRef.current = null;
        if (mountedRef.current) setIsRunning(false);
      }
    };

    if (active) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [active, handleScan, onError]);

  return (
    <div className="relative">
      <div
        id="qr-scanner-container"
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-border bg-black"
        style={{ minHeight: 300 }}
      />
      {!isRunning && active && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Iniciando câmera...
          </p>
        </div>
      )}
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
          <p className="text-sm text-muted-foreground">Scanner pausado</p>
        </div>
      )}
    </div>
  );
}
