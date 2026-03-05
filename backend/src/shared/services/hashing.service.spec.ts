import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HashingService } from './hashing.service';

describe('HashingService', () => {
  let service: HashingService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashingService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'PEPPER_SECRET')
                return 'test-pepper-secret-32-chars-minimum!!';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<HashingService>(HashingService);
  });

  it('deve gerar hash diferente para a mesma senha (salt aleatório)', async () => {
    const h1 = await service.hash('minha-senha');
    const h2 = await service.hash('minha-senha');
    expect(h1).not.toBe(h2);
  });

  it('deve verificar corretamente a senha original', async () => {
    const hash = await service.hash('minha-senha');
    expect(await service.verify(hash, 'minha-senha')).toBe(true);
  });

  it('deve rejeitar senha errada', async () => {
    const hash = await service.hash('minha-senha');
    expect(await service.verify(hash, 'senha-errada')).toBe(false);
  });

  it('deve gerar hash Argon2id (prefixo $argon2id$)', async () => {
    const hash = await service.hash('test-password');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('deve lançar erro se PEPPER_SECRET não estiver configurado', async () => {
    await expect(() => {
      return Test.createTestingModule({
        providers: [
          HashingService,
          {
            provide: ConfigService,
            useValue: {
              get: () => undefined,
            },
          },
        ],
      }).compile();
    }).rejects.toThrow('PEPPER_SECRET');
  });
});
