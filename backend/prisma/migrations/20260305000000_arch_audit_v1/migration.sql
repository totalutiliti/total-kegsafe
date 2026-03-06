-- Audit Arquitetural: optimistic locking + idempotency keys

-- Add version field to barrels for optimistic locking
ALTER TABLE "barrels" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Create idempotency_keys table for idempotent operations
CREATE TABLE "idempotency_keys" (
    "key" VARCHAR(255) NOT NULL,
    "tenantId" UUID NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- Create indexes
CREATE INDEX "idempotency_keys_tenantId_idx" ON "idempotency_keys"("tenantId");
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");
