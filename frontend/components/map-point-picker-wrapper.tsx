import dynamic from 'next/dynamic';

const MapPointPicker = dynamic(() => import('./map-point-picker'), {
    ssr: false,
    loading: () => (
        <div className="h-[250px] w-full rounded-lg border border-border bg-muted/50 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Carregando mapa...</p>
        </div>
    ),
});

export { MapPointPicker };
