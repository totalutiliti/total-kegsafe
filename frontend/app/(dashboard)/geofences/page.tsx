'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map, Plus, Radio } from 'lucide-react';
import { CreateGeofenceDialog } from '@/components/dialogs/create-geofence-dialog';
import { RoleGuard } from '@/components/role-guard';
import { toast } from 'sonner';

const typeConfig: Record<string, { label: string; color: string }> = {
    FACTORY: { label: 'Fábrica', color: 'bg-blue-500/10 text-blue-400' },
    WAREHOUSE: { label: 'Armazém', color: 'bg-cyan-500/10 text-cyan-400' },
    CLIENT: { label: 'Cliente', color: 'bg-purple-500/10 text-purple-400' },
    RESTRICTED: { label: 'Restrita', color: 'bg-red-500/10 text-red-400' },
};

export default function GeofencesPage() {
    const [geofences, setGeofences] = useState<any[]>([]);

    useEffect(() => {
        fetchGeofences();
    }, []);

    const fetchGeofences = () => {
        api.get('/api/geofences').then(r => setGeofences(r.data)).catch(() => toast.error('Erro ao carregar geofences'));
    };

    return (
        <RoleGuard allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Geofences</h1>
                        <p className="text-sm text-zinc-400 mt-1">{geofences.length} zonas cadastradas</p>
                    </div>
                    <CreateGeofenceDialog onCreated={fetchGeofences} />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {geofences.map((geo) => {
                        const tc = typeConfig[geo.type] || typeConfig.CLIENT;
                        return (
                            <Card key={geo.id} className="border-zinc-800 bg-zinc-900/50">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-zinc-200 truncate">{geo.name}</h3>
                                        <Badge variant="outline" className={`text-[10px] ${tc.color}`}>{tc.label}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <Radio className="h-3 w-3" /> Raio: {geo.radiusMeters}m
                                    </div>
                                    <p className="text-xs text-zinc-600 mt-1 font-mono">
                                        {Number(geo.latitude).toFixed(4)}, {Number(geo.longitude).toFixed(4)}
                                    </p>
                                    {geo.client && <p className="text-xs text-zinc-500 mt-2">Cliente: {geo.client.name}</p>}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </RoleGuard>
    );
}
