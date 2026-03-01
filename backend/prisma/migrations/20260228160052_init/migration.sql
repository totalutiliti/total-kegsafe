-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LOGISTICS', 'MAINTENANCE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BarrelStatus" AS ENUM ('ACTIVE', 'IN_TRANSIT', 'AT_CLIENT', 'IN_MAINTENANCE', 'BLOCKED', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "ValveModel" AS ENUM ('TYPE_S', 'TYPE_D', 'TYPE_A', 'TYPE_G', 'TYPE_M', 'OTHER');

-- CreateEnum
CREATE TYPE "BarrelMaterial" AS ENUM ('INOX_304', 'INOX_316', 'PET_SLIM');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HealthScore" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "LogisticsAction" AS ENUM ('EXPEDITION', 'DELIVERY', 'COLLECTION', 'RECEPTION');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE');

-- CreateEnum
CREATE TYPE "MaintenanceOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComponentAction" AS ENUM ('INSPECTED', 'REPLACED', 'REPAIRED');

-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('STRUCTURAL', 'VALVE', 'SEAL', 'CORROSION', 'WELD', 'OTHER');

-- CreateEnum
CREATE TYPE "TriageResult" AS ENUM ('CLEARED_FOR_FILLING', 'SENT_TO_MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('COMPONENT_END_OF_LIFE', 'MANDATORY_INSPECTION', 'IDLE_AT_CLIENT', 'IDLE_AT_FACTORY', 'GEOFENCE_VIOLATION', 'AFTER_HOURS_MOVEMENT', 'SUPPLIER_SLA_BREACH', 'DISPOSAL_SUGGESTED');

-- CreateEnum
CREATE TYPE "AlertPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "GeofenceType" AS ENUM ('FACTORY', 'CLIENT', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "DisposalStatus" AS ENUM ('SUGGESTED', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisposalDestination" AS ENUM ('SCRAP_SALE', 'RECYCLING', 'DONATION');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "logoUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "role" "Role" NOT NULL,
    "phone" VARCHAR(20),
    "avatarUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barrels" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "internalCode" VARCHAR(20) NOT NULL,
    "qrCode" VARCHAR(50) NOT NULL,
    "barcode" VARCHAR(50),
    "manufacturer" VARCHAR(100),
    "valveModel" "ValveModel",
    "capacityLiters" SMALLINT NOT NULL,
    "tareWeightKg" DECIMAL(6,2),
    "material" "BarrelMaterial" NOT NULL DEFAULT 'INOX_304',
    "purchaseDate" DATE,
    "manufactureDate" DATE,
    "acquisitionCost" DECIMAL(10,2),
    "status" "BarrelStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalCycles" INTEGER NOT NULL DEFAULT 0,
    "totalMaintenanceCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentLatitude" DECIMAL(10,7),
    "currentLongitude" DECIMAL(10,7),
    "lastEventAt" TIMESTAMPTZ(3),
    "lastClientId" UUID,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "barrels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_configs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "maxCycles" INTEGER NOT NULL,
    "maxDays" INTEGER NOT NULL,
    "criticality" "Criticality" NOT NULL,
    "alertThreshold" DECIMAL(3,2) NOT NULL DEFAULT 0.9,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "averageReplacementCost" DECIMAL(10,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "component_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_cycles" (
    "id" UUID NOT NULL,
    "barrelId" UUID NOT NULL,
    "componentConfigId" UUID NOT NULL,
    "cyclesSinceLastService" INTEGER NOT NULL DEFAULT 0,
    "lastServiceDate" TIMESTAMPTZ(3),
    "healthScore" "HealthScore" NOT NULL DEFAULT 'GREEN',
    "healthPercentage" DECIMAL(5,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "component_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "barrelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actionType" "LogisticsAction" NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "gpsAccuracy" DECIMAL(8,2),
    "clientId" UUID,
    "inferredZone" "GeofenceType",
    "matchedGeofenceId" UUID,
    "notes" VARCHAR(500),
    "batchId" UUID,
    "previousStatus" "BarrelStatus",
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_orders" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "barrelId" UUID NOT NULL,
    "orderNumber" VARCHAR(20) NOT NULL,
    "orderType" "MaintenanceType" NOT NULL,
    "status" "MaintenanceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "AlertPriority" NOT NULL DEFAULT 'MEDIUM',
    "description" VARCHAR(1000) NOT NULL,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourceAlertId" UUID,
    "assignedToId" UUID,
    "providerId" UUID,
    "estimatedCost" DECIMAL(10,2),
    "actualCost" DECIMAL(10,2),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "maintenance_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "barrelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "maintenanceOrderId" UUID,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "pressureTestOk" BOOLEAN,
    "pressureTestValue" DECIMAL(5,2),
    "washCompleted" BOOLEAN,
    "generalNotes" VARCHAR(1000),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "totalCost" DECIMAL(10,2),
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_items" (
    "id" UUID NOT NULL,
    "maintenanceLogId" UUID NOT NULL,
    "componentConfigId" UUID NOT NULL,
    "action" "ComponentAction" NOT NULL,
    "cost" DECIMAL(10,2),
    "notes" VARCHAR(500),

    CONSTRAINT "maintenance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triages" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "barrelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "intact" BOOLEAN NOT NULL,
    "damageType" "DamageType",
    "damageNotes" VARCHAR(500),
    "photoUrl" VARCHAR(500),
    "result" "TriageResult" NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "barrelId" UUID,
    "componentConfigId" UUID,
    "alertType" "AlertType" NOT NULL,
    "priority" "AlertPriority" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "metadata" JSONB,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "acknowledgedById" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" UUID,
    "resolutionNotes" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "GeofenceType" NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 500,
    "clientId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposals" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "barrelId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "approvedById" UUID,
    "status" "DisposalStatus" NOT NULL DEFAULT 'SUGGESTED',
    "reason" VARCHAR(500) NOT NULL,
    "tcoAccumulated" DECIMAL(12,2) NOT NULL,
    "replacementCost" DECIMAL(10,2) NOT NULL,
    "destination" "DisposalDestination",
    "scrapValue" DECIMAL(10,2),
    "notes" VARCHAR(1000),
    "approvedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "tradeName" VARCHAR(200),
    "cnpj" VARCHAR(14),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "address" VARCHAR(500),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "connectorType" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "cnpj" VARCHAR(14),
    "supplyType" VARCHAR(100) NOT NULL,
    "leadTimeDays" INTEGER,
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(20),
    "paymentTerms" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_providers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "specialty" VARCHAR(150) NOT NULL,
    "certifications" VARCHAR(300),
    "hourlyRate" DECIMAL(10,2),
    "serviceRate" DECIMAL(10,2),
    "rating" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(50) NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_role_idx" ON "users"("tenantId", "role");

-- CreateIndex
CREATE INDEX "users_tenantId_isActive_idx" ON "users"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "barrels_tenantId_status_idx" ON "barrels"("tenantId", "status");

-- CreateIndex
CREATE INDEX "barrels_tenantId_lastEventAt_idx" ON "barrels"("tenantId", "lastEventAt");

-- CreateIndex
CREATE INDEX "barrels_tenantId_status_lastEventAt_idx" ON "barrels"("tenantId", "status", "lastEventAt");

-- CreateIndex
CREATE INDEX "barrels_tenantId_deletedAt_idx" ON "barrels"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "barrels_tenantId_totalCycles_idx" ON "barrels"("tenantId", "totalCycles");

-- CreateIndex
CREATE INDEX "barrels_tenantId_totalMaintenanceCost_idx" ON "barrels"("tenantId", "totalMaintenanceCost");

-- CreateIndex
CREATE INDEX "barrels_qrCode_idx" ON "barrels"("qrCode");

-- CreateIndex
CREATE INDEX "barrels_tenantId_lastClientId_idx" ON "barrels"("tenantId", "lastClientId");

-- CreateIndex
CREATE INDEX "barrels_tenantId_capacityLiters_status_idx" ON "barrels"("tenantId", "capacityLiters", "status");

-- CreateIndex
CREATE UNIQUE INDEX "barrels_tenantId_internalCode_key" ON "barrels"("tenantId", "internalCode");

-- CreateIndex
CREATE UNIQUE INDEX "barrels_tenantId_qrCode_key" ON "barrels"("tenantId", "qrCode");

-- CreateIndex
CREATE INDEX "component_configs_tenantId_idx" ON "component_configs"("tenantId");

-- CreateIndex
CREATE INDEX "component_configs_tenantId_isActive_idx" ON "component_configs"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "component_configs_tenantId_criticality_idx" ON "component_configs"("tenantId", "criticality");

-- CreateIndex
CREATE UNIQUE INDEX "component_configs_tenantId_name_key" ON "component_configs"("tenantId", "name");

-- CreateIndex
CREATE INDEX "component_cycles_barrelId_idx" ON "component_cycles"("barrelId");

-- CreateIndex
CREATE INDEX "component_cycles_healthScore_idx" ON "component_cycles"("healthScore");

-- CreateIndex
CREATE INDEX "component_cycles_barrelId_healthScore_idx" ON "component_cycles"("barrelId", "healthScore");

-- CreateIndex
CREATE INDEX "component_cycles_componentConfigId_healthScore_idx" ON "component_cycles"("componentConfigId", "healthScore");

-- CreateIndex
CREATE UNIQUE INDEX "component_cycles_barrelId_componentConfigId_key" ON "component_cycles"("barrelId", "componentConfigId");

-- CreateIndex
CREATE INDEX "logistics_events_tenantId_barrelId_idx" ON "logistics_events"("tenantId", "barrelId");

-- CreateIndex
CREATE INDEX "logistics_events_tenantId_timestamp_idx" ON "logistics_events"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "logistics_events_tenantId_actionType_idx" ON "logistics_events"("tenantId", "actionType");

-- CreateIndex
CREATE INDEX "logistics_events_tenantId_actionType_timestamp_idx" ON "logistics_events"("tenantId", "actionType", "timestamp");

-- CreateIndex
CREATE INDEX "logistics_events_barrelId_actionType_timestamp_idx" ON "logistics_events"("barrelId", "actionType", "timestamp");

-- CreateIndex
CREATE INDEX "logistics_events_tenantId_clientId_idx" ON "logistics_events"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "logistics_events_tenantId_userId_timestamp_idx" ON "logistics_events"("tenantId", "userId", "timestamp");

-- CreateIndex
CREATE INDEX "logistics_events_batchId_idx" ON "logistics_events"("batchId");

-- CreateIndex
CREATE INDEX "maintenance_orders_tenantId_status_idx" ON "maintenance_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "maintenance_orders_tenantId_barrelId_idx" ON "maintenance_orders"("tenantId", "barrelId");

-- CreateIndex
CREATE INDEX "maintenance_orders_tenantId_priority_status_idx" ON "maintenance_orders"("tenantId", "priority", "status");

-- CreateIndex
CREATE INDEX "maintenance_orders_tenantId_assignedToId_status_idx" ON "maintenance_orders"("tenantId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "maintenance_orders_tenantId_createdAt_idx" ON "maintenance_orders"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "maintenance_orders_orderNumber_idx" ON "maintenance_orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_logs_maintenanceOrderId_key" ON "maintenance_logs"("maintenanceOrderId");

-- CreateIndex
CREATE INDEX "maintenance_logs_tenantId_barrelId_idx" ON "maintenance_logs"("tenantId", "barrelId");

-- CreateIndex
CREATE INDEX "maintenance_logs_tenantId_timestamp_idx" ON "maintenance_logs"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "maintenance_logs_tenantId_userId_idx" ON "maintenance_logs"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "maintenance_logs_tenantId_maintenanceType_idx" ON "maintenance_logs"("tenantId", "maintenanceType");

-- CreateIndex
CREATE INDEX "maintenance_items_maintenanceLogId_idx" ON "maintenance_items"("maintenanceLogId");

-- CreateIndex
CREATE INDEX "maintenance_items_componentConfigId_idx" ON "maintenance_items"("componentConfigId");

-- CreateIndex
CREATE INDEX "triages_tenantId_barrelId_idx" ON "triages"("tenantId", "barrelId");

-- CreateIndex
CREATE INDEX "triages_tenantId_timestamp_idx" ON "triages"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "triages_tenantId_result_idx" ON "triages"("tenantId", "result");

-- CreateIndex
CREATE INDEX "alerts_tenantId_status_idx" ON "alerts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "alerts_tenantId_alertType_idx" ON "alerts"("tenantId", "alertType");

-- CreateIndex
CREATE INDEX "alerts_tenantId_priority_idx" ON "alerts"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "alerts_tenantId_status_priority_idx" ON "alerts"("tenantId", "status", "priority");

-- CreateIndex
CREATE INDEX "alerts_tenantId_barrelId_status_idx" ON "alerts"("tenantId", "barrelId", "status");

-- CreateIndex
CREATE INDEX "alerts_tenantId_createdAt_idx" ON "alerts"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_tenantId_barrelId_alertType_status_key" ON "alerts"("tenantId", "barrelId", "alertType", "status");

-- CreateIndex
CREATE INDEX "geofences_tenantId_type_idx" ON "geofences"("tenantId", "type");

-- CreateIndex
CREATE INDEX "geofences_tenantId_isActive_idx" ON "geofences"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "geofences_tenantId_clientId_idx" ON "geofences"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "geofences_tenantId_latitude_longitude_idx" ON "geofences"("tenantId", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "disposals_tenantId_status_idx" ON "disposals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "disposals_tenantId_barrelId_idx" ON "disposals"("tenantId", "barrelId");

-- CreateIndex
CREATE INDEX "disposals_tenantId_createdAt_idx" ON "disposals"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "clients_tenantId_idx" ON "clients"("tenantId");

-- CreateIndex
CREATE INDEX "clients_tenantId_isActive_idx" ON "clients"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "clients_tenantId_latitude_longitude_idx" ON "clients"("tenantId", "latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenantId_cnpj_key" ON "clients"("tenantId", "cnpj");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_isActive_idx" ON "suppliers"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_supplyType_idx" ON "suppliers"("tenantId", "supplyType");

-- CreateIndex
CREATE INDEX "service_providers_tenantId_idx" ON "service_providers"("tenantId");

-- CreateIndex
CREATE INDEX "service_providers_tenantId_isActive_idx" ON "service_providers"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "service_providers_tenantId_specialty_idx" ON "service_providers"("tenantId", "specialty");

-- CreateIndex
CREATE INDEX "service_providers_tenantId_rating_idx" ON "service_providers"("tenantId", "rating");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_timestamp_idx" ON "audit_logs"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_action_idx" ON "audit_logs"("tenantId", "action");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_userId_timestamp_idx" ON "audit_logs"("tenantId", "userId", "timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barrels" ADD CONSTRAINT "barrels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barrels" ADD CONSTRAINT "barrels_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barrels" ADD CONSTRAINT "barrels_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_configs" ADD CONSTRAINT "component_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_cycles" ADD CONSTRAINT "component_cycles_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_cycles" ADD CONSTRAINT "component_cycles_componentConfigId_fkey" FOREIGN KEY ("componentConfigId") REFERENCES "component_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_events" ADD CONSTRAINT "logistics_events_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_events" ADD CONSTRAINT "logistics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_events" ADD CONSTRAINT "logistics_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "service_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_maintenanceOrderId_fkey" FOREIGN KEY ("maintenanceOrderId") REFERENCES "maintenance_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_items" ADD CONSTRAINT "maintenance_items_maintenanceLogId_fkey" FOREIGN KEY ("maintenanceLogId") REFERENCES "maintenance_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_items" ADD CONSTRAINT "maintenance_items_componentConfigId_fkey" FOREIGN KEY ("componentConfigId") REFERENCES "component_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triages" ADD CONSTRAINT "triages_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triages" ADD CONSTRAINT "triages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
