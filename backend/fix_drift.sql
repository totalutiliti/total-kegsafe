-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- DropIndex
DROP INDEX "idx_barrel_internal_code_trgm";

-- DropIndex
DROP INDEX "idx_barrel_qr_code_trgm";

-- DropIndex
DROP INDEX "idx_barrel_tenant_created";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "super_admin_audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(50) NOT NULL,
    "targetTenantId" UUID,
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "super_admin_audit_logs_userId_timestamp_idx" ON "super_admin_audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "super_admin_audit_logs_action_idx" ON "super_admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "super_admin_audit_logs_targetTenantId_idx" ON "super_admin_audit_logs"("targetTenantId");

-- AddForeignKey
ALTER TABLE "super_admin_audit_logs" ADD CONSTRAINT "super_admin_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

