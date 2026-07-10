'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Beer, Snowflake, Zap, Package, Phone } from 'lucide-react';
import { DRAFT_MACHINES, BARREL_SIZES } from '@/lib/germania-catalog';

export default function CatalogoPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                        <Beer className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Catálogo Germânia</h1>
                        <p className="text-sm text-muted-foreground">
                            Barris e chopeiras da Cervejaria Germânia
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="border-border bg-card/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{BARREL_SIZES.length}</p>
                        <p className="text-[11px] text-muted-foreground">Capacidades de Barril</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{DRAFT_MACHINES.length}</p>
                        <p className="text-[11px] text-muted-foreground">Linhas de Chopeira</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card/50">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <div className="flex items-center gap-1.5 text-amber-400">
                            <Phone className="h-4 w-4" />
                            <p className="text-sm font-bold">0800 110 0420</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Lig Chopp Germânia</p>
                    </CardContent>
                </Card>
            </div>

            {/* Barris disponíveis */}
            <Card className="border-border bg-card/50">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Package className="h-4 w-4 text-amber-400" /> Barris de chopp
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {BARREL_SIZES.map((s) => (
                                <span
                                    key={s}
                                    className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400"
                                >
                                    {s}
                                </span>
                            ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                            Barril de 50L equivale a 140+ latas/garrafas.
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Chopeiras */}
            <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" /> Chopeiras &amp; Equipamentos
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {DRAFT_MACHINES.map((m) => {
                        const isIce = m.type.toLowerCase().includes('gelo');
                        return (
                            <Card key={m.name} className="border-border bg-card/50 hover:bg-muted/30 transition-colors h-full">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                                                {isIce ? (
                                                    <Snowflake className="h-4 w-4 text-blue-400" />
                                                ) : (
                                                    <Zap className="h-4 w-4 text-amber-400" />
                                                )}
                                            </div>
                                            <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                                        </div>
                                        <span className="text-xs font-bold text-amber-400 shrink-0">{m.price}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs mb-3">
                                        <div>
                                            <span className="text-muted-foreground">Tipo: </span>
                                            <span className="text-foreground">{m.type}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Torneiras: </span>
                                            <span className="text-foreground">{m.taps}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Vazão: </span>
                                            <span className="text-foreground">{m.flow}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Energia: </span>
                                            <span className="text-foreground">{m.voltage}</span>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-muted/30 px-2.5 py-1.5 mb-2">
                                        <p className="text-[11px] text-amber-400/90">Indicado para: {m.bestFor}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{m.note}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
                Fonte: cervejariagermania.com.br • Lig Chopp Germânia • Disponibilidade e preços podem variar por unidade.
            </p>
        </div>
    );
}
