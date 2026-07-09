'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Truck, Wrench, BarChart3, MapPin } from 'lucide-react';

const features = [
  {
    icon: Package,
    title: 'Gestão de Barris',
    description: 'Cadastre, rastreie e gerencie todo o ciclo de vida dos seus barris com QR codes.',
    color: 'text-amber-400 bg-amber-500/10',
  },
  {
    icon: Truck,
    title: 'Logística',
    description: 'Controle expedições, entregas, coletas e recepções em tempo real.',
    color: 'text-blue-400 bg-blue-500/10',
  },
  {
    icon: Wrench,
    title: 'Manutenção',
    description: 'Acompanhe a saúde dos componentes e agende manutenções preventivas.',
    color: 'text-green-400 bg-green-500/10',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    description: 'Visualize métricas de desempenho, ciclos e tendências operacionais.',
    color: 'text-purple-400 bg-purple-500/10',
  },
  {
    icon: MapPin,
    title: 'Geofences',
    description: 'Defina áreas geográficas para clientes e monitore a localização dos barris.',
    color: 'text-red-400 bg-red-500/10',
  },
];

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('kegsafe-onboarding-seen');
    if (!seen) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('kegsafe-onboarding-seen', 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            Bem-vindo ao KegSafe!
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Sua plataforma completa para gestão de barris. Conheça as principais funcionalidades:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${feature.color}`}>
                <feature.icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={handleDismiss}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white"
          >
            Começar a usar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
