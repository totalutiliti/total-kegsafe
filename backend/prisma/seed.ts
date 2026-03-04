import { PrismaClient, Role, Criticality, GeofenceType, BarrelStatus, HealthScore } from '@prisma/client';
import * as argon2 from 'argon2';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PEPPER = process.env.PEPPER_SECRET;
if (!PEPPER) {
    throw new Error('PEPPER_SECRET não configurado nas variáveis de ambiente (necessário para seed)');
}

async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password + PEPPER, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    });
}

const users = [
    { name: 'Administrador', email: 'admin@petropolis.com.br', role: Role.ADMIN, password: 'Admin@123' },
    { name: 'Gestor de Operações', email: 'gestor@petropolis.com.br', role: Role.MANAGER, password: 'Gestor@123' },
    { name: 'Operador de Logística', email: 'logistica@petropolis.com.br', role: Role.LOGISTICS, password: 'Logistica@123' },
    { name: 'Técnico de Manutenção', email: 'manutencao@petropolis.com.br', role: Role.MAINTENANCE, password: 'Manutencao@123' },
];

const componentConfigs = [
    { name: 'Sifão (Tubo Extrator)', description: 'Leva o chopp do fundo para a válvula.', maxCycles: 40, maxDays: 730, criticality: Criticality.HIGH, alertThreshold: 0.9 },
    { name: 'O-Ring (Vedação do Sifão)', description: 'Garante a vedação hermética.', maxCycles: 15, maxDays: 180, criticality: Criticality.HIGH, alertThreshold: 0.9 },
    { name: 'Válvula Principal (Bocal)', description: 'Interface de conexão com a extratora.', maxCycles: 60, maxDays: 1095, criticality: Criticality.CRITICAL, alertThreshold: 0.9 },
    { name: 'Corpo do Barril (Inox)', description: 'Estrutura de armazenamento.', maxCycles: 200, maxDays: 1825, criticality: Criticality.CRITICAL, alertThreshold: 0.85 },
    { name: 'Chimb (Base e Alças)', description: 'Proteção contra impactos.', maxCycles: 100, maxDays: 1825, criticality: Criticality.MEDIUM, alertThreshold: 0.9 },
    { name: 'Válvula de Segurança', description: 'Alivia pressão excessiva.', maxCycles: 50, maxDays: 365, criticality: Criticality.CRITICAL, alertThreshold: 0.85 },
];

const geofences = [
    { name: 'Fábrica Petrópolis - Matriz', type: GeofenceType.FACTORY, latitude: -22.5112, longitude: -43.1779, radiusMeters: 1000 },
    { name: 'Centro de Distribuição SP', type: GeofenceType.FACTORY, latitude: -23.5505, longitude: -46.6333, radiusMeters: 800 },
];

const clients = [
    { name: 'Bar do Zé', tradeName: 'Bar do Zé', cnpj: '98765432000110', latitude: -23.5610, longitude: -46.6555, connectorType: 'TYPE_S' },
    { name: 'Restaurante Sabor da Terra', tradeName: 'Sabor da Terra', cnpj: '11222333000144', latitude: -23.5480, longitude: -46.6300, connectorType: 'TYPE_S' },
    { name: 'Choperia Central', tradeName: 'Choperia Central', cnpj: '55666777000188', latitude: -23.5700, longitude: -46.6450, connectorType: 'TYPE_D' },
];

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Criar Tenant (idempotente)
    let tenant = await prisma.tenant.findFirst({ where: { cnpj: '12345678000190' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Cervejaria Petrópolis',
                cnpj: '12345678000190',
                slug: 'petropolis',
                settings: { idleThresholdDays: 15, autoTriageEnabled: true },
            },
        });
        console.log('✅ Tenant created:', tenant.name);
    } else {
        console.log('⏭️ Tenant already exists:', tenant.name);
    }

    // 2. Criar Usuários (idempotente)
    let usersCreated = 0;
    for (const u of users) {
        const existing = await prisma.user.findFirst({ where: { email: u.email, tenantId: tenant.id } });
        if (!existing) {
            await prisma.user.create({
                data: {
                    tenantId: tenant.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    passwordHash: await hashPassword(u.password),
                },
            });
            usersCreated++;
        }
    }
    console.log(`✅ Users: ${usersCreated} created, ${users.length - usersCreated} already existed`);

    // 3. Criar ComponentConfigs (idempotente)
    const configs = [];
    let configsCreated = 0;
    for (const c of componentConfigs) {
        let config = await prisma.componentConfig.findFirst({ where: { name: c.name, tenantId: tenant.id } });
        if (!config) {
            config = await prisma.componentConfig.create({
                data: { tenantId: tenant.id, ...c },
            });
            configsCreated++;
        }
        configs.push(config);
    }
    console.log(`✅ Component configs: ${configsCreated} created, ${componentConfigs.length - configsCreated} already existed`);

    // 4. Criar Geofences (idempotente)
    let geofencesCreated = 0;
    for (const g of geofences) {
        const existing = await prisma.geofence.findFirst({ where: { name: g.name, tenantId: tenant.id } });
        if (!existing) {
            await prisma.geofence.create({
                data: { tenantId: tenant.id, ...g },
            });
            geofencesCreated++;
        }
    }
    console.log(`✅ Geofences: ${geofencesCreated} created, ${geofences.length - geofencesCreated} already existed`);

    // 5. Criar Clientes com Geofences automáticas (idempotente)
    let clientsCreated = 0;
    for (const cl of clients) {
        const existing = await prisma.client.findFirst({ where: { cnpj: cl.cnpj, tenantId: tenant.id } });
        if (!existing) {
            const client = await prisma.client.create({
                data: { tenantId: tenant.id, ...cl },
            });

            if (cl.latitude && cl.longitude) {
                await prisma.geofence.create({
                    data: {
                        tenantId: tenant.id,
                        name: `Geofence - ${cl.tradeName}`,
                        type: GeofenceType.CLIENT,
                        latitude: cl.latitude,
                        longitude: cl.longitude,
                        radiusMeters: 500,
                        clientId: client.id,
                    },
                });
            }
            clientsCreated++;
        }
    }
    console.log(`✅ Clients: ${clientsCreated} created, ${clients.length - clientsCreated} already existed`);

    // 6. Criar 50 Barris + ComponentCycles (idempotente)
    const manufacturers = ['Franke', 'Portinox', 'Blefa'];
    let barrelsCreated = 0;

    for (let i = 0; i < 50; i++) {
        const internalCode = `KS-BAR-${String(i + 1).padStart(5, '0')}`;
        const existing = await prisma.barrel.findFirst({ where: { internalCode, tenantId: tenant.id } });
        if (existing) continue;

        const totalCycles = Math.floor(Math.random() * 30);

        const barrel = await prisma.barrel.create({
            data: {
                tenantId: tenant.id,
                internalCode,
                qrCode: `KS-QR-${String(i + 1).padStart(5, '0')}`,
                manufacturer: manufacturers[i % 3],
                valveModel: 'TYPE_S',
                capacityLiters: [30, 50][i % 2],
                tareWeightKg: [9.5, 13.2][i % 2],
                material: 'INOX_304',
                acquisitionCost: [650, 800][i % 2],
                status: BarrelStatus.ACTIVE,
                totalCycles,
            },
        });

        for (const config of configs) {
            const cyclesSinceLastService = Math.floor(Math.random() * config.maxCycles * 0.5);
            const healthPercentage = (cyclesSinceLastService / config.maxCycles) * 100;
            let healthScore: HealthScore = HealthScore.GREEN;

            if (healthPercentage >= 100) healthScore = HealthScore.RED;
            else if (healthPercentage >= 80) healthScore = HealthScore.YELLOW;

            await prisma.componentCycle.create({
                data: {
                    barrelId: barrel.id,
                    componentConfigId: config.id,
                    cyclesSinceLastService,
                    lastServiceDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
                    healthScore,
                    healthPercentage,
                },
            });
        }
        barrelsCreated++;
    }
    console.log(`✅ Barrels: ${barrelsCreated} created, ${50 - barrelsCreated} already existed`);

    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
