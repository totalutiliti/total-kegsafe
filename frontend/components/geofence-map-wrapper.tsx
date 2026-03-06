import dynamic from 'next/dynamic';

const GeofenceMap = dynamic(() => import('./geofence-map'), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full rounded-lg border border-border bg-muted/50 flex items-center justify-center">
            <p className="text-muted-foreground">Carregando mapa...</p>
        </div>
    ),
});

export { GeofenceMap };
