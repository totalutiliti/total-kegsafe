import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';

const COOKIE_OPTIONS_BASE = {
    httpOnly: true,
    sameSite: 'strict' as const,
};

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: ConfigService,
    ) { }

    private isProduction(): boolean {
        return this.config.get('NODE_ENV') === 'production';
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
        const ipAddress = req.ip;
        const userAgent = req.headers?.['user-agent'];
        const result = await this.authService.login(dto.email, dto.password, ipAddress, userAgent);

        // Set httpOnly cookies instead of returning tokens in the body
        res.cookie('accessToken', result.accessToken, {
            ...COOKIE_OPTIONS_BASE,
            secure: this.isProduction(),
            maxAge: 15 * 60 * 1000, // 15 min
            path: '/',
        });
        res.cookie('refreshToken', result.refreshToken, {
            ...COOKIE_OPTIONS_BASE,
            secure: this.isProduction(),
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/api/auth',
        });

        return {
            user: result.user,
            expiresIn: result.expiresIn,
        };
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60000, limit: 10 } })
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        // Read refresh token from cookie (fallback to body for API clients)
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'No refresh token provided' });
        }
        const result = await this.authService.refresh(refreshToken);

        res.cookie('accessToken', result.accessToken, {
            ...COOKIE_OPTIONS_BASE,
            secure: this.isProduction(),
            maxAge: 15 * 60 * 1000,
            path: '/',
        });
        res.cookie('refreshToken', result.refreshToken, {
            ...COOKIE_OPTIONS_BASE,
            secure: this.isProduction(),
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/api/auth',
        });

        return { expiresIn: result.expiresIn };
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        // Revoke refresh token server-side
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (refreshToken) {
            await this.authService.logout(refreshToken);
        }

        // Clear httpOnly cookies
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/api/auth' });

        return { message: 'Logged out successfully' };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async me(@CurrentUser() user: any) {
        return user;
    }
}
