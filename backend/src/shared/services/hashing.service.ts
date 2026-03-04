import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class HashingService {
    private readonly pepper: string;

    constructor(private readonly config: ConfigService) {
        const pepper = this.config.get<string>('PEPPER_SECRET');
        if (!pepper) {
            throw new Error('PEPPER_SECRET não configurado nas variáveis de ambiente');
        }
        this.pepper = pepper;
    }

    async hash(plaintext: string): Promise<string> {
        const peppered = plaintext + this.pepper;
        return argon2.hash(peppered, {
            type: argon2.argon2id,
            memoryCost: 65536,   // 64 MB por operação
            timeCost: 3,         // 3 iterações
            parallelism: 1,      // 1 thread (ajuste conforme CPU disponível)
        });
    }

    async verify(hash: string, plaintext: string): Promise<boolean> {
        const peppered = plaintext + this.pepper;
        return argon2.verify(hash, peppered);
    }
}
