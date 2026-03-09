'use client';

import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

// Fix default marker icon
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

interface MapPointPickerProps {
    latitude: number | null;
    longitude: number | null;
    radius?: number;
    onChange: (lat: number, lng: number) => void;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onChange(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function RecenterMap({ lat, lng }: { lat: number | null; lng: number | null }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.setView([lat, lng], map.getZoom());
        }
    }, [lat, lng, map]);
    return null;
}

export default function MapPointPicker({ latitude, longitude, radius = 500, onChange }: MapPointPickerProps) {
    const center: [number, number] = latitude && longitude
        ? [latitude, longitude]
        : [-23.5505, -46.6333]; // Default: São Paulo

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Clique no mapa para selecionar o ponto</p>
            <div className="h-[250px] w-full rounded-lg border border-border overflow-hidden">
                <MapContainer
                    center={center}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ClickHandler onChange={onChange} />
                    <RecenterMap lat={latitude} lng={longitude} />
                    {latitude && longitude && (
                        <>
                            <Marker position={[latitude, longitude]} icon={defaultIcon} />
                            <Circle
                                center={[latitude, longitude]}
                                radius={radius}
                                pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.1 }}
                            />
                        </>
                    )}
                </MapContainer>
            </div>
        </div>
    );
}
