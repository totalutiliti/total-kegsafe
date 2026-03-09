/**
 * KegSafe Database Audit Script
 *
 * Audita todas as tabelas do banco PostgreSQL verificando:
 * 1. Contagem de registros por tabela
 * 2. Foreign keys órfãs
 * 3. Dados duplicados que violam integridade lógica
 * 4. Campos NOT NULL com valores NULL
 * 5. Inconsistências específicas de negócio
 *
 * Uso: npx tsx prisma/audit-db.ts
 */

import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

interface AuditIssue {
  table: string;
  issue: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  count: number;
  details?: string;
  fixSql?: string;
}

const issues: AuditIssue[] = [];

function addIssue(issue: AuditIssue) {
  issues.push(issue);
}

async function query(sql: string, params?: any[]): Promise<any[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}

// ============================================================================
// 1. CONTAGEM DE REGISTROS POR TABELA
// ============================================================================
async function auditTableCounts() {
  console.log('\n========================================');
  console.log('1. CONTAGEM DE REGISTROS POR TABELA');
  console.log('========================================');

  const tables = [
    'tenants', 'users', 'refresh_tokens', 'barrels', 'component_configs',
    'component_cycles', 'logistics_events', 'maintenance_orders',
    'maintenance_logs', 'maintenance_items', 'triages', 'alerts',
    'geofences', 'disposals', 'clients', 'suppliers', 'service_providers',
    'audit_logs', 'super_admin_audit_logs', 'idempotency_keys',
    'barrel_sequences', 'ownership_history', 'barrel_batches', 'barrel_batch_prints'
  ];

  for (const table of tables) {
    try {
      const rows = await query(`SELECT COUNT(*) as count FROM "${table}"`);
      const count = parseInt(rows[0].count);

      // Check for soft-deleted records
      try {
        const softDeleted = await query(`SELECT COUNT(*) as count FROM "${table}" WHERE "deletedAt" IS NOT NULL`);
        const deletedCount = parseInt(softDeleted[0].count);
        console.log(`  ${table.padEnd(30)} ${String(count).padStart(8)} registros (${deletedCount} soft-deleted)`);
      } catch {
        console.log(`  ${table.padEnd(30)} ${String(count).padStart(8)} registros`);
      }
    } catch (e: any) {
      console.log(`  ${table.padEnd(30)} ERRO: ${e.message}`);
    }
  }

  // Also check for any tables we might have missed
  console.log('\n  --- Verificando tabelas adicionais no schema ---');
  const allTables = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const knownTables = new Set(tables);
  for (const row of allTables) {
    if (!knownTables.has(row.table_name) && row.table_name !== '_prisma_migrations') {
      const rows = await query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
      console.log(`  ${row.table_name.padEnd(30)} ${String(parseInt(rows[0].count)).padStart(8)} registros (NAO LISTADA NO SCHEMA)`);
    }
  }
}

// ============================================================================
// 2. FOREIGN KEYS ORFAS
// ============================================================================
async function auditOrphanedForeignKeys() {
  console.log('\n========================================');
  console.log('2. FOREIGN KEYS ORFAS');
  console.log('========================================');

  const fkChecks = [
    // users -> tenants
    { table: 'users', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'users.tenantId -> tenants.id' },

    // refresh_tokens -> users (no FK constraint in Prisma, but userId exists)
    { table: 'refresh_tokens', fk: 'userId', ref_table: 'users', ref_col: 'id', label: 'refresh_tokens.userId -> users.id' },

    // barrels -> tenants
    { table: 'barrels', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'barrels.tenantId -> tenants.id' },
    // barrels -> users (createdById)
    { table: 'barrels', fk: 'createdById', ref_table: 'users', ref_col: 'id', label: 'barrels.createdById -> users.id', nullable: true },
    // barrels -> users (updatedById)
    { table: 'barrels', fk: 'updatedById', ref_table: 'users', ref_col: 'id', label: 'barrels.updatedById -> users.id', nullable: true },

    // component_configs -> tenants
    { table: 'component_configs', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'component_configs.tenantId -> tenants.id' },

    // component_cycles -> barrels
    { table: 'component_cycles', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'component_cycles.barrelId -> barrels.id' },
    // component_cycles -> component_configs
    { table: 'component_cycles', fk: 'componentConfigId', ref_table: 'component_configs', ref_col: 'id', label: 'component_cycles.componentConfigId -> component_configs.id' },

    // logistics_events -> barrels
    { table: 'logistics_events', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'logistics_events.barrelId -> barrels.id' },
    // logistics_events -> users
    { table: 'logistics_events', fk: 'userId', ref_table: 'users', ref_col: 'id', label: 'logistics_events.userId -> users.id' },
    // logistics_events -> clients
    { table: 'logistics_events', fk: 'clientId', ref_table: 'clients', ref_col: 'id', label: 'logistics_events.clientId -> clients.id', nullable: true },

    // maintenance_orders -> barrels
    { table: 'maintenance_orders', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'maintenance_orders.barrelId -> barrels.id' },
    // maintenance_orders -> service_providers
    { table: 'maintenance_orders', fk: 'providerId', ref_table: 'service_providers', ref_col: 'id', label: 'maintenance_orders.providerId -> service_providers.id', nullable: true },

    // maintenance_logs -> barrels
    { table: 'maintenance_logs', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'maintenance_logs.barrelId -> barrels.id' },
    // maintenance_logs -> users
    { table: 'maintenance_logs', fk: 'userId', ref_table: 'users', ref_col: 'id', label: 'maintenance_logs.userId -> users.id' },
    // maintenance_logs -> maintenance_orders
    { table: 'maintenance_logs', fk: 'maintenanceOrderId', ref_table: 'maintenance_orders', ref_col: 'id', label: 'maintenance_logs.maintenanceOrderId -> maintenance_orders.id', nullable: true },

    // maintenance_items -> maintenance_logs
    { table: 'maintenance_items', fk: 'maintenanceLogId', ref_table: 'maintenance_logs', ref_col: 'id', label: 'maintenance_items.maintenanceLogId -> maintenance_logs.id' },
    // maintenance_items -> component_configs
    { table: 'maintenance_items', fk: 'componentConfigId', ref_table: 'component_configs', ref_col: 'id', label: 'maintenance_items.componentConfigId -> component_configs.id' },

    // triages -> barrels
    { table: 'triages', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'triages.barrelId -> barrels.id' },
    // triages -> users
    { table: 'triages', fk: 'userId', ref_table: 'users', ref_col: 'id', label: 'triages.userId -> users.id' },

    // alerts -> tenants
    { table: 'alerts', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'alerts.tenantId -> tenants.id' },
    // alerts -> barrels
    { table: 'alerts', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'alerts.barrelId -> barrels.id', nullable: true },

    // geofences -> tenants
    { table: 'geofences', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'geofences.tenantId -> tenants.id' },
    // geofences -> clients
    { table: 'geofences', fk: 'clientId', ref_table: 'clients', ref_col: 'id', label: 'geofences.clientId -> clients.id', nullable: true },

    // disposals -> barrels
    { table: 'disposals', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'disposals.barrelId -> barrels.id' },
    // disposals -> users (requestedById)
    { table: 'disposals', fk: 'requestedById', ref_table: 'users', ref_col: 'id', label: 'disposals.requestedById -> users.id' },
    // disposals -> users (approvedById)
    { table: 'disposals', fk: 'approvedById', ref_table: 'users', ref_col: 'id', label: 'disposals.approvedById -> users.id', nullable: true },

    // clients -> tenants
    { table: 'clients', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'clients.tenantId -> tenants.id' },

    // suppliers -> tenants
    { table: 'suppliers', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'suppliers.tenantId -> tenants.id' },

    // service_providers -> tenants
    { table: 'service_providers', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'service_providers.tenantId -> tenants.id' },

    // audit_logs -> tenants
    { table: 'audit_logs', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'audit_logs.tenantId -> tenants.id' },
    // audit_logs -> users
    { table: 'audit_logs', fk: 'userId', ref_table: 'users', ref_col: 'id', label: 'audit_logs.userId -> users.id', nullable: true },

    // super_admin_audit_logs -> users
    { table: 'super_admin_audit_logs', fk: 'userId', ref_table: 'users', ref_col: 'id', label: 'super_admin_audit_logs.userId -> users.id' },

    // ownership_history -> barrels
    { table: 'ownership_history', fk: 'barrelId', ref_table: 'barrels', ref_col: 'id', label: 'ownership_history.barrelId -> barrels.id' },
    // ownership_history -> tenants (from)
    { table: 'ownership_history', fk: 'fromTenantId', ref_table: 'tenants', ref_col: 'id', label: 'ownership_history.fromTenantId -> tenants.id' },
    // ownership_history -> tenants (to)
    { table: 'ownership_history', fk: 'toTenantId', ref_table: 'tenants', ref_col: 'id', label: 'ownership_history.toTenantId -> tenants.id' },

    // barrel_batches -> tenants
    { table: 'barrel_batches', fk: 'tenantId', ref_table: 'tenants', ref_col: 'id', label: 'barrel_batches.tenantId -> tenants.id', nullable: true },

    // barrel_batch_prints -> barrel_batches
    { table: 'barrel_batch_prints', fk: 'batchId', ref_table: 'barrel_batches', ref_col: 'id', label: 'barrel_batch_prints.batchId -> barrel_batches.id' },

    // barrels -> lastClientId (logical FK, not Prisma relation but business logic)
    { table: 'barrels', fk: 'lastClientId', ref_table: 'clients', ref_col: 'id', label: 'barrels.lastClientId -> clients.id (logical)', nullable: true },
  ];

  for (const check of fkChecks) {
    try {
      const nullClause = check.nullable ? `AND t."${check.fk}" IS NOT NULL` : '';
      const rows = await query(`
        SELECT COUNT(*) as count
        FROM "${check.table}" t
        LEFT JOIN "${check.ref_table}" r ON t."${check.fk}" = r."id"
        WHERE r."id" IS NULL ${nullClause}
      `);
      const count = parseInt(rows[0].count);
      if (count > 0) {
        console.log(`  [PROBLEMA] ${check.label}: ${count} registros orfaos`);

        // Get sample IDs
        const samples = await query(`
          SELECT t."id", t."${check.fk}" as fk_value
          FROM "${check.table}" t
          LEFT JOIN "${check.ref_table}" r ON t."${check.fk}" = r."id"
          WHERE r."id" IS NULL ${nullClause}
          LIMIT 5
        `);

        addIssue({
          table: check.table,
          issue: `FK orfã: ${check.label}`,
          severity: 'CRITICAL',
          count,
          details: `Exemplos: ${samples.map(s => `id=${s.id}, ${check.fk}=${s.fk_value}`).join('; ')}`,
          fixSql: `-- Opção 1: Deletar registros órfãos
DELETE FROM "${check.table}" t
WHERE NOT EXISTS (
  SELECT 1 FROM "${check.ref_table}" r WHERE r."id" = t."${check.fk}"
) ${nullClause ? `AND t."${check.fk}" IS NOT NULL` : ''};

-- Opção 2: Setar NULL (se a coluna permitir)
UPDATE "${check.table}" t
SET "${check.fk}" = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "${check.ref_table}" r WHERE r."id" = t."${check.fk}"
) ${nullClause ? `AND t."${check.fk}" IS NOT NULL` : ''};`
        });
      } else {
        console.log(`  [OK] ${check.label}`);
      }
    } catch (e: any) {
      console.log(`  [ERRO] ${check.label}: ${e.message}`);
    }
  }
}

// ============================================================================
// 3. UNICIDADE E DUPLICATAS
// ============================================================================
async function auditDuplicates() {
  console.log('\n========================================');
  console.log('3. DUPLICATAS E VIOLACOES DE UNICIDADE');
  console.log('========================================');

  // 3.1 barrels: internalCode unico por tenant
  console.log('\n  --- barrels: internalCode unico por tenant ---');
  const barrelCodeDups = await query(`
    SELECT "tenantId", "internalCode", COUNT(*) as cnt
    FROM barrels
    WHERE "deletedAt" IS NULL
    GROUP BY "tenantId", "internalCode"
    HAVING COUNT(*) > 1
  `);
  if (barrelCodeDups.length > 0) {
    console.log(`  [PROBLEMA] ${barrelCodeDups.length} internalCodes duplicados`);
    for (const d of barrelCodeDups) {
      console.log(`    tenant=${d.tenantId}, code=${d.internalCode}, count=${d.cnt}`);
    }
    addIssue({
      table: 'barrels',
      issue: 'internalCode duplicado por tenant (excluindo soft-deleted)',
      severity: 'HIGH',
      count: barrelCodeDups.reduce((sum: number, d: any) => sum + parseInt(d.cnt) - 1, 0),
      details: barrelCodeDups.map((d: any) => `tenant=${d.tenantId}, code=${d.internalCode}, count=${d.cnt}`).join('; '),
    });
  } else {
    console.log('  [OK] Nenhum internalCode duplicado');
  }

  // 3.2 barrels: qrCode unico por tenant (se não NULL)
  console.log('\n  --- barrels: qrCode unico por tenant ---');
  const barrelQrDups = await query(`
    SELECT "tenantId", "qrCode", COUNT(*) as cnt
    FROM barrels
    WHERE "qrCode" IS NOT NULL AND "deletedAt" IS NULL
    GROUP BY "tenantId", "qrCode"
    HAVING COUNT(*) > 1
  `);
  if (barrelQrDups.length > 0) {
    console.log(`  [PROBLEMA] ${barrelQrDups.length} qrCodes duplicados`);
    for (const d of barrelQrDups) {
      console.log(`    tenant=${d.tenantId}, qrCode=${d.qrCode}, count=${d.cnt}`);
    }
    addIssue({
      table: 'barrels',
      issue: 'qrCode duplicado por tenant (excluindo soft-deleted)',
      severity: 'HIGH',
      count: barrelQrDups.reduce((sum: number, d: any) => sum + parseInt(d.cnt) - 1, 0),
      details: barrelQrDups.map((d: any) => `tenant=${d.tenantId}, qrCode=${d.qrCode}, count=${d.cnt}`).join('; '),
    });
  } else {
    console.log('  [OK] Nenhum qrCode duplicado');
  }

  // 3.3 barrels: chassisNumber unico por tenant (se não NULL)
  console.log('\n  --- barrels: chassisNumber unico por tenant ---');
  const barrelChassisDups = await query(`
    SELECT "tenantId", "chassisNumber", COUNT(*) as cnt
    FROM barrels
    WHERE "chassisNumber" IS NOT NULL AND "deletedAt" IS NULL
    GROUP BY "tenantId", "chassisNumber"
    HAVING COUNT(*) > 1
  `);
  if (barrelChassisDups.length > 0) {
    console.log(`  [PROBLEMA] ${barrelChassisDups.length} chassisNumbers duplicados`);
    addIssue({
      table: 'barrels',
      issue: 'chassisNumber duplicado por tenant',
      severity: 'HIGH',
      count: barrelChassisDups.reduce((sum: number, d: any) => sum + parseInt(d.cnt) - 1, 0),
      details: barrelChassisDups.map((d: any) => `tenant=${d.tenantId}, chassis=${d.chassisNumber}, count=${d.cnt}`).join('; '),
    });
  } else {
    console.log('  [OK] Nenhum chassisNumber duplicado');
  }

  // 3.4 users: email unico por tenant
  console.log('\n  --- users: email unico por tenant ---');
  const userEmailDups = await query(`
    SELECT "tenantId", "email", COUNT(*) as cnt
    FROM users
    WHERE "deletedAt" IS NULL
    GROUP BY "tenantId", "email"
    HAVING COUNT(*) > 1
  `);
  if (userEmailDups.length > 0) {
    console.log(`  [PROBLEMA] ${userEmailDups.length} emails duplicados por tenant`);
    for (const d of userEmailDups) {
      console.log(`    tenant=${d.tenantId}, email=${d.email}, count=${d.cnt}`);
    }
    addIssue({
      table: 'users',
      issue: 'email duplicado por tenant (excluindo soft-deleted)',
      severity: 'HIGH',
      count: userEmailDups.reduce((sum: number, d: any) => sum + parseInt(d.cnt) - 1, 0),
      details: userEmailDups.map((d: any) => `tenant=${d.tenantId}, email=${d.email}, count=${d.cnt}`).join('; '),
    });
  } else {
    console.log('  [OK] Nenhum email duplicado por tenant');
  }

  // 3.5 tenants: CNPJ unico
  console.log('\n  --- tenants: CNPJ unico ---');
  const tenantCnpjDups = await query(`
    SELECT cnpj, COUNT(*) as cnt
    FROM tenants
    GROUP BY cnpj
    HAVING COUNT(*) > 1
  `);
  if (tenantCnpjDups.length > 0) {
    console.log(`  [PROBLEMA] ${tenantCnpjDups.length} CNPJs duplicados`);
    addIssue({ table: 'tenants', issue: 'CNPJ duplicado', severity: 'CRITICAL', count: tenantCnpjDups.length });
  } else {
    console.log('  [OK] Nenhum CNPJ duplicado');
  }

  // 3.6 tenants: slug unico
  console.log('\n  --- tenants: slug unico ---');
  const tenantSlugDups = await query(`
    SELECT slug, COUNT(*) as cnt
    FROM tenants
    GROUP BY slug
    HAVING COUNT(*) > 1
  `);
  if (tenantSlugDups.length > 0) {
    console.log(`  [PROBLEMA] ${tenantSlugDups.length} slugs duplicados`);
    addIssue({ table: 'tenants', issue: 'slug duplicado', severity: 'HIGH', count: tenantSlugDups.length });
  } else {
    console.log('  [OK] Nenhum slug duplicado');
  }

  // 3.7 clients: CNPJ unico por tenant (se nao NULL)
  console.log('\n  --- clients: CNPJ unico por tenant ---');
  const clientCnpjDups = await query(`
    SELECT "tenantId", cnpj, COUNT(*) as cnt
    FROM clients
    WHERE cnpj IS NOT NULL AND "deletedAt" IS NULL
    GROUP BY "tenantId", cnpj
    HAVING COUNT(*) > 1
  `);
  if (clientCnpjDups.length > 0) {
    console.log(`  [PROBLEMA] ${clientCnpjDups.length} CNPJs de clientes duplicados`);
    addIssue({
      table: 'clients',
      issue: 'CNPJ duplicado por tenant',
      severity: 'MEDIUM',
      count: clientCnpjDups.reduce((sum: number, d: any) => sum + parseInt(d.cnt) - 1, 0),
      details: clientCnpjDups.map((d: any) => `tenant=${d.tenantId}, cnpj=${d.cnpj}, count=${d.cnt}`).join('; '),
    });
  } else {
    console.log('  [OK] Nenhum CNPJ de cliente duplicado');
  }

  // 3.8 component_configs: nome unico por tenant
  console.log('\n  --- component_configs: nome unico por tenant ---');
  const compCfgDups = await query(`
    SELECT "tenantId", name, COUNT(*) as cnt
    FROM component_configs
    WHERE "deletedAt" IS NULL
    GROUP BY "tenantId", name
    HAVING COUNT(*) > 1
  `);
  if (compCfgDups.length > 0) {
    console.log(`  [PROBLEMA] ${compCfgDups.length} nomes de component_config duplicados`);
    addIssue({
      table: 'component_configs',
      issue: 'Nome de componente duplicado por tenant',
      severity: 'MEDIUM',
      count: compCfgDups.reduce((sum: number, d: any) => sum + parseInt(d.cnt) - 1, 0),
    });
  } else {
    console.log('  [OK] Nenhum nome duplicado');
  }

  // 3.9 component_cycles: unicidade barrelId + componentConfigId
  console.log('\n  --- component_cycles: unicidade barrelId + componentConfigId ---');
  const cycleDups = await query(`
    SELECT "barrelId", "componentConfigId", COUNT(*) as cnt
    FROM component_cycles
    GROUP BY "barrelId", "componentConfigId"
    HAVING COUNT(*) > 1
  `);
  if (cycleDups.length > 0) {
    console.log(`  [PROBLEMA] ${cycleDups.length} ciclos duplicados (barrelId + componentConfigId)`);
    addIssue({
      table: 'component_cycles',
      issue: 'Duplicata barrelId + componentConfigId',
      severity: 'CRITICAL',
      count: cycleDups.reduce((sum: number, d: any) => sum + parseInt(d.cnt) - 1, 0),
    });
  } else {
    console.log('  [OK] Nenhum ciclo duplicado');
  }
}

// ============================================================================
// 4. COMPONENT_CYCLES COMPLETENESS
// ============================================================================
async function auditComponentCycles() {
  console.log('\n========================================');
  console.log('4. COMPONENT_CYCLES - COMPLETUDE');
  console.log('========================================');

  // Cada barril ativo (nao soft-deleted) de um tenant deve ter um cycle para cada config ativa daquele tenant
  const missingCycles = await query(`
    SELECT
      b.id as barrel_id,
      b."internalCode",
      b."tenantId",
      cc.id as config_id,
      cc.name as config_name
    FROM barrels b
    CROSS JOIN component_configs cc
    LEFT JOIN component_cycles cy ON cy."barrelId" = b.id AND cy."componentConfigId" = cc.id
    WHERE b."tenantId" = cc."tenantId"
      AND b."deletedAt" IS NULL
      AND cc."deletedAt" IS NULL
      AND cc."isActive" = true
      AND b.status NOT IN ('DISPOSED', 'LOST')
      AND cy.id IS NULL
    ORDER BY b."tenantId", b."internalCode", cc.name
  `);

  if (missingCycles.length > 0) {
    console.log(`  [PROBLEMA] ${missingCycles.length} component_cycles faltando`);

    // Group by tenant for readability
    const byTenant: Record<string, any[]> = {};
    for (const m of missingCycles) {
      if (!byTenant[m.tenantId]) byTenant[m.tenantId] = [];
      byTenant[m.tenantId].push(m);
    }
    for (const [tenantId, items] of Object.entries(byTenant)) {
      console.log(`    Tenant ${tenantId}: ${items.length} ciclos faltando`);
      const sample = items.slice(0, 5);
      for (const s of sample) {
        console.log(`      barril=${s.internalCode}, componente=${s.config_name}`);
      }
      if (items.length > 5) console.log(`      ... e mais ${items.length - 5}`);
    }

    addIssue({
      table: 'component_cycles',
      issue: 'Barris sem component_cycle para todas as configs ativas do tenant',
      severity: 'HIGH',
      count: missingCycles.length,
      details: `Distribuicao por tenant: ${Object.entries(byTenant).map(([t, i]) => `${t}: ${i.length}`).join(', ')}`,
      fixSql: `-- Inserir cycles faltantes com valores default
INSERT INTO component_cycles (id, "barrelId", "componentConfigId", "cyclesSinceLastService", "healthScore", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  b.id,
  cc.id,
  0,
  'GREEN',
  NOW(),
  NOW()
FROM barrels b
CROSS JOIN component_configs cc
LEFT JOIN component_cycles cy ON cy."barrelId" = b.id AND cy."componentConfigId" = cc.id
WHERE b."tenantId" = cc."tenantId"
  AND b."deletedAt" IS NULL
  AND cc."deletedAt" IS NULL
  AND cc."isActive" = true
  AND b.status NOT IN ('DISPOSED', 'LOST')
  AND cy.id IS NULL;`
    });
  } else {
    console.log('  [OK] Todos os barris tem cycles para todas as configs ativas');
  }
}

// ============================================================================
// 5. BARREL_SEQUENCES CONSISTENCY
// ============================================================================
async function auditBarrelSequences() {
  console.log('\n========================================');
  console.log('5. BARREL_SEQUENCES - CONSISTENCIA');
  console.log('========================================');

  const seqRows = await query(`SELECT key, "lastNumber" FROM barrel_sequences`);

  if (seqRows.length === 0) {
    console.log('  [PROBLEMA] Tabela barrel_sequences vazia!');
    addIssue({
      table: 'barrel_sequences',
      issue: 'Tabela vazia - nenhum registro de sequencia',
      severity: 'CRITICAL',
      count: 1,
      fixSql: `INSERT INTO barrel_sequences (key, "lastNumber", "updatedAt") VALUES ('global', 0, NOW());`
    });
  } else {
    const lastNumber = seqRows[0].lastNumber;
    console.log(`  Sequencia atual: lastNumber = ${lastNumber}`);

    // Encontrar o maior numero de barril existente
    const maxBarrelRows = await query(`
      SELECT "internalCode"
      FROM barrels
      ORDER BY "internalCode" DESC
      LIMIT 1
    `);

    if (maxBarrelRows.length > 0) {
      const maxCode = maxBarrelRows[0].internalCode;
      // Extract number from KS-BAR-NNNNNNNNN
      const match = maxCode.match(/KS-BAR-(\d+)/);
      if (match) {
        const maxNumber = parseInt(match[1]);
        console.log(`  Maior codigo existente: ${maxCode} (numero=${maxNumber})`);

        if (lastNumber < maxNumber) {
          console.log(`  [PROBLEMA] lastNumber (${lastNumber}) < maior numero existente (${maxNumber})`);
          addIssue({
            table: 'barrel_sequences',
            issue: `lastNumber (${lastNumber}) menor que maior numero de barril existente (${maxNumber})`,
            severity: 'CRITICAL',
            count: 1,
            details: `Diferenca: ${maxNumber - lastNumber}. Proximo barril criado pode ter codigo duplicado!`,
            fixSql: `UPDATE barrel_sequences SET "lastNumber" = ${maxNumber} WHERE key = 'global';`
          });
        } else {
          console.log(`  [OK] lastNumber (${lastNumber}) >= maior numero existente (${maxNumber})`);
          if (lastNumber > maxNumber) {
            console.log(`  [INFO] Gap de ${lastNumber - maxNumber} numeros (possivelmente lotes gerados sem barris)`);
            addIssue({
              table: 'barrel_sequences',
              issue: `Gap de ${lastNumber - maxNumber} numeros entre lastNumber e maior barril`,
              severity: 'INFO',
              count: lastNumber - maxNumber,
              details: 'Pode ser normal se lotes foram gerados mas barris ainda nao ativados',
            });
          }
        }
      }
    }
  }
}

// ============================================================================
// 6. GEOFENCES COORDINATES VALIDATION
// ============================================================================
async function auditGeofences() {
  console.log('\n========================================');
  console.log('6. GEOFENCES - COORDENADAS');
  console.log('========================================');

  // Latitude entre -90 e 90
  const badLat = await query(`
    SELECT id, name, latitude, longitude, "tenantId"
    FROM geofences
    WHERE "deletedAt" IS NULL
    AND (latitude < -90 OR latitude > 90)
  `);
  if (badLat.length > 0) {
    console.log(`  [PROBLEMA] ${badLat.length} geofences com latitude invalida`);
    for (const g of badLat) {
      console.log(`    id=${g.id}, name=${g.name}, lat=${g.latitude}`);
    }
    addIssue({
      table: 'geofences',
      issue: 'Latitude fora do range [-90, 90]',
      severity: 'HIGH',
      count: badLat.length,
      details: badLat.map(g => `id=${g.id}, name=${g.name}, lat=${g.latitude}`).join('; '),
    });
  } else {
    console.log('  [OK] Todas as latitudes estao no range valido');
  }

  // Longitude entre -180 e 180
  const badLon = await query(`
    SELECT id, name, latitude, longitude, "tenantId"
    FROM geofences
    WHERE "deletedAt" IS NULL
    AND (longitude < -180 OR longitude > 180)
  `);
  if (badLon.length > 0) {
    console.log(`  [PROBLEMA] ${badLon.length} geofences com longitude invalida`);
    for (const g of badLon) {
      console.log(`    id=${g.id}, name=${g.name}, lon=${g.longitude}`);
    }
    addIssue({
      table: 'geofences',
      issue: 'Longitude fora do range [-180, 180]',
      severity: 'HIGH',
      count: badLon.length,
      details: badLon.map(g => `id=${g.id}, name=${g.name}, lon=${g.longitude}`).join('; '),
    });
  } else {
    console.log('  [OK] Todas as longitudes estao no range valido');
  }

  // Coordenadas (0, 0) - provavelmente invalidas
  const zeroCoords = await query(`
    SELECT id, name, "tenantId"
    FROM geofences
    WHERE "deletedAt" IS NULL
    AND latitude = 0 AND longitude = 0
  `);
  if (zeroCoords.length > 0) {
    console.log(`  [AVISO] ${zeroCoords.length} geofences com coordenadas (0, 0) - possivelmente invalidas`);
    addIssue({
      table: 'geofences',
      issue: 'Coordenadas (0,0) - provavelmente nao intencionais',
      severity: 'MEDIUM',
      count: zeroCoords.length,
      details: zeroCoords.map(g => `id=${g.id}, name=${g.name}`).join('; '),
    });
  } else {
    console.log('  [OK] Nenhuma geofence com coordenadas (0,0)');
  }

  // Raio invalido
  const badRadius = await query(`
    SELECT id, name, "radiusMeters"
    FROM geofences
    WHERE "deletedAt" IS NULL
    AND ("radiusMeters" <= 0 OR "radiusMeters" > 100000)
  `);
  if (badRadius.length > 0) {
    console.log(`  [PROBLEMA] ${badRadius.length} geofences com raio invalido`);
    addIssue({
      table: 'geofences',
      issue: 'Raio invalido (<=0 ou >100km)',
      severity: 'MEDIUM',
      count: badRadius.length,
    });
  } else {
    console.log('  [OK] Todos os raios estao em range valido');
  }
}

// ============================================================================
// 7. BARREL STATUS CONSISTENCY
// ============================================================================
async function auditBarrelStatus() {
  console.log('\n========================================');
  console.log('7. BARRELS - CONSISTENCIA DE STATUS');
  console.log('========================================');

  // Barris IN_MAINTENANCE sem OS pendente/em andamento
  const inMaintNoOs = await query(`
    SELECT b.id, b."internalCode", b."tenantId"
    FROM barrels b
    WHERE b.status = 'IN_MAINTENANCE'
      AND b."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM maintenance_orders mo
        WHERE mo."barrelId" = b.id
        AND mo.status IN ('PENDING', 'IN_PROGRESS')
        AND mo."deletedAt" IS NULL
      )
  `);
  if (inMaintNoOs.length > 0) {
    console.log(`  [PROBLEMA] ${inMaintNoOs.length} barris IN_MAINTENANCE sem OS pendente/em andamento`);
    for (const b of inMaintNoOs.slice(0, 10)) {
      console.log(`    barril=${b.internalCode}, tenant=${b.tenantId}`);
    }
    addIssue({
      table: 'barrels',
      issue: 'Status IN_MAINTENANCE sem OS ativa (PENDING ou IN_PROGRESS)',
      severity: 'MEDIUM',
      count: inMaintNoOs.length,
      details: inMaintNoOs.slice(0, 10).map(b => b.internalCode).join(', '),
      fixSql: `-- Verificar manualmente cada caso. Possivelmente devem voltar a ACTIVE:
-- UPDATE barrels SET status = 'ACTIVE' WHERE id IN (...) AND "deletedAt" IS NULL;`
    });
  } else {
    console.log('  [OK] Todos os barris IN_MAINTENANCE tem OS ativa');
  }

  // Barris DISPOSED sem registro de disposal
  const disposedNoDsp = await query(`
    SELECT b.id, b."internalCode", b."tenantId"
    FROM barrels b
    WHERE b.status = 'DISPOSED'
      AND b."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM disposals d
        WHERE d."barrelId" = b.id
        AND d.status IN ('APPROVED', 'COMPLETED')
      )
  `);
  if (disposedNoDsp.length > 0) {
    console.log(`  [PROBLEMA] ${disposedNoDsp.length} barris DISPOSED sem disposal aprovado/completado`);
    addIssue({
      table: 'barrels',
      issue: 'Status DISPOSED sem registro de disposal aprovado/completado',
      severity: 'MEDIUM',
      count: disposedNoDsp.length,
    });
  } else {
    console.log('  [OK] Todos os barris DISPOSED tem disposal correspondente');
  }

  // Distribuicao de status
  console.log('\n  --- Distribuicao de status dos barris ---');
  const statusDist = await query(`
    SELECT status, COUNT(*) as cnt
    FROM barrels
    WHERE "deletedAt" IS NULL
    GROUP BY status
    ORDER BY cnt DESC
  `);
  for (const s of statusDist) {
    console.log(`    ${s.status.padEnd(20)} ${s.cnt}`);
  }

  // Barris com totalCycles negativo
  const negCycles = await query(`
    SELECT id, "internalCode", "totalCycles"
    FROM barrels
    WHERE "totalCycles" < 0
  `);
  if (negCycles.length > 0) {
    console.log(`  [PROBLEMA] ${negCycles.length} barris com totalCycles negativo`);
    addIssue({
      table: 'barrels',
      issue: 'totalCycles negativo',
      severity: 'HIGH',
      count: negCycles.length,
    });
  } else {
    console.log('  [OK] Nenhum barril com totalCycles negativo');
  }

  // Barris com totalMaintenanceCost negativo
  const negCost = await query(`
    SELECT id, "internalCode", "totalMaintenanceCost"
    FROM barrels
    WHERE "totalMaintenanceCost" < 0
  `);
  if (negCost.length > 0) {
    console.log(`  [PROBLEMA] ${negCost.length} barris com totalMaintenanceCost negativo`);
    addIssue({
      table: 'barrels',
      issue: 'totalMaintenanceCost negativo',
      severity: 'HIGH',
      count: negCost.length,
    });
  } else {
    console.log('  [OK] Nenhum barril com totalMaintenanceCost negativo');
  }
}

// ============================================================================
// 8. LOGISTICS EVENTS CONSISTENCY
// ============================================================================
async function auditLogisticsEvents() {
  console.log('\n========================================');
  console.log('8. LOGISTICS_EVENTS - CONSISTENCIA');
  console.log('========================================');

  // Eventos de DELIVERY/COLLECTION sem clientId
  const noClient = await query(`
    SELECT id, "barrelId", "actionType", "tenantId"
    FROM logistics_events
    WHERE "actionType" IN ('DELIVERY', 'COLLECTION')
    AND "clientId" IS NULL
  `);
  if (noClient.length > 0) {
    console.log(`  [PROBLEMA] ${noClient.length} eventos DELIVERY/COLLECTION sem clientId`);
    addIssue({
      table: 'logistics_events',
      issue: 'Eventos DELIVERY/COLLECTION sem clientId',
      severity: 'MEDIUM',
      count: noClient.length,
    });
  } else {
    console.log('  [OK] Todos os DELIVERY/COLLECTION tem clientId');
  }

  // Coordenadas invalidas em eventos
  const badCoords = await query(`
    SELECT id, latitude, longitude, "actionType"
    FROM logistics_events
    WHERE latitude < -90 OR latitude > 90
    OR longitude < -180 OR longitude > 180
  `);
  if (badCoords.length > 0) {
    console.log(`  [PROBLEMA] ${badCoords.length} eventos com coordenadas invalidas`);
    addIssue({
      table: 'logistics_events',
      issue: 'Coordenadas fora do range valido',
      severity: 'MEDIUM',
      count: badCoords.length,
    });
  } else {
    console.log('  [OK] Todas as coordenadas de eventos estao validas');
  }

  // Distribuicao de tipos de evento
  console.log('\n  --- Distribuicao de tipos de evento ---');
  const eventDist = await query(`
    SELECT "actionType", COUNT(*) as cnt
    FROM logistics_events
    GROUP BY "actionType"
    ORDER BY cnt DESC
  `);
  for (const e of eventDist) {
    console.log(`    ${e.actionType.padEnd(20)} ${e.cnt}`);
  }
}

// ============================================================================
// 9. MAINTENANCE ORDERS CONSISTENCY
// ============================================================================
async function auditMaintenanceOrders() {
  console.log('\n========================================');
  console.log('9. MAINTENANCE_ORDERS - CONSISTENCIA');
  console.log('========================================');

  // OS COMPLETED sem completedAt
  const completedNoDate = await query(`
    SELECT id, "orderNumber", "tenantId"
    FROM maintenance_orders
    WHERE status = 'COMPLETED' AND "completedAt" IS NULL
    AND "deletedAt" IS NULL
  `);
  if (completedNoDate.length > 0) {
    console.log(`  [PROBLEMA] ${completedNoDate.length} OS COMPLETED sem completedAt`);
    addIssue({
      table: 'maintenance_orders',
      issue: 'OS com status COMPLETED mas sem completedAt',
      severity: 'MEDIUM',
      count: completedNoDate.length,
      fixSql: `UPDATE maintenance_orders SET "completedAt" = "updatedAt" WHERE status = 'COMPLETED' AND "completedAt" IS NULL;`
    });
  } else {
    console.log('  [OK] Todas as OS COMPLETED tem completedAt');
  }

  // OS com completedAt mas status nao COMPLETED
  const dateNotCompleted = await query(`
    SELECT id, "orderNumber", status, "tenantId"
    FROM maintenance_orders
    WHERE status != 'COMPLETED' AND "completedAt" IS NOT NULL
    AND "deletedAt" IS NULL
  `);
  if (dateNotCompleted.length > 0) {
    console.log(`  [PROBLEMA] ${dateNotCompleted.length} OS com completedAt mas status != COMPLETED`);
    addIssue({
      table: 'maintenance_orders',
      issue: 'OS com completedAt preenchido mas status diferente de COMPLETED',
      severity: 'LOW',
      count: dateNotCompleted.length,
    });
  } else {
    console.log('  [OK] Nenhuma OS com data de conclusao inconsistente');
  }

  // Distribuicao de status
  console.log('\n  --- Distribuicao de status das OS ---');
  const osDist = await query(`
    SELECT status, COUNT(*) as cnt
    FROM maintenance_orders
    WHERE "deletedAt" IS NULL
    GROUP BY status
    ORDER BY cnt DESC
  `);
  for (const o of osDist) {
    console.log(`    ${o.status.padEnd(20)} ${o.cnt}`);
  }
}

// ============================================================================
// 10. ALERTS CONSISTENCY
// ============================================================================
async function auditAlerts() {
  console.log('\n========================================');
  console.log('10. ALERTS - CONSISTENCIA');
  console.log('========================================');

  // Alertas ACTIVE referenciando barris deletados
  const alertDeletedBarrels = await query(`
    SELECT a.id, a.title, a."alertType", a."barrelId"
    FROM alerts a
    JOIN barrels b ON a."barrelId" = b.id
    WHERE a.status = 'ACTIVE'
    AND b."deletedAt" IS NOT NULL
  `);
  if (alertDeletedBarrels.length > 0) {
    console.log(`  [PROBLEMA] ${alertDeletedBarrels.length} alertas ativos para barris soft-deleted`);
    addIssue({
      table: 'alerts',
      issue: 'Alertas ACTIVE referenciando barris soft-deleted',
      severity: 'MEDIUM',
      count: alertDeletedBarrels.length,
      fixSql: `UPDATE alerts SET status = 'RESOLVED', "resolvedAt" = NOW(), "resolutionNotes" = 'Auto-resolvido: barril deletado'
WHERE status = 'ACTIVE' AND "barrelId" IN (SELECT id FROM barrels WHERE "deletedAt" IS NOT NULL);`
    });
  } else {
    console.log('  [OK] Nenhum alerta ativo para barris deletados');
  }

  // Alertas ACTIVE referenciando barris DISPOSED
  const alertDisposedBarrels = await query(`
    SELECT a.id, a.title, a."alertType", a."barrelId"
    FROM alerts a
    JOIN barrels b ON a."barrelId" = b.id
    WHERE a.status = 'ACTIVE'
    AND b.status = 'DISPOSED'
  `);
  if (alertDisposedBarrels.length > 0) {
    console.log(`  [PROBLEMA] ${alertDisposedBarrels.length} alertas ativos para barris DISPOSED`);
    addIssue({
      table: 'alerts',
      issue: 'Alertas ACTIVE referenciando barris com status DISPOSED',
      severity: 'MEDIUM',
      count: alertDisposedBarrels.length,
      fixSql: `UPDATE alerts SET status = 'RESOLVED', "resolvedAt" = NOW(), "resolutionNotes" = 'Auto-resolvido: barril descartado'
WHERE status = 'ACTIVE' AND "barrelId" IN (SELECT id FROM barrels WHERE status = 'DISPOSED');`
    });
  } else {
    console.log('  [OK] Nenhum alerta ativo para barris descartados');
  }

  // Distribuicao de alertas
  console.log('\n  --- Distribuicao de alertas por tipo e status ---');
  const alertDist = await query(`
    SELECT "alertType", status, COUNT(*) as cnt
    FROM alerts
    GROUP BY "alertType", status
    ORDER BY cnt DESC
  `);
  for (const a of alertDist) {
    console.log(`    ${a.alertType.padEnd(40)} ${a.status.padEnd(15)} ${a.cnt}`);
  }
}

// ============================================================================
// 11. NOT NULL VIOLATIONS (using information_schema)
// ============================================================================
async function auditNotNullViolations() {
  console.log('\n========================================');
  console.log('11. NOT NULL - CAMPOS OBRIGATORIOS');
  console.log('========================================');

  // Check key NOT NULL columns that business logic depends on
  const checks = [
    { table: 'barrels', col: 'tenantId', label: 'barrels.tenantId' },
    { table: 'barrels', col: 'internalCode', label: 'barrels.internalCode' },
    { table: 'barrels', col: 'status', label: 'barrels.status' },
    { table: 'barrels', col: 'capacityLiters', label: 'barrels.capacityLiters' },
    { table: 'barrels', col: 'material', label: 'barrels.material' },
    { table: 'users', col: 'tenantId', label: 'users.tenantId' },
    { table: 'users', col: 'email', label: 'users.email' },
    { table: 'users', col: 'passwordHash', label: 'users.passwordHash' },
    { table: 'users', col: 'name', label: 'users.name' },
    { table: 'users', col: 'role', label: 'users.role' },
    { table: 'logistics_events', col: 'barrelId', label: 'logistics_events.barrelId' },
    { table: 'logistics_events', col: 'userId', label: 'logistics_events.userId' },
    { table: 'logistics_events', col: 'actionType', label: 'logistics_events.actionType' },
    { table: 'maintenance_orders', col: 'barrelId', label: 'maintenance_orders.barrelId' },
    { table: 'maintenance_orders', col: 'tenantId', label: 'maintenance_orders.tenantId' },
    { table: 'maintenance_orders', col: 'orderNumber', label: 'maintenance_orders.orderNumber' },
    { table: 'alerts', col: 'tenantId', label: 'alerts.tenantId' },
    { table: 'alerts', col: 'alertType', label: 'alerts.alertType' },
    { table: 'alerts', col: 'title', label: 'alerts.title' },
    { table: 'clients', col: 'tenantId', label: 'clients.tenantId' },
    { table: 'clients', col: 'name', label: 'clients.name' },
    { table: 'geofences', col: 'tenantId', label: 'geofences.tenantId' },
    { table: 'geofences', col: 'name', label: 'geofences.name' },
    { table: 'geofences', col: 'latitude', label: 'geofences.latitude' },
    { table: 'geofences', col: 'longitude', label: 'geofences.longitude' },
    { table: 'component_configs', col: 'tenantId', label: 'component_configs.tenantId' },
    { table: 'component_configs', col: 'name', label: 'component_configs.name' },
    { table: 'component_configs', col: 'maxCycles', label: 'component_configs.maxCycles' },
    { table: 'component_configs', col: 'maxDays', label: 'component_configs.maxDays' },
    { table: 'component_cycles', col: 'barrelId', label: 'component_cycles.barrelId' },
    { table: 'component_cycles', col: 'componentConfigId', label: 'component_cycles.componentConfigId' },
  ];

  let allOk = true;
  for (const check of checks) {
    try {
      const rows = await query(`SELECT COUNT(*) as count FROM "${check.table}" WHERE "${check.col}" IS NULL`);
      const count = parseInt(rows[0].count);
      if (count > 0) {
        allOk = false;
        console.log(`  [PROBLEMA] ${check.label}: ${count} registros com NULL`);
        addIssue({
          table: check.table,
          issue: `Campo obrigatorio ${check.col} com valor NULL`,
          severity: 'CRITICAL',
          count,
        });
      }
    } catch {
      // Column might not exist or is truly NOT NULL at DB level
    }
  }
  if (allOk) {
    console.log('  [OK] Todos os campos obrigatorios verificados estao preenchidos');
  }
}

// ============================================================================
// 12. TENANT ISOLATION CHECK
// ============================================================================
async function auditTenantIsolation() {
  console.log('\n========================================');
  console.log('12. ISOLAMENTO MULTI-TENANT');
  console.log('========================================');

  // component_cycles: barrelId deve pertencer ao mesmo tenant que componentConfigId
  const crossTenantCycles = await query(`
    SELECT cy.id, b."tenantId" as barrel_tenant, cc."tenantId" as config_tenant
    FROM component_cycles cy
    JOIN barrels b ON cy."barrelId" = b.id
    JOIN component_configs cc ON cy."componentConfigId" = cc.id
    WHERE b."tenantId" != cc."tenantId"
  `);
  if (crossTenantCycles.length > 0) {
    console.log(`  [PROBLEMA] ${crossTenantCycles.length} component_cycles com cross-tenant (barrel e config de tenants diferentes)`);
    addIssue({
      table: 'component_cycles',
      issue: 'Registros cross-tenant: barrelId e componentConfigId pertencem a tenants diferentes',
      severity: 'CRITICAL',
      count: crossTenantCycles.length,
    });
  } else {
    console.log('  [OK] component_cycles: isolamento de tenant OK');
  }

  // logistics_events: barrelId deve ter mesmo tenantId do evento
  const crossTenantEvents = await query(`
    SELECT le.id, le."tenantId" as event_tenant, b."tenantId" as barrel_tenant
    FROM logistics_events le
    JOIN barrels b ON le."barrelId" = b.id
    WHERE le."tenantId" != b."tenantId"
  `);
  if (crossTenantEvents.length > 0) {
    console.log(`  [PROBLEMA] ${crossTenantEvents.length} logistics_events com tenantId diferente do barril`);
    addIssue({
      table: 'logistics_events',
      issue: 'Eventos com tenantId diferente do tenantId do barril referenciado',
      severity: 'CRITICAL',
      count: crossTenantEvents.length,
    });
  } else {
    console.log('  [OK] logistics_events: isolamento de tenant OK');
  }

  // maintenance_orders: barrelId deve ter mesmo tenantId da OS
  const crossTenantOS = await query(`
    SELECT mo.id, mo."tenantId" as os_tenant, b."tenantId" as barrel_tenant
    FROM maintenance_orders mo
    JOIN barrels b ON mo."barrelId" = b.id
    WHERE mo."tenantId" != b."tenantId"
  `);
  if (crossTenantOS.length > 0) {
    console.log(`  [PROBLEMA] ${crossTenantOS.length} maintenance_orders com tenantId diferente do barril`);
    addIssue({
      table: 'maintenance_orders',
      issue: 'OS com tenantId diferente do tenantId do barril',
      severity: 'CRITICAL',
      count: crossTenantOS.length,
    });
  } else {
    console.log('  [OK] maintenance_orders: isolamento de tenant OK');
  }

  // alerts: barrelId deve ter mesmo tenantId do alerta
  const crossTenantAlerts = await query(`
    SELECT a.id, a."tenantId" as alert_tenant, b."tenantId" as barrel_tenant
    FROM alerts a
    JOIN barrels b ON a."barrelId" = b.id
    WHERE a."tenantId" != b."tenantId"
  `);
  if (crossTenantAlerts.length > 0) {
    console.log(`  [PROBLEMA] ${crossTenantAlerts.length} alerts com tenantId diferente do barril`);
    addIssue({
      table: 'alerts',
      issue: 'Alertas com tenantId diferente do tenantId do barril',
      severity: 'CRITICAL',
      count: crossTenantAlerts.length,
    });
  } else {
    console.log('  [OK] alerts: isolamento de tenant OK');
  }
}

// ============================================================================
// 13. DATA QUALITY CHECKS
// ============================================================================
async function auditDataQuality() {
  console.log('\n========================================');
  console.log('13. QUALIDADE DE DADOS');
  console.log('========================================');

  // Tenants com CNPJ invalido (deve ter 14 digitos)
  const badCnpj = await query(`
    SELECT id, name, cnpj FROM tenants
    WHERE LENGTH(cnpj) != 14 OR cnpj !~ '^[0-9]{14}$'
  `);
  if (badCnpj.length > 0) {
    console.log(`  [PROBLEMA] ${badCnpj.length} tenants com CNPJ invalido`);
    for (const t of badCnpj) {
      console.log(`    id=${t.id}, name=${t.name}, cnpj="${t.cnpj}"`);
    }
    addIssue({
      table: 'tenants',
      issue: 'CNPJ com formato invalido (deve ser 14 digitos numericos)',
      severity: 'MEDIUM',
      count: badCnpj.length,
    });
  } else {
    console.log('  [OK] Todos os CNPJs de tenants tem formato valido');
  }

  // Barris com capacityLiters invalido
  const badCapacity = await query(`
    SELECT id, "internalCode", "capacityLiters"
    FROM barrels
    WHERE "deletedAt" IS NULL
    AND "capacityLiters" NOT IN (10, 20, 30, 50)
  `);
  if (badCapacity.length > 0) {
    console.log(`  [PROBLEMA] ${badCapacity.length} barris com capacityLiters invalido`);
    for (const b of badCapacity.slice(0, 5)) {
      console.log(`    barril=${b.internalCode}, capacidade=${b.capacityLiters}L`);
    }
    addIssue({
      table: 'barrels',
      issue: 'capacityLiters fora dos valores aceitos (10, 20, 30, 50)',
      severity: 'LOW',
      count: badCapacity.length,
    });
  } else {
    console.log('  [OK] Todos os barris tem capacidade valida');
  }

  // Refresh tokens expirados que nao foram limpos
  const expiredTokens = await query(`
    SELECT COUNT(*) as count FROM refresh_tokens
    WHERE "expiresAt" < NOW()
  `);
  const expiredCount = parseInt(expiredTokens[0].count);
  if (expiredCount > 0) {
    console.log(`  [INFO] ${expiredCount} refresh_tokens expirados (podem ser limpos)`);
    addIssue({
      table: 'refresh_tokens',
      issue: 'Tokens expirados nao removidos',
      severity: 'LOW',
      count: expiredCount,
      fixSql: `DELETE FROM refresh_tokens WHERE "expiresAt" < NOW();`
    });
  } else {
    console.log('  [OK] Nenhum refresh_token expirado');
  }

  // Idempotency keys expiradas
  try {
    const expiredKeys = await query(`
      SELECT COUNT(*) as count FROM idempotency_keys
      WHERE "expiresAt" < NOW()
    `);
    const expKeyCount = parseInt(expiredKeys[0].count);
    if (expKeyCount > 0) {
      console.log(`  [INFO] ${expKeyCount} idempotency_keys expiradas (podem ser limpas)`);
      addIssue({
        table: 'idempotency_keys',
        issue: 'Chaves de idempotencia expiradas nao removidas',
        severity: 'LOW',
        count: expKeyCount,
        fixSql: `DELETE FROM idempotency_keys WHERE "expiresAt" < NOW();`
      });
    } else {
      console.log('  [OK] Nenhuma idempotency_key expirada');
    }
  } catch { /* table may be empty */ }

  // Users com email vazio
  const emptyEmail = await query(`
    SELECT id, name FROM users WHERE email = '' OR email IS NULL
  `);
  if (emptyEmail.length > 0) {
    console.log(`  [PROBLEMA] ${emptyEmail.length} users com email vazio`);
    addIssue({
      table: 'users',
      issue: 'Email vazio ou NULL',
      severity: 'HIGH',
      count: emptyEmail.length,
    });
  } else {
    console.log('  [OK] Todos os users tem email preenchido');
  }

  // Component configs com maxCycles ou maxDays <= 0
  const badConfig = await query(`
    SELECT id, name, "maxCycles", "maxDays", "tenantId"
    FROM component_configs
    WHERE "deletedAt" IS NULL
    AND ("maxCycles" <= 0 OR "maxDays" <= 0)
  `);
  if (badConfig.length > 0) {
    console.log(`  [PROBLEMA] ${badConfig.length} component_configs com maxCycles ou maxDays <= 0`);
    addIssue({
      table: 'component_configs',
      issue: 'maxCycles ou maxDays menor ou igual a zero',
      severity: 'MEDIUM',
      count: badConfig.length,
    });
  } else {
    console.log('  [OK] Todas as configs de componentes tem limites validos');
  }

  // Barris com lastEventAt no futuro
  const futureEvents = await query(`
    SELECT id, "internalCode", "lastEventAt"
    FROM barrels
    WHERE "lastEventAt" > NOW() + INTERVAL '1 hour'
    AND "deletedAt" IS NULL
  `);
  if (futureEvents.length > 0) {
    console.log(`  [PROBLEMA] ${futureEvents.length} barris com lastEventAt no futuro`);
    addIssue({
      table: 'barrels',
      issue: 'lastEventAt no futuro',
      severity: 'LOW',
      count: futureEvents.length,
    });
  } else {
    console.log('  [OK] Nenhum barril com lastEventAt no futuro');
  }
}

// ============================================================================
// 14. DISPOSAL CONSISTENCY
// ============================================================================
async function auditDisposals() {
  console.log('\n========================================');
  console.log('14. DISPOSALS - CONSISTENCIA');
  console.log('========================================');

  // Disposals APPROVED/COMPLETED sem approvedById
  const noApprover = await query(`
    SELECT id, "barrelId", status
    FROM disposals
    WHERE status IN ('APPROVED', 'COMPLETED')
    AND "approvedById" IS NULL
  `);
  if (noApprover.length > 0) {
    console.log(`  [PROBLEMA] ${noApprover.length} disposals aprovados sem approvedById`);
    addIssue({
      table: 'disposals',
      issue: 'Disposal APPROVED/COMPLETED sem approvedById',
      severity: 'MEDIUM',
      count: noApprover.length,
    });
  } else {
    console.log('  [OK] Todos os disposals aprovados tem approvedById');
  }

  // Disposals COMPLETED sem completedAt
  const noCompletedAt = await query(`
    SELECT id, "barrelId" FROM disposals
    WHERE status = 'COMPLETED' AND "completedAt" IS NULL
  `);
  if (noCompletedAt.length > 0) {
    console.log(`  [PROBLEMA] ${noCompletedAt.length} disposals COMPLETED sem completedAt`);
    addIssue({
      table: 'disposals',
      issue: 'Disposal COMPLETED sem completedAt',
      severity: 'LOW',
      count: noCompletedAt.length,
    });
  } else {
    console.log('  [OK] Todos os disposals COMPLETED tem completedAt');
  }
}

// ============================================================================
// 15. BARREL BATCHES CONSISTENCY
// ============================================================================
async function auditBarrelBatches() {
  console.log('\n========================================');
  console.log('15. BARREL_BATCHES - CONSISTENCIA');
  console.log('========================================');

  // Batches com quantity != diferenca codeEnd - codeStart
  const batches = await query(`SELECT id, "codeStart", "codeEnd", quantity FROM barrel_batches`);
  let mismatchCount = 0;
  for (const b of batches) {
    const startMatch = b.codeStart.match(/KS-BAR-(\d+)/);
    const endMatch = b.codeEnd.match(/KS-BAR-(\d+)/);
    if (startMatch && endMatch) {
      const expected = parseInt(endMatch[1]) - parseInt(startMatch[1]) + 1;
      if (expected !== b.quantity) {
        mismatchCount++;
        console.log(`  [PROBLEMA] Batch ${b.id}: codeStart=${b.codeStart}, codeEnd=${b.codeEnd}, quantity=${b.quantity}, esperado=${expected}`);
      }
    }
  }
  if (mismatchCount > 0) {
    addIssue({
      table: 'barrel_batches',
      issue: 'quantity nao corresponde ao range codeStart-codeEnd',
      severity: 'MEDIUM',
      count: mismatchCount,
    });
  } else {
    console.log(`  [OK] Todos os ${batches.length} batches tem quantity consistente`);
  }

  // Batches com printCount != contagem real de prints
  const printMismatch = await query(`
    SELECT bb.id, bb."printCount", COUNT(bbp.id) as real_count
    FROM barrel_batches bb
    LEFT JOIN barrel_batch_prints bbp ON bbp."batchId" = bb.id
    GROUP BY bb.id, bb."printCount"
    HAVING bb."printCount" != COUNT(bbp.id)
  `);
  if (printMismatch.length > 0) {
    console.log(`  [PROBLEMA] ${printMismatch.length} batches com printCount inconsistente`);
    addIssue({
      table: 'barrel_batches',
      issue: 'printCount nao corresponde ao numero real de prints',
      severity: 'LOW',
      count: printMismatch.length,
    });
  } else {
    console.log('  [OK] printCount consistente em todos os batches');
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('============================================================');
  console.log('       KEGSAFE DATABASE AUDIT');
  console.log(`       ${new Date().toISOString()}`);
  console.log('============================================================');

  await auditTableCounts();
  await auditOrphanedForeignKeys();
  await auditDuplicates();
  await auditComponentCycles();
  await auditBarrelSequences();
  await auditGeofences();
  await auditBarrelStatus();
  await auditLogisticsEvents();
  await auditMaintenanceOrders();
  await auditAlerts();
  await auditNotNullViolations();
  await auditTenantIsolation();
  await auditDataQuality();
  await auditDisposals();
  await auditBarrelBatches();

  // ============================================================================
  // SUMARIO FINAL
  // ============================================================================
  console.log('\n\n============================================================');
  console.log('       SUMARIO DE PROBLEMAS ENCONTRADOS');
  console.log('============================================================');

  const bySeverity = {
    CRITICAL: issues.filter(i => i.severity === 'CRITICAL'),
    HIGH: issues.filter(i => i.severity === 'HIGH'),
    MEDIUM: issues.filter(i => i.severity === 'MEDIUM'),
    LOW: issues.filter(i => i.severity === 'LOW'),
    INFO: issues.filter(i => i.severity === 'INFO'),
  };

  console.log(`\n  CRITICAL: ${bySeverity.CRITICAL.length} problemas`);
  console.log(`  HIGH:     ${bySeverity.HIGH.length} problemas`);
  console.log(`  MEDIUM:   ${bySeverity.MEDIUM.length} problemas`);
  console.log(`  LOW:      ${bySeverity.LOW.length} problemas`);
  console.log(`  INFO:     ${bySeverity.INFO.length} problemas`);
  console.log(`  TOTAL:    ${issues.length} problemas\n`);

  for (const [severity, sIssues] of Object.entries(bySeverity)) {
    if (sIssues.length === 0) continue;
    console.log(`\n  === ${severity} ===`);
    for (const issue of sIssues) {
      console.log(`\n  [${issue.severity}] ${issue.table}: ${issue.issue}`);
      console.log(`    Registros afetados: ${issue.count}`);
      if (issue.details) console.log(`    Detalhes: ${issue.details}`);
      if (issue.fixSql) console.log(`    SQL para corrigir:\n${issue.fixSql.split('\n').map(l => '      ' + l).join('\n')}`);
    }
  }

  if (issues.length === 0) {
    console.log('\n  NENHUM PROBLEMA ENCONTRADO! Banco de dados saudavel.');
  }
}

main()
  .catch(console.error)
  .finally(async () => { await pool.end(); });
