-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('CORROSION', 'STRUCTURAL_DAMAGE', 'VALVE_FAILURE', 'EXCESSIVE_WEAR', 'LOGISTICS_ACCIDENT', 'REGULATORY', 'HIGH_TCO', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'CLIENT_DEACTIVATED_WITH_BARRELS';
ALTER TYPE "AlertType" ADD VALUE 'MAINTENANCE_DUE_ON_RETURN';
ALTER TYPE "AlertType" ADD VALUE 'PREMATURE_DISPOSAL';

-- AlterTable
ALTER TABLE "barrel_batch_prints" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "barrel_batches" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "barrels" ADD COLUMN     "chassisNumber" VARCHAR(50);

-- AlterTable
ALTER TABLE "disposals" ADD COLUMN     "disposalReason" "DisposalReason",
ADD COLUMN     "photoUrl" VARCHAR(500);

-- AlterTable
ALTER TABLE "maintenance_orders" ADD COLUMN     "scheduledDate" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "ownership_history" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "barrels_tenantId_chassisNumber_key" ON "barrels"("tenantId", "chassisNumber");

-- CreateIndex
CREATE INDEX "maintenance_orders_tenantId_scheduledDate_idx" ON "maintenance_orders"("tenantId", "scheduledDate");

