'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, ROLE_HOME } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/lib/toast-with-sound';

export default function ChangePasswordPage() {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuthStore();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (newPassword.length < 8) {
            setError('A nova senha deve ter pelo menos 8 caracteres');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/change-password', { oldPassword, newPassword });

            // Atualizar store para remover flag
            useAuthStore.setState((state) => ({
                user: state.user ? { ...state.user, mustChangePassword: false } : null,
            }));

            toast.success('Senha alterada com sucesso!');
            router.push(ROLE_HOME[user?.role || ''] || '/barrels');
        } catch (err: any) {
            const raw = err.response?.data?.message || '';
            const msg = raw === 'Invalid email or password'
                ? 'Senha atual incorreta'
                : raw || 'Erro ao alterar senha';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
            <Card className="w-full max-w-md border-border bg-card/50 shadow-2xl backdrop-blur">
                <CardHeader className="space-y-1 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                        <KeyRound className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-foreground">
                        <h1>Alterar Senha</h1>
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Sua senha precisa ser alterada antes de continuar
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="oldPassword" className="text-foreground">Senha atual</Label>
                            <div className="relative">
                                <Input
                                    id="oldPassword"
                                    type={showOld ? 'text' : 'password'}
                                    placeholder="Digite sua senha atual"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    required
                                    className="border-border bg-muted/50 pr-10 text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:ring-amber-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowOld(!showOld)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-foreground">Nova senha</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNew ? 'text' : 'password'}
                                    placeholder="Digite a nova senha (min. 8 caracteres)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="border-border bg-muted/50 pr-10 text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:ring-amber-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-foreground">Confirmar nova senha</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="Repita a nova senha"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                className="border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:ring-amber-500/20"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold text-white shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 transition-all duration-300"
                        >
                            {isLoading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                'Alterar Senha'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
