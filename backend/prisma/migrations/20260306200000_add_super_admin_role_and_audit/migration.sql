-- Add SUPER_ADMIN to Role enum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- Add mustChangePassword field to users table
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Create super_admin_audit_logs table
CREATE TABLE "super_admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(255) NOT NULL,
    "targetTenantId" UUID,
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for audit log
CREATE INDEX "super_admin_audit_logs_userId_timestamp_idx" ON "super_admin_audit_logs"("userId", "timestamp");
CREATE INDEX "super_admin_audit_logs_action_idx" ON "super_admin_audit_logs"("action");
CREATE INDEX "super_admin_audit_logs_targetTenantId_idx" ON "super_admin_audit_logs"("targetTenantId");

-- Add foreign key
ALTER TABLE "super_admin_audit_logs" ADD CONSTRAINT "super_admin_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
