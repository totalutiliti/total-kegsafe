'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuthStore();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(email, password);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Credenciais inválidas');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Panel — Branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-12">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                        <Package className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white">KegSafe Tech</span>
                </div>

                <div className="space-y-6">
                    <h2 className="text-4xl font-bold leading-tight text-white">
                        Gestão inteligente<br />
                        <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                            dos seus barris
                        </span>
                    </h2>
                    <p className="max-w-md text-lg text-zinc-400">
                        Rastreamento logístico, manutenção preditiva e controle total de ativos em uma única plataforma.
                    </p>
                    <div className="flex gap-8 pt-4">
                        <div>
                            <p className="text-3xl font-bold text-amber-500">99.2%</p>
                            <p className="text-sm text-zinc-500">Taxa de rastreamento</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-amber-500">-35%</p>
                            <p className="text-sm text-zinc-500">Custos de manutenção</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-amber-500">+48%</p>
                            <p className="text-sm text-zinc-500">Giro de ativos</p>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-zinc-600">© 2026 KegSafe Tech. Todos os direitos reservados.</p>
            </div>

            {/* Right Panel — Login Form */}
            <div className="flex w-full lg:w-1/2 items-center justify-center bg-zinc-950 p-8">
                <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 shadow-2xl backdrop-blur">
                    <CardHeader className="space-y-1 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20 lg:hidden">
                            <Package className="h-7 w-7 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-white"><h1>Bem-vindo de volta</h1></CardTitle>
                        <CardDescription className="text-zinc-400">Entre com suas credenciais para acessar o sistema</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-zinc-300">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:ring-amber-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-zinc-300">Senha</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="border-zinc-700 bg-zinc-800/50 pr-10 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:ring-amber-500/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold text-white shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 transition-all duration-300"
                            >
                                {isLoading ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    'Entrar'
                                )}
                            </Button>
                            <div className="mt-4 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 space-y-1">
                                <p className="text-[11px] font-medium text-zinc-400 mb-1.5">Credenciais de teste:</p>
                                <p className="text-[11px] text-zinc-500">Admin: admin@petropolis.com.br / Admin@123</p>
                                <p className="text-[11px] text-zinc-500">Gestor: gestor@petropolis.com.br / Gestor@123</p>
                                <p className="text-[11px] text-zinc-500">Logística: logistica@petropolis.com.br / Logistica@123</p>
                                <p className="text-[11px] text-zinc-500">Manutenção: manutencao@petropolis.com.br / Manutencao@123</p>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
