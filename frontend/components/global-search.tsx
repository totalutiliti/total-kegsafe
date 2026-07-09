'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Package,
  Building2,
  MapPin,
  LayoutDashboard,
  Truck,
  Wrench,
  BarChart3,
  AlertTriangle,
  Trash2,
  Clock,
} from 'lucide-react';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  type: 'barrel' | 'client' | 'geofence';
}

const quickNav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Barris', href: '/barrels', icon: Package },
  { label: 'Logística', href: '/logistics', icon: Truck },
  { label: 'Manutenção', href: '/maintenance', icon: Wrench },
  { label: 'Clientes', href: '/clients', icon: Building2 },
  { label: 'Geofences', href: '/geofences', icon: MapPin },
  { label: 'Relatórios', href: '/reports', icon: BarChart3 },
  { label: 'Alertas', href: '/alerts', icon: AlertTriangle },
  { label: 'Descarte', href: '/disposal', icon: Trash2 },
];

const typeIcons = {
  barrel: Package,
  client: Building2,
  geofence: MapPin,
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent items from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kegsafe-recent-search');
      if (stored) setRecentItems(JSON.parse(stored));
    } catch {}
  }, [open]);

  // Ctrl+K / Cmd+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search with debounce
  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [barrelsRes, clientsRes, geofencesRes] = await Promise.allSettled([
        api.get('/barrels', { params: { search: term, limit: 5 } }),
        api.get('/clients', { params: { search: term, limit: 5 } }),
        api.get('/geofences', { params: { search: term, limit: 5 } }),
      ]);

      const items: SearchResult[] = [];

      if (barrelsRes.status === 'fulfilled') {
        (barrelsRes.value.data.items || []).forEach((b: any) => {
          items.push({
            id: b.id,
            label: b.internalCode || b.qrCode,
            sublabel: `${b.capacityLiters}L • ${b.status}`,
            href: `/barrels/${b.id}`,
            type: 'barrel',
          });
        });
      }

      if (clientsRes.status === 'fulfilled') {
        (clientsRes.value.data.items || []).forEach((c: any) => {
          items.push({
            id: c.id,
            label: c.tradeName || c.name,
            sublabel: c.cnpj,
            href: `/clients`,
            type: 'client',
          });
        });
      }

      if (geofencesRes.status === 'fulfilled') {
        (geofencesRes.value.data.items || []).forEach((g: any) => {
          items.push({
            id: g.id,
            label: g.name,
            sublabel: `${g.type} • ${g.radiusMeters}m`,
            href: `/geofences`,
            type: 'geofence',
          });
        });
      }

      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleSelect = (item: SearchResult | { href: string; label: string; id?: string }) => {
    // Save to recent
    if ('type' in item) {
      const recent = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, 10);
      setRecentItems(recent);
      localStorage.setItem('kegsafe-recent-search', JSON.stringify(recent));
    }
    setOpen(false);
    setQuery('');
    setResults([]);
    router.push(item.href);
  };

  const barrelResults = results.filter((r) => r.type === 'barrel');
  const clientResults = results.filter((r) => r.type === 'client');
  const geofenceResults = results.filter((r) => r.type === 'geofence');

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setQuery(''); setResults([]); }
      }}
      title="Busca Global"
      description="Busque barris, clientes, geofences ou navegue rapidamente"
    >
      <CommandInput
        placeholder="Buscar barris, clientes, geofences..."
        value={query}
        onValueChange={handleQueryChange}
      />
      <CommandList>
        {loading && (
          <div className="py-4 text-center text-sm text-muted-foreground">Buscando...</div>
        )}

        {!loading && query && results.length === 0 && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}

        {barrelResults.length > 0 && (
          <CommandGroup heading="Barris">
            {barrelResults.map((item) => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="cursor-pointer">
                <Package className="mr-2 h-4 w-4 text-amber-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{item.label}</span>
                  {item.sublabel && <span className="ml-2 text-xs text-muted-foreground">{item.sublabel}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {clientResults.length > 0 && (
          <CommandGroup heading="Clientes">
            {clientResults.map((item) => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="cursor-pointer">
                <Building2 className="mr-2 h-4 w-4 text-purple-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{item.label}</span>
                  {item.sublabel && <span className="ml-2 text-xs text-muted-foreground">{item.sublabel}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {geofenceResults.length > 0 && (
          <CommandGroup heading="Geofences">
            {geofenceResults.map((item) => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="cursor-pointer">
                <MapPin className="mr-2 h-4 w-4 text-red-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{item.label}</span>
                  {item.sublabel && <span className="ml-2 text-xs text-muted-foreground">{item.sublabel}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query && recentItems.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recentItems.map((item) => {
                const Icon = typeIcons[item.type] || Package;
                return (
                  <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="cursor-pointer">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{item.label}</span>
                      {item.sublabel && <span className="ml-2 text-xs text-muted-foreground">{item.sublabel}</span>}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {!query && (
          <CommandGroup heading="Navegação Rápida">
            {quickNav.map((nav) => (
              <CommandItem key={nav.href} onSelect={() => handleSelect(nav)} className="cursor-pointer">
                <nav.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{nav.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
