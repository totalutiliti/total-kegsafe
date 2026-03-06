'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Package, ArrowDown, ArrowUp, Factory, QrCode, MapPin, RefreshCw, History } from 'lucide-react';
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
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg mb-4">
                                <Smartphone className="h-8 w-8 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Operações via App Mobile</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-md">
                                As operações de movimentação de barris (expedição, coleta, entrega e recebimento) são realizadas exclusivamente pelo aplicativo mobile KegSafe.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-lg mx-auto mb-8">
                            {[
                                { icon: QrCode, text: 'Leitura de QR Code / NFC dos barris' },
                                { icon: MapPin, text: 'Registro de coleta e entrega com geolocalização' },
                                { icon: RefreshCw, text: 'Atualização de status em tempo real' },
                                { icon: History, text: 'Histórico de movimentações por barril' },
                            ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                                    <feature.icon className="h-4 w-4 text-amber-400 shrink-0" />
                                    <span className="text-sm text-muted-foreground">{feature.text}</span>
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            Para acesso ao aplicativo, entre em contato com o administrador do sistema.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </RoleGuard>
    );
}
