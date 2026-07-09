import {
  PrismaClient,
  Role,
  Criticality,
  GeofenceType,
  BarrelStatus,
  HealthScore,
  MaintenanceType,
  MaintenanceOrderStatus,
  AlertPriority,
  AlertType,
  AlertStatus,
  LogisticsAction,
  DisposalStatus,
  DisposalDestination,
} from '@prisma/client';
import * as argon2 from 'argon2';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PEPPER = process.env.PEPPER_SECRET;
if (!PEPPER) {
  throw new Error(
    'PEPPER_SECRET não configurado nas variáveis de ambiente (necessário para seed)',
  );
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
  {
    name: 'Administrador Germânia',
    email: 'admin@germania.com.br',
    role: Role.ADMIN,
    password: 'Admin@123',
  },
  {
    name: 'Gestor de Operações',
    email: 'gestor@germania.com.br',
    role: Role.MANAGER,
    password: 'Gestor@123',
  },
  {
    name: 'Operador de Logística',
    email: 'logistica@germania.com.br',
    role: Role.LOGISTICS,
    password: 'Logistica@123',
  },
  {
    name: 'Técnico de Manutenção',
    email: 'manutencao@germania.com.br',
    role: Role.MAINTENANCE,
    password: 'Manutencao@123',
  },
  {
    name: 'Carlos Motorista',
    email: 'carlos@germania.com.br',
    role: Role.LOGISTICS,
    password: 'Carlos@123',
  },
  {
    name: 'Ana Supervisora',
    email: 'ana@germania.com.br',
    role: Role.MANAGER,
    password: 'Ana@12345',
  },
  {
    name: 'Pedro Técnico',
    email: 'pedro@germania.com.br',
    role: Role.MAINTENANCE,
    password: 'Pedro@123',
  },
  {
    name: 'Fernanda Operadora',
    email: 'fernanda@germania.com.br',
    role: Role.LOGISTICS,
    password: 'Fernanda@123',
  },
  {
    name: 'Ricardo Gestor',
    email: 'ricardo@germania.com.br',
    role: Role.MANAGER,
    password: 'Ricardo@123',
  },
  {
    name: 'Juliana Técnica',
    email: 'juliana@germania.com.br',
    role: Role.MAINTENANCE,
    password: 'Juliana@123',
  },
];

// ---------------------------------------------------------------------------
// Estilos de chopp Germânia (fonte: planilha oficial germania_produtos.xlsx)
// Usados para "envasar" cada barril (campo currentBeerStyle) e alimentar o
// Catálogo. Carioquinha é exclusiva de growler → NÃO entra em barril.
// ---------------------------------------------------------------------------
// Distribuição ponderada: Pilsen é o "estilo mais vendido".
const barrelBeerStyles: string[] = [
  'Germânia Pilsen',
  'Germânia Pilsen',
  'Germânia Pilsen',
  'Germânia Pilsen',
  'Germânia Puro Malte',
  'Germânia Puro Malte',
  'Germânia Escuro',
  'Germânia Vinhedo',
  'Germânia Amber Lager',
  'Germânia IPA',
  'Germânia Munich Helles',
  'Germânia Weissbier',
  'Germânia Black',
  'Slow Beer',
];

const componentConfigs = [
  {
    name: 'Sifão (Tubo Extrator)',
    description: 'Leva o chopp do fundo para a válvula.',
    maxCycles: 40,
    maxDays: 730,
    criticality: Criticality.HIGH,
    alertThreshold: 0.9,
  },
  {
    name: 'O-Ring (Vedação do Sifão)',
    description: 'Garante a vedação hermética.',
    maxCycles: 15,
    maxDays: 180,
    criticality: Criticality.HIGH,
    alertThreshold: 0.9,
  },
  {
    name: 'Válvula Principal (Bocal)',
    description: 'Interface de conexão com a extratora.',
    maxCycles: 60,
    maxDays: 1095,
    criticality: Criticality.CRITICAL,
    alertThreshold: 0.9,
  },
  {
    name: 'Corpo do Barril (Inox)',
    description: 'Estrutura de armazenamento.',
    maxCycles: 200,
    maxDays: 1825,
    criticality: Criticality.CRITICAL,
    alertThreshold: 0.85,
  },
  {
    name: 'Chimb (Base e Alças)',
    description: 'Proteção contra impactos.',
    maxCycles: 100,
    maxDays: 1825,
    criticality: Criticality.MEDIUM,
    alertThreshold: 0.9,
  },
  {
    name: 'Válvula de Segurança',
    description: 'Alivia pressão excessiva.',
    maxCycles: 50,
    maxDays: 365,
    criticality: Criticality.CRITICAL,
    alertThreshold: 0.85,
  },
];

const geofences = [
  {
    name: 'Fábrica Germânia - Vinhedo/SP',
    type: GeofenceType.FACTORY,
    latitude: -23.0299,
    longitude: -46.975,
    radiusMeters: 1000,
  },
  {
    name: 'Centro de Distribuição Campinas',
    type: GeofenceType.FACTORY,
    latitude: -22.9099,
    longitude: -47.0626,
    radiusMeters: 800,
  },
];

const suppliers = [
  {
    name: 'Vedações Campinas Ltda',
    cnpj: '90847213000146',
    supplyType: 'O-Rings e vedações industriais',
    leadTimeDays: 7,
    contactEmail: 'vendas@vedacoescampinas.com.br',
    contactPhone: '+5519999001122',
    paymentTerms: '30 dias',
  },
  {
    name: 'InoxParts Vinhedo Comércio',
    cnpj: '47120389000172',
    supplyType: 'Componentes em aço inox',
    leadTimeDays: 14,
    contactEmail: 'contato@inoxpartsvinhedo.com.br',
    contactPhone: '+5519988112233',
    paymentTerms: '28 dias',
  },
];

const serviceProviders = [
  {
    name: 'MetalSolda Campinas Serviços',
    specialty: 'Soldagem TIG/MIG em aço inox',
    certifications: 'NR-13, ISO 9001',
    hourlyRate: 120.0,
    serviceRate: 350.0,
    contactEmail: 'orcamento@metalsoldacampinas.com.br',
    contactPhone: '+5519977001122',
  },
  {
    name: 'HidroTest Vinhedo Engenharia',
    specialty: 'Teste hidrostático e pneumático',
    certifications: 'NR-13, ABNT NBR 13465',
    hourlyRate: 150.0,
    serviceRate: 500.0,
    contactEmail: 'contato@hidrotestvinhedo.eng.br',
    contactPhone: '+5519966112233',
  },
];

const clients = [
  {
    name: 'Lig Chopp Germânia Vinhedo Ltda',
    tradeName: 'Lig Chopp Germânia Vinhedo',
    cnpj: '43776517000180',
    latitude: -23.03,
    longitude: -46.983,
    connectorType: 'TYPE_S',
  },
  {
    name: 'Boteco do Vale Bar e Petiscaria',
    tradeName: 'Boteco do Vale',
    cnpj: '60112094000112',
    latitude: -22.9705,
    longitude: -46.9959,
    connectorType: 'TYPE_S',
  },
  {
    name: 'Choperia Bierhaus Campinas',
    tradeName: 'Bierhaus Campinas',
    cnpj: '12908736000141',
    latitude: -22.9099,
    longitude: -47.0626,
    connectorType: 'TYPE_D',
  },
  {
    name: 'Cantina Toscana Restaurante',
    tradeName: 'Cantina Toscana',
    cnpj: '55321470000149',
    latitude: -23.1857,
    longitude: -46.8978,
    connectorType: 'TYPE_S',
  },
  {
    name: 'Empório do Chopp Louveira',
    tradeName: 'Empório do Chopp Louveira',
    cnpj: '78904561000102',
    latitude: -23.0873,
    longitude: -46.9506,
    connectorType: 'TYPE_S',
  },
  {
    name: 'Chopp Germânia Moema',
    tradeName: 'Chopp Germânia Moema',
    cnpj: '33915602000128',
    latitude: -23.6024,
    longitude: -46.6636,
    connectorType: 'TYPE_D',
  },
];

async function main() {
  console.log('🌱 Starting seed...');

  // 0. Criar System Tenant + Super Admin (idempotente)
  let systemTenant = await prisma.tenant.findFirst({
    where: { slug: 'kegsafe-system' },
  });
  if (!systemTenant) {
    systemTenant = await prisma.tenant.create({
      data: {
        name: 'KegSafe System',
        cnpj: '00000000000191',
        slug: 'kegsafe-system',
        settings: {},
      },
    });
    console.log('✅ System tenant created:', systemTenant.name);
  } else {
    console.log('⏭️ System tenant already exists:', systemTenant.name);
  }

  // Criar super admin padrão
  const superAdminEmail = 'superadmin@kegsafe.com.br';
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: superAdminEmail, tenantId: systemTenant.id },
  });
  if (!existingSuperAdmin) {
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (!superAdminPassword && process.env.NODE_ENV === 'production') {
      throw new Error(
        'SUPER_ADMIN_PASSWORD é obrigatório em produção. Defina a variável de ambiente.',
      );
    }
    await prisma.user.create({
      data: {
        tenantId: systemTenant.id,
        name: 'Super Administrador',
        email: superAdminEmail,
        role: Role.SUPER_ADMIN,
        passwordHash: await hashPassword(superAdminPassword || 'SuperAdmin@123'),
        mustChangePassword: true,
      },
    });
    console.log('✅ Super admin created:', superAdminEmail);
  } else {
    console.log('⏭️ Super admin already exists:', superAdminEmail);
  }

  // 1. Criar Tenant (idempotente) — Cervejaria Germânia (Vinhedo/SP)
  let tenant = await prisma.tenant.findFirst({
    where: { cnpj: '24328078000106' },
  });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Cervejaria Germânia',
        cnpj: '24328078000106',
        slug: 'germania',
        settings: {
          idleThresholdDays: 15,
          autoTriageEnabled: true,
          maintenanceBlockMode: 'ADVISORY',
          expectedBarrelLifeYears: 20,
          city: 'Vinhedo/SP',
          contactPhone: '0800 110 0420',
        },
      },
    });
    console.log('✅ Tenant created:', tenant.name);
  } else {
    console.log('⏭️ Tenant already exists:', tenant.name);
  }

  // 2. Criar Usuários (idempotente)
  let usersCreated = 0;
  for (const u of users) {
    const existing = await prisma.user.findFirst({
      where: { email: u.email, tenantId: tenant.id },
    });
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
  console.log(
    `✅ Users: ${usersCreated} created, ${users.length - usersCreated} already existed`,
  );

  // 3. Criar ComponentConfigs (idempotente)
  const configs = [];
  let configsCreated = 0;
  for (const c of componentConfigs) {
    let config = await prisma.componentConfig.findFirst({
      where: { name: c.name, tenantId: tenant.id },
    });
    if (!config) {
      config = await prisma.componentConfig.create({
        data: { tenantId: tenant.id, ...c },
      });
      configsCreated++;
    }
    configs.push(config);
  }
  console.log(
    `✅ Component configs: ${configsCreated} created, ${componentConfigs.length - configsCreated} already existed`,
  );

  // 4. Criar Geofences (idempotente)
  let geofencesCreated = 0;
  for (const g of geofences) {
    const existing = await prisma.geofence.findFirst({
      where: { name: g.name, tenantId: tenant.id },
    });
    if (!existing) {
      await prisma.geofence.create({
        data: { tenantId: tenant.id, ...g },
      });
      geofencesCreated++;
    }
  }
  console.log(
    `✅ Geofences: ${geofencesCreated} created, ${geofences.length - geofencesCreated} already existed`,
  );

  // 5. Criar Clientes com Geofences automáticas (idempotente)
  let clientsCreated = 0;
  for (const cl of clients) {
    const existing = await prisma.client.findFirst({
      where: { cnpj: cl.cnpj, tenantId: tenant.id },
    });
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
  console.log(
    `✅ Clients: ${clientsCreated} created, ${clients.length - clientsCreated} already existed`,
  );

  // 6. Criar Fornecedores (idempotente)
  let suppliersCreated = 0;
  for (const s of suppliers) {
    const existing = await prisma.supplier.findFirst({
      where: { cnpj: s.cnpj, tenantId: tenant.id },
    });
    if (!existing) {
      await prisma.supplier.create({
        data: { tenantId: tenant.id, ...s },
      });
      suppliersCreated++;
    }
  }
  console.log(
    `✅ Suppliers: ${suppliersCreated} created, ${suppliers.length - suppliersCreated} already existed`,
  );

  // 7. Criar Prestadores de Serviço (idempotente)
  let providersCreated = 0;
  for (const sp of serviceProviders) {
    const existing = await prisma.serviceProvider.findFirst({
      where: { name: sp.name, tenantId: tenant.id },
    });
    if (!existing) {
      await prisma.serviceProvider.create({
        data: { tenantId: tenant.id, ...sp },
      });
      providersCreated++;
    }
  }
  console.log(
    `✅ Service providers: ${providersCreated} created, ${serviceProviders.length - providersCreated} already existed`,
  );

  // 8. Criar Barris + ComponentCycles (idempotente)
  // Frota Germânia: capacidades reais (10/15/20/30/50 L) com peso de tara e
  // custo de aquisição coerentes por tamanho. Cada barril é "envasado" com um
  // estilo real (currentBeerStyle).
  const manufacturers = ['Franke', 'Portinox', 'Blefa'];
  const valveModels = ['TYPE_S', 'TYPE_S', 'TYPE_S', 'TYPE_D'] as const;
  const barrelStatuses: BarrelStatus[] = [
    BarrelStatus.ACTIVE, BarrelStatus.ACTIVE, BarrelStatus.ACTIVE,
    BarrelStatus.IN_TRANSIT, BarrelStatus.AT_CLIENT, BarrelStatus.AT_CLIENT,
    BarrelStatus.IN_MAINTENANCE, BarrelStatus.BLOCKED,
  ];
  // Especificações por capacidade (tara em kg, custo de aquisição em R$)
  const capacitySpec: Record<number, { tare: number; cost: number }> = {
    10: { tare: 5.0, cost: 380 },
    15: { tare: 6.5, cost: 450 },
    20: { tare: 8.0, cost: 520 },
    30: { tare: 9.5, cost: 650 },
    50: { tare: 13.2, cost: 800 },
  };
  // Distribuição realista da frota (50L e 30L predominam em eventos)
  const fleetCapacities: number[] = [
    ...Array<number>(24).fill(50),
    ...Array<number>(18).fill(30),
    ...Array<number>(9).fill(20),
    ...Array<number>(6).fill(15),
    ...Array<number>(3).fill(10),
  ];
  const FLEET_SIZE = fleetCapacities.length; // 60 barris
  let barrelsCreated = 0;
  const createdBarrelIds: string[] = [];

  for (let i = 0; i < FLEET_SIZE; i++) {
    const internalCode = `KS-BAR-${String(i + 1).padStart(9, '0')}`;
    const existing = await prisma.barrel.findFirst({
      where: { internalCode, tenantId: tenant.id },
    });
    if (existing) {
      createdBarrelIds.push(existing.id);
      continue;
    }

    const totalCycles = Math.floor(Math.random() * 30);
    const status = barrelStatuses[i % barrelStatuses.length];
    const capacityLiters = fleetCapacities[i];
    const spec = capacitySpec[capacityLiters];
    const manufactureDate = new Date(
      Date.now() - (2 + Math.random() * 8) * 365.25 * 24 * 60 * 60 * 1000,
    );

    const barrel = await prisma.barrel.create({
      data: {
        tenantId: tenant.id,
        internalCode,
        qrCode: `KS-QR-${String(i + 1).padStart(9, '0')}`,
        chassisNumber: `CH-${String(i + 1).padStart(6, '0')}`,
        manufacturer: manufacturers[i % 3],
        valveModel: valveModels[i % valveModels.length],
        capacityLiters,
        tareWeightKg: spec.tare,
        material: 'INOX_304',
        acquisitionCost: spec.cost,
        currentBeerStyle: barrelBeerStyles[i % barrelBeerStyles.length],
        status,
        totalCycles,
        manufactureDate,
      },
    });

    for (const config of configs) {
      const cyclesSinceLastService = Math.floor(
        Math.random() * config.maxCycles * 0.5,
      );
      const healthPercentage =
        (cyclesSinceLastService / config.maxCycles) * 100;
      let healthScore: HealthScore = HealthScore.GREEN;

      if (healthPercentage >= 100) healthScore = HealthScore.RED;
      else if (healthPercentage >= 80) healthScore = HealthScore.YELLOW;

      await prisma.componentCycle.create({
        data: {
          barrelId: barrel.id,
          componentConfigId: config.id,
          cyclesSinceLastService,
          lastServiceDate: new Date(
            Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
          ),
          healthScore,
          healthPercentage,
        },
      });
    }
    createdBarrelIds.push(barrel.id);
    barrelsCreated++;
  }
  console.log(
    `✅ Barrels: ${barrelsCreated} created, ${FLEET_SIZE - barrelsCreated} already existed`,
  );

  // 8b. Inicializar BarrelSequence para que generateBatch comece após a frota
  await prisma.barrelSequence.upsert({
    where: { key: 'global' },
    create: { key: 'global', lastNumber: FLEET_SIZE },
    update: {}, // não sobrescrever se já existe com valor maior
  });
  console.log(`✅ BarrelSequence initialized at ${FLEET_SIZE}`);

  // 9. Criar Eventos Logísticos (100+)
  const allUsers = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  const allClients = await prisma.client.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  const existingLogisticsEvents = await prisma.logisticsEvent.count({
    where: { tenantId: tenant.id },
  });

  if (existingLogisticsEvents < 50) {
    const actions = [LogisticsAction.EXPEDITION, LogisticsAction.DELIVERY, LogisticsAction.COLLECTION, LogisticsAction.RECEPTION];
    let logEventsCreated = 0;

    for (let i = 0; i < 120; i++) {
      const barrelId = createdBarrelIds[i % createdBarrelIds.length];
      const userId = allUsers[i % allUsers.length].id;
      const action = actions[i % actions.length];
      const daysAgo = Math.floor(Math.random() * 90);

      await prisma.logisticsEvent.create({
        data: {
          tenantId: tenant.id,
          barrelId,
          userId,
          actionType: action,
          latitude: -23.55 + (Math.random() - 0.5) * 0.05,
          longitude: -46.64 + (Math.random() - 0.5) * 0.05,
          gpsAccuracy: 5 + Math.random() * 20,
          clientId: action === LogisticsAction.DELIVERY || action === LogisticsAction.COLLECTION
            ? allClients[i % allClients.length].id
            : null,
          previousStatus: BarrelStatus.ACTIVE,
          inferredZone: action === LogisticsAction.EXPEDITION || action === LogisticsAction.RECEPTION ? GeofenceType.FACTORY : GeofenceType.CLIENT,
          timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        },
      });
      logEventsCreated++;
    }
    console.log(`✅ Logistics events: ${logEventsCreated} created`);
  } else {
    console.log('⏭️ Logistics events already seeded');
  }

  // 10. Criar Ordens de Manutenção (30+)
  const existingOrders = await prisma.maintenanceOrder.count({
    where: { tenantId: tenant.id },
  });

  if (existingOrders < 10) {
    const maintenanceTypes = [MaintenanceType.PREVENTIVE, MaintenanceType.CORRECTIVE, MaintenanceType.PREDICTIVE];
    const orderStatuses = [MaintenanceOrderStatus.COMPLETED, MaintenanceOrderStatus.COMPLETED, MaintenanceOrderStatus.IN_PROGRESS, MaintenanceOrderStatus.PENDING];
    let ordersCreated = 0;

    for (let i = 0; i < 35; i++) {
      const barrelId = createdBarrelIds[i % createdBarrelIds.length];
      const daysAgo = Math.floor(Math.random() * 60);
      const orderStatus = orderStatuses[i % orderStatuses.length];

      await prisma.maintenanceOrder.create({
        data: {
          tenantId: tenant.id,
          orderNumber: `OS-SEED-${String(i + 1).padStart(4, '0')}`,
          barrelId,
          orderType: maintenanceTypes[i % maintenanceTypes.length],
          status: orderStatus,
          priority: [AlertPriority.LOW, AlertPriority.MEDIUM, AlertPriority.HIGH][i % 3],
          description: `Manutenção de rotina - barril #${i + 1}`,
          estimatedCost: 100 + Math.random() * 400,
          actualCost: orderStatus === MaintenanceOrderStatus.COMPLETED ? 80 + Math.random() * 350 : null,
          completedAt: orderStatus === MaintenanceOrderStatus.COMPLETED
            ? new Date(Date.now() - (daysAgo - 2) * 24 * 60 * 60 * 1000)
            : null,
          createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        },
      });
      ordersCreated++;
    }
    console.log(`✅ Maintenance orders: ${ordersCreated} created`);
  } else {
    console.log('⏭️ Maintenance orders already seeded');
  }

  // 11. Criar 8 Disposals (cenários variados com alertas)
  const existingDisposals = await prisma.disposal.count({
    where: { tenantId: tenant.id },
  });

  if (existingDisposals < 4) {
    const adminUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: Role.ADMIN },
    });
    const managerUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: Role.MANAGER },
    });

    if (adminUser && managerUser) {
      const disposalScenarios = [
        { status: DisposalStatus.COMPLETED, destination: DisposalDestination.SCRAP_SALE, reason: 'Corrosão avançada no corpo do barril. Impossível recuperar.' },
        { status: DisposalStatus.COMPLETED, destination: DisposalDestination.RECYCLING, reason: 'Válvula principal danificada irreversivelmente após acidente logístico.' },
        { status: DisposalStatus.COMPLETED, destination: DisposalDestination.DONATION, reason: 'Barril antigo fora de padrão. Doado para projeto social de cerveja artesanal.' },
        { status: DisposalStatus.APPROVED, destination: null, reason: 'TCO acumulado excede 80% do custo de reposição. Aguardando destinação.' },
        { status: DisposalStatus.PENDING_APPROVAL, destination: null, reason: 'Deformação estrutural no chimb após queda. Avaliação técnica recomenda descarte.' },
        { status: DisposalStatus.PENDING_APPROVAL, destination: null, reason: 'Barril com vazamento persistente após 3 tentativas de reparo.' },
        { status: DisposalStatus.REJECTED, destination: null, reason: 'Solicitação de descarte preventivo. Rejeitado — barril ainda em boas condições.' },
        { status: DisposalStatus.COMPLETED, destination: DisposalDestination.SCRAP_SALE, reason: 'Barril com menos de 5 anos. Descarte prematuro por avaria severa.' },
      ];

      let disposalsCreated = 0;
      for (let i = 0; i < disposalScenarios.length; i++) {
        const scenario = disposalScenarios[i];
        const barrelId = createdBarrelIds[42 + i]; // Use barrels 43-50
        if (!barrelId) continue;

        const daysAgo = 5 + i * 7;
        const disposal = await prisma.disposal.create({
          data: {
            tenantId: tenant.id,
            barrelId,
            requestedById: adminUser.id,
            reason: scenario.reason,
            status: scenario.status,
            tcoAccumulated: 200 + Math.random() * 600,
            replacementCost: [650, 800][i % 2],
            destination: scenario.destination,
            scrapValue: scenario.destination === DisposalDestination.SCRAP_SALE ? 50 + Math.random() * 100 : null,
            approvedById: scenario.status !== DisposalStatus.PENDING_APPROVAL ? managerUser.id : null,
            approvedAt: scenario.status !== DisposalStatus.PENDING_APPROVAL
              ? new Date(Date.now() - (daysAgo - 1) * 24 * 60 * 60 * 1000)
              : null,
            completedAt: scenario.status === DisposalStatus.COMPLETED
              ? new Date(Date.now() - (daysAgo - 2) * 24 * 60 * 60 * 1000)
              : null,
            createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          },
        });

        // Mark barrel as DISPOSED for completed disposals (sucata → sem estilo envasado)
        if (scenario.status === DisposalStatus.COMPLETED) {
          await prisma.barrel.update({
            where: { id: barrelId },
            data: { status: BarrelStatus.DISPOSED, currentBeerStyle: null },
          });
        }


        // Create PREMATURE_DISPOSAL alert for last scenario (young barrel)
        if (i === 7) {
          await prisma.alert.create({
            data: {
              tenantId: tenant.id,
              barrelId,
              alertType: AlertType.PREMATURE_DISPOSAL,
              priority: AlertPriority.HIGH,
              title: `Descarte prematuro: barril KS-BAR-${String(43 + i).padStart(9, '0')}`,
              description: 'Barril com apenas 25% da vida útil esperada (5 de 20 anos)',
              metadata: { lifePercentage: 25, ageYears: 5, expectedLifeYears: 20 },
            },
          });
        }

        disposalsCreated++;
      }
      console.log(`✅ Disposals: ${disposalsCreated} created`);
    }
  } else {
    console.log('⏭️ Disposals already seeded');
  }

  // 12. Criar Alertas variados
  const existingAlerts = await prisma.alert.count({
    where: { tenantId: tenant.id },
  });

  if (existingAlerts < 5) {
    const alertScenarios = [
      { type: AlertType.COMPONENT_END_OF_LIFE, priority: AlertPriority.HIGH, title: 'Componente em fim de vida útil', resolved: false },
      { type: AlertType.MANDATORY_INSPECTION, priority: AlertPriority.MEDIUM, title: 'Inspeção obrigatória pendente', resolved: false },
      { type: AlertType.IDLE_AT_CLIENT, priority: AlertPriority.LOW, title: 'Barril ocioso há mais de 15 dias', resolved: true },
      { type: AlertType.DISPOSAL_SUGGESTED, priority: AlertPriority.MEDIUM, title: 'TCO elevado — descarte sugerido', resolved: false },
      { type: AlertType.CLIENT_DEACTIVATED_WITH_BARRELS, priority: AlertPriority.HIGH, title: 'Cliente inativado com barris pendentes', resolved: false },
      { type: AlertType.MAINTENANCE_DUE_ON_RETURN, priority: AlertPriority.MEDIUM, title: 'Manutenção necessária ao retornar barril', resolved: false },
    ];

    let alertsCreated = 0;
    for (let i = 0; i < alertScenarios.length; i++) {
      const scenario = alertScenarios[i];
      await prisma.alert.create({
        data: {
          tenantId: tenant.id,
          barrelId: createdBarrelIds[i],
          alertType: scenario.type,
          priority: scenario.priority,
          title: scenario.title,
          description: `Alerta de demonstração: ${scenario.title}`,
          resolvedAt: scenario.resolved ? new Date() : null,
          // Mantém status e resolvedAt em sincronia (evita alerta "resolvido"
          // ainda marcado como ACTIVE — inconsistencia entre contador e lista).
          status: scenario.resolved
            ? AlertStatus.RESOLVED
            : AlertStatus.ACTIVE,
          createdAt: new Date(Date.now() - (i + 1) * 3 * 24 * 60 * 60 * 1000),
        },
      });
      alertsCreated++;
    }
    console.log(`✅ Alerts: ${alertsCreated} created`);
  } else {
    console.log('⏭️ Alerts already seeded');
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
