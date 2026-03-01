import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const secret = config.get<string>('JWT_SECRET');
                if (!secret) throw new Error('JWT_SECRET is required. Set it in your .env file.');
                return {
                    secret,
                    signOptions: { expiresIn: 900 }, // 15 minutes in seconds
                };
            },
        }),
    ],
    providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
    controllers: [AuthController],
    exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule { }
