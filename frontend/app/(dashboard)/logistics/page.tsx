'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Package, ArrowDown, ArrowUp, RotateCw, Factory } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';

export default function LogisticsPage() {
    return (
        <RoleGuard allowedRoles={['ADMIN', 'LOGISTICS']}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Logística</h1>
                    <p className="text-sm text-muted-foreground mt-1">Controle os 4 inputs de movimentação dos barris</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[
                        { title: 'Expedição', desc: 'Saída da fábrica → Em trânsito', icon: ArrowUp, color: 'from-blue-500 to-blue-600', action: 'ACTIVE → IN_TRANSIT' },
                        { title: 'Entrega', desc: 'Entrega no cliente (PDV)', icon: Package, color: 'from-purple-500 to-purple-600', action: 'IN_TRANSIT → AT_CLIENT' },
                        { title: 'Coleta', desc: 'Retirada no cliente', icon: ArrowDown, color: 'from-amber-500 to-orange-600', action: 'AT_CLIENT → IN_TRANSIT' },
                        { title: 'Recebimento', desc: 'Retorno à fábrica + ciclo', icon: Factory, color: 'from-green-500 to-green-600', action: 'IN_TRANSIT → ACTIVE' },
                    ].map((input, i) => (
                        <Card key={i} className="border-border bg-card/50 hover:border-accent transition-all cursor-pointer group">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${input.color} shadow-lg group-hover:scale-105 transition-transform`}>
                                        <input.icon className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">{input.title}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">{input.desc}</p>
                                        <p className="text-xs text-muted-foreground mt-2 font-mono">{input.action}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="border-border bg-card/50">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Truck className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-center">As operações logísticas são realizadas através do app mobile.<br />
                            <span className="text-muted-foreground text-sm">Escaneie o QR Code do barril para iniciar uma operação.</span>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </RoleGuard>
    );
}
