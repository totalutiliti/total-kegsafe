import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { ReactQueryProvider } from "@/lib/query-provider";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegister } from "@/components/sw-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KegSafe Tech — Gestão de Barris",
  description: "Plataforma SaaS para gestão de ativos cervejeiros. Rastreamento logístico e manutenção preditiva.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KegSafe",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body suppressHydrationWarning className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <ReactQueryProvider>
            <TooltipProvider delayDuration={300}>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'bg-card border-border text-foreground',
              }}
            />
            </TooltipProvider>
          </ReactQueryProvider>
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
