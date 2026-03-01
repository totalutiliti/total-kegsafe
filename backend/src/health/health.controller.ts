import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('api/health')
@SkipThrottle()
export class HealthController {
    constructor(private readonly prisma: PrismaService) { }

    @Public()
    @Get()
    async check(@Res() res: Response) {
        try {
            await this.prisma.$queryRawUnsafe('SELECT 1');
            return res.status(HttpStatus.OK).json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: 'connected',
                version: '1.0.0',
            });
        } catch {
            return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                database: 'disconnected',
            });
        }
    }
}
