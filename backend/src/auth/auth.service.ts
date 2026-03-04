import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
    InvalidCredentialsException,
    TokenExpiredException,
    AccountDisabledException,
    AccountLockedException,
} from '../shared/exceptions/auth.exceptions.js';
import { HashingService } from '../shared/services/hashing.service.js';

export interface JwtPayload {
    sub: string;       // userId
    tenantId: string;
    role: string;
    email: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly hashingService: HashingService,
    ) { }

    async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
        // Buscar usuário pelo email (sem filtro de tenant no login)
        const user = await this.prisma.user.findFirst({
            where: { email, deletedAt: null },
            include: { tenant: true },
        });

        if (!user) {
            throw new InvalidCredentialsException();
        }

        // Verificar se conta está bloqueada
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new AccountLockedException(user.lockedUntil);
        }

        // Verificar se usuário está ativo
        if (!user.isActive) {
            throw new AccountDisabledException();
        }

        // Verificar se tenant está ativo
        if (!user.tenant.isActive) {
            throw new AccountDisabledException();
        }

        // Validar senha (com migração lazy de bcrypt → Argon2id)
        const isBcrypt = user.passwordHash.startsWith('$2b$') || user.passwordHash.startsWith('$2a$');
        let isPasswordValid: boolean;

        if (isBcrypt) {
            // Hash legado (bcrypt) — verificar sem pepper
            isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        } else {
            // Hash moderno (Argon2id + pepper)
            isPasswordValid = await this.hashingService.verify(user.passwordHash, password);
        }

        if (!isPasswordValid) {
            // Incrementar tentativas falhas
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: { increment: 1 },
                    lockedUntil: user.failedLoginAttempts >= 4
                        ? new Date(Date.now() + 15 * 60 * 1000)
                        : null,
                },
            });
            throw new InvalidCredentialsException();
        }

        // Migração lazy: re-hash com Argon2id + Pepper se ainda era bcrypt
        if (isBcrypt) {
            const newHash = await this.hashingService.hash(password);
            await this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: newHash },
            });
        }

        // Reset tentativas falhas e atualizar último login
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
            },
        });

        // Gerar tokens
        const payload: JwtPayload = {
            sub: user.id,
            tenantId: user.tenantId,
            role: user.role,
            email: user.email,
        };

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = await this.createRefreshToken(user.id, ipAddress, userAgent);

        return {
            accessToken,
            refreshToken,
            expiresIn: this.config.get<string>('JWT_EXPIRATION', '15m'),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                tenantName: user.tenant.name,
            },
        };
    }

    async refresh(refreshToken: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token: tokenHash },
        });

        if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
            throw new TokenExpiredException();
        }

        const user = await this.prisma.user.findUnique({
            where: { id: storedToken.userId },
            include: { tenant: true },
        });

        if (!user || !user.isActive || !user.tenant.isActive) {
            throw new AccountDisabledException();
        }

        // Revogar token antigo
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { revoked: true },
        });

        // Gerar novos tokens
        const payload: JwtPayload = {
            sub: user.id,
            tenantId: user.tenantId,
            role: user.role,
            email: user.email,
        };

        const newAccessToken = this.jwtService.sign(payload);
        const newRefreshToken = await this.createRefreshToken(
            user.id,
            storedToken.ipAddress || undefined,
            storedToken.userAgent || undefined
        );

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: this.config.get<string>('JWT_EXPIRATION', '15m'),
        };
    }

    async logout(refreshToken: string) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        await this.prisma.refreshToken.updateMany({
            where: { token: tokenHash },
            data: { revoked: true },
        });

        return { message: 'Logged out successfully' };
    }

    private async createRefreshToken(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
        const token = crypto.randomBytes(64).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.refreshToken.create({
            data: {
                userId,
                token: tokenHash,
                expiresAt,
                ipAddress,
                userAgent,
            },
        });

        return token;
    }
}
