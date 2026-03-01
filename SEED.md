# SEED.md — KegSafe Tech — Dados Iniciais (Seed)

## 1. Tenant de Demonstração

```typescript
const tenant = {
  name: 'Cervejaria Petrópolis',
  cnpj: '12.345.678/0001-90',
  slug: 'petropolis',
};
```

## 2. Usuários Iniciais

```typescript
const users = [
  { name: 'Admin Petrópolis', email: 'admin@petropolis.com.br', role: 'ADMIN', password: 'Admin@123' },
  { name: 'Carlos Silva', email: 'carlos@petropolis.com.br', role: 'LOGISTICS', password: 'Log@123' },
  { name: 'Roberto Souza', email: 'roberto@petropolis.com.br', role: 'MAINTENANCE', password: 'Man@123' },
  { name: 'Ana Oliveira', email: 'ana@petropolis.com.br', role: 'MANAGER', password: 'Ger@123' },
];
```

## 3. Configuração de Componentes (ComponentConfig)

```typescript
const componentConfigs = [
  {
    name: 'Sifão (Tubo Extrator)',
    description: 'Leva o chopp do fundo para a válvula. Mola interna e travas de segurança.',
    maxCycles: 40,
    maxDays: 730,
    criticality: 'HIGH',
    alertThreshold: 0.9,
  },
  {
    name: 'O-Ring (Vedação do Sifão)',
    description: 'Garante a vedação hermética. Ponto de desgaste: ressecamento e fissuras.',
    maxCycles: 15,
    maxDays: 180,
    criticality: 'HIGH',
    alertThreshold: 0.9,
  },
  {
    name: 'Válvula Principal (Bocal)',
    description: 'Interface de conexão com a extratora. Ponto de desgaste: amassados ou ranhuras.',
    maxCycles: 60,
    maxDays: 1095,
    criticality: 'CRITICAL',
    alertThreshold: 0.9,
  },
  {
    name: 'Corpo do Barril (Inox)',
    description: 'Estrutura de armazenamento. Ponto de desgaste: deformações estruturais ou furos.',
    maxCycles: 200,
    maxDays: 1825,
    criticality: 'CRITICAL',
    alertThreshold: 0.85,
  },
  {
    name: 'Chimb (Base e Alças)',
    description: 'Proteção contra impactos. Ponto de desgaste: soldas trincadas ou deformação.',
    maxCycles: 100,
    maxDays: 1825,
    criticality: 'MEDIUM',
    alertThreshold: 0.9,
  },
  {
    name: 'Válvula de Segurança',
    description: 'Alivia pressão excessiva. Ponto de desgaste: travamento por resíduos.',
    maxCycles: 50,
    maxDays: 365,
    criticality: 'CRITICAL',
    alertThreshold: 0.85,
  },
];
```

## 4. Geofences Iniciais

```typescript
const geofences = [
  {
    name: 'Fábrica Petrópolis - Matriz',
    type: 'FACTORY',
    latitude: -22.5112,
    longitude: -43.1779,
    radiusMeters: 1000,
  },
  {
    name: 'Centro de Distribuição SP',
    type: 'FACTORY',
    latitude: -23.5505,
    longitude: -46.6333,
    radiusMeters: 800,
  },
];
```

## 5. Clientes de Demonstração

```typescript
const clients = [
  {
    name: 'Bar do Zé',
    tradeName: 'Bar do Zé',
    cnpj: '98.765.432/0001-10',
    latitude: -23.5610,
    longitude: -46.6555,
    connectorType: 'TYPE_S',
  },
  {
    name: 'Restaurante Sabor da Terra',
    tradeName: 'Sabor da Terra',
    cnpj: '11.222.333/0001-44',
    latitude: -23.5480,
    longitude: -46.6300,
    connectorType: 'TYPE_S',
  },
  {
    name: 'Choperia Central',
    tradeName: 'Choperia Central',
    cnpj: '55.666.777/0001-88',
    latitude: -23.5700,
    longitude: -46.6450,
    connectorType: 'TYPE_D',
  },
];
```

## 6. Barris de Demonstração (50 unidades)

```typescript
// Gerar 50 barris com IDs sequenciais
const barrels = Array.from({ length: 50 }, (_, i) => ({
  internalCode: `KS-BAR-${String(i + 1).padStart(5, '0')}`,
  qrCode: `KS-QR-${String(i + 1).padStart(5, '0')}`,
  manufacturer: ['Franke', 'Portinox', 'Blefa'][i % 3],
  valveModel: 'TYPE_S',
  capacityLiters: [30, 50][i % 2],
  tareWeightKg: [9.5, 13.2][i % 2],
  material: 'INOX_304',
  acquisitionCost: [650, 800][i % 2],
  status: 'ACTIVE',
  totalCycles: Math.floor(Math.random() * 30),
}));
```

## 7. Script de Seed (seed.ts)

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Criar Tenant
  const tenant = await prisma.tenant.create({
    data: { name: 'Cervejaria Petrópolis', cnpj: '12345678000190', slug: 'petropolis' },
  });

  // 2. Criar Usuários
  for (const u of users) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: u.name,
        email: u.email,
        role: u.role,
        passwordHash: await bcrypt.hash(u.password, 10),
      },
    });
  }

  // 3. Criar ComponentConfigs
  const configs = [];
  for (const c of componentConfigs) {
    const config = await prisma.componentConfig.create({
      data: { tenantId: tenant.id, ...c },
    });
    configs.push(config);
  }

  // 4. Criar Geofences
  for (const g of geofences) {
    await prisma.geofence.create({
      data: { tenantId: tenant.id, ...g },
    });
  }

  // 5. Criar Clientes
  for (const cl of clients) {
    await prisma.client.create({
      data: { tenantId: tenant.id, ...cl },
    });
  }

  // 6. Criar Barris + ComponentCycles
  for (const b of barrels) {
    const barrel = await prisma.barrel.create({
      data: { tenantId: tenant.id, ...b },
    });

    // Criar um ComponentCycle para cada config
    for (const config of configs) {
      await prisma.componentCycle.create({
        data: {
          barrelId: barrel.id,
          componentConfigId: config.id,
          cyclesSinceLastService: Math.floor(Math.random() * config.maxCycles * 0.5),
          lastServiceDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
          healthScore: 'GREEN',
        },
      });
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```
