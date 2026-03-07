-- AlterEnum: add PRE_REGISTERED to BarrelStatus
ALTER TYPE "BarrelStatus" ADD VALUE IF NOT EXISTS 'PRE_REGISTERED' BEFORE 'ACTIVE';

-- CreateTable: barrel_sequences (global code generation sequence)
CREATE TABLE "barrel_sequences" (
    "key" VARCHAR(20) NOT NULL DEFAULT 'global',
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "barrel_sequences_pkey" PRIMARY KEY ("key")
);

-- Seed barrel_sequences with current max number from existing barrels
INSERT INTO "barrel_sequences" ("key", "lastNumber", "updatedAt")
SELECT 'global',
       COALESCE(MAX(
         CAST(
           REGEXP_REPLACE("internalCode", '^KS-BAR-', '')
           AS INTEGER
         )
       ), 0),
       NOW()
FROM "barrels"
WHERE "internalCode" ~ '^KS-BAR-\d{9}$'
ON CONFLICT ("key") DO UPDATE SET
  "lastNumber" = EXCLUDED."lastNumber",
  "updatedAt" = NOW();

-- CreateTable: ownership_history (barrel transfer tracking)
CREATE TABLE "ownership_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barrelId" UUID NOT NULL,
    "fromTenantId" UUID NOT NULL,
    "toTenantId" UUID NOT NULL,
    "transferredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(500),

    CONSTRAINT "ownership_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ownership_history_barrelId_idx" ON "ownership_history"("barrelId");
CREATE INDEX "ownership_history_fromTenantId_idx" ON "ownership_history"("fromTenantId");
CREATE INDEX "ownership_history_toTenantId_idx" ON "ownership_history"("toTenantId");
CREATE INDEX "ownership_history_transferredAt_idx" ON "ownership_history"("transferredAt");

-- AddForeignKey
ALTER TABLE "ownership_history" ADD CONSTRAINT "ownership_history_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "barrels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ownership_history" ADD CONSTRAINT "ownership_history_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ownership_history" ADD CONSTRAINT "ownership_history_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
