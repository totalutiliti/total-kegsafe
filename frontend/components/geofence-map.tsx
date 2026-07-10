'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '@/lib/theme-provider';

// Tiles do OpenStreetMap: provedor mais universal e o menos sujeito a bloqueio
// por ad-blockers/extensões de privacidade (o CARTO costuma estar em listas de
// rastreadores → tiles cinza no navegador do cliente). Mesma fonte do seletor de ponto.
const OSM_TILE = {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};
const TILES = {
    dark: OSM_TILE,
    light: OSM_TILE,
};

const typeColors: Record<string, { color: string; label: string }> = {
    FACTORY: { color: '#F97316', label: 'Fábrica' },
    CLIENT: { color: '#A855F7', label: 'Cliente' },
    RESTRICTED: { color: '#EF4444', label: 'Zona Restrita' },
};

interface GeofenceMapProps {
    geofences: any[];
}

/**
 * Corrige o bug clássico de "tiles cinza" do Leaflet: quando o container ganha
 * altura DEPOIS do mapa inicializar (troca de aba grade↔mapa, layout tardio),
 * o Leaflet calcula "zero tiles" e não recarrega. Aqui forçamos invalidateSize()
 * no mount e sempre que o container for redimensionado.
 */
function InvalidateSize() {
    const map = useMap();
    useEffect(() => {
        const invalidate = () => map.invalidateSize();
        const t = setTimeout(invalidate, 150);
        const ro = new ResizeObserver(invalidate);
        ro.observe(map.getContainer());
        window.addEventListener('resize', invalidate);
        return () => {
            clearTimeout(t);
            ro.disconnect();
            window.removeEventListener('resize', invalidate);
        };
    }, [map]);
    return null;
}

function FitBounds({ geofences }: { geofences: any[] }) {
    const map = useMap();
    const fitted = useRef(false);

    useEffect(() => {
        if (geofences.length === 0 || fitted.current) return;
        const bounds = L.latLngBounds(
            geofences.map((g) => [Number(g.latitude), Number(g.longitude)] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        fitted.current = true;
    }, [geofences, map]);

    useEffect(() => {
        fitted.current = false;
    }, [geofences.length]);

    return null;
}

export default function GeofenceMap({ geofences }: GeofenceMapProps) {
    const defaultCenter: [number, number] = [-22.9, -43.2];
    const { theme } = useTheme();
    const tile = TILES[theme] || TILES.dark;

    return (
        <MapContainer
            center={defaultCenter}
            zoom={8}
            className="h-[calc(100vh-12rem)] w-full rounded-lg border border-border z-0"
            scrollWheelZoom
        >
            <TileLayer
                key={theme}
                attribution={tile.attribution}
                url={tile.url}
            />
            <InvalidateSize />
            <FitBounds geofences={geofences} />
            {geofences.map((geo) => {
                const tc = typeColors[geo.type] || typeColors.CLIENT;
                const isRestricted = geo.type === 'RESTRICTED';
                const center: [number, number] = [Number(geo.latitude), Number(geo.longitude)];
                return (
                    <span key={geo.id}>
                        {/* Círculo real em metros (visível ao dar zoom) */}
                        <Circle
                            center={center}
                            radius={geo.radiusMeters}
                            pathOptions={{
                                color: tc.color,
                                fillColor: tc.color,
                                fillOpacity: 0.15,
                                opacity: 0.6,
                                weight: 2,
                                ...(isRestricted ? { dashArray: '8 4' } : {}),
                            }}
                        />
                        {/* Marcador fixo em pixels (sempre visível em qualquer zoom) */}
                        <CircleMarker
                            center={center}
                            radius={10}
                            pathOptions={{
                                color: tc.color,
                                fillColor: tc.color,
                                fillOpacity: 0.9,
                                opacity: 1,
                                weight: 2,
                            }}
                        >
                            <Tooltip direction="top" offset={[0, -10]} className="geofence-tooltip">
                                <span style={{ fontWeight: 600 }}>{geo.name}</span>
                            </Tooltip>
                            <Popup>
                                <div style={{ minWidth: 160, fontSize: 13 }}>
                                    <p style={{ fontWeight: 600, margin: 0 }}>{geo.name}</p>
                                    <p style={{ color: tc.color, fontSize: 11, margin: '4px 0 0' }}>{tc.label}</p>
                                    <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>Raio: {geo.radiusMeters}m</p>
                                    <p style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', margin: '2px 0 0' }}>
                                        {Number(geo.latitude).toFixed(4)}, {Number(geo.longitude).toFixed(4)}
                                    </p>
                                    {geo.client && (
                                        <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>Cliente: {geo.client.name}</p>
                                    )}
                                </div>
                            </Popup>
                        </CircleMarker>
                    </span>
                );
            })}
        </MapContainer>
    );
}
