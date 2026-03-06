'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '@/lib/theme-provider';

const TILES = {
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    },
    light: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    },
};

const typeColors: Record<string, { color: string; label: string }> = {
    FACTORY: { color: '#F97316', label: 'Fábrica' },
    CLIENT: { color: '#A855F7', label: 'Cliente' },
    RESTRICTED: { color: '#EF4444', label: 'Zona Restrita' },
};

interface GeofenceMapProps {
    geofences: any[];
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
