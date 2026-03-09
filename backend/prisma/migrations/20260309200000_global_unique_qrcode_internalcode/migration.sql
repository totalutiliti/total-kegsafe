-- AlterTable: Unique constraints de per-tenant para GLOBAL
-- QR Codes e internalCodes são gerados pela sequência global BarrelSequence
-- e devem ser únicos globalmente (QR Codes são etiquetas físicas)

-- Step 1: Drop existing per-tenant unique constraints
DROP INDEX IF EXISTS "barrels_tenantId_internalCode_key";
DROP INDEX IF EXISTS "barrels_tenantId_qrCode_key";

-- Step 2: Drop redundant qrCode non-unique index (será substituído pelo unique)
DROP INDEX IF EXISTS "barrels_qrCode_idx";

-- Step 3: Add global unique constraints
CREATE UNIQUE INDEX "barrels_internalCode_key" ON "barrels"("internalCode");
CREATE UNIQUE INDEX "barrels_qrCode_key" ON "barrels"("qrCode");

-- Step 4: Sync BarrelSequence com o maior número real no banco
UPDATE "barrel_sequences"
SET "lastNumber" = (
  SELECT COALESCE(MAX(
    CAST(SUBSTRING("internalCode" FROM 8) AS INTEGER)
  ), 0)
  FROM "barrels"
  WHERE "internalCode" LIKE 'KS-BAR-%'
    AND "deletedAt" IS NULL
),
"updatedAt" = NOW()
WHERE "key" = 'global';
