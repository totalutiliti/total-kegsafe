-- Sincroniza as migrations com o schema.prisma (drift acumulado pelo uso de `db push`).
-- Adiciona colunas/enums que o código já usa mas que `migrate deploy` não criava
-- (o que causava erro 500 em barrels/disposals/maintenance e P2022 no seed).
--
-- NOTA: os índices trigram de busca (idx_barrel_internal_code_trgm,
-- idx_barrel_qr_code_trgm, idx_barrel_tenant_created) NÃO são dropados aqui,
-- de propósito: existem no banco via SQL raw (busca sem acento) e não estão
-- declarados no schema.prisma. Mantê-los preserva a performance de busca.
-- (Idealmente declará-los no schema com @@index(type: Gin) numa melhoria futura.)

-- CreateEnum
CREATE TYPE "BarrelCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('CORROSION', 'STRUCTURAL_DAMAGE', 'VALVE_FAILURE', 'EXCESSIVE_WEAR', 'LOGISTICS_ACCIDENT', 'REGULATORY', 'HIGH_TCO', 'OTHER');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'CLIENT_DEACTIVATED_WITH_BARRELS';
ALTER TYPE "AlertType" ADD VALUE 'MAINTENANCE_DUE_ON_RETURN';
ALTER TYPE "AlertType" ADD VALUE 'PREMATURE_DISPOSAL';

-- AlterTable
ALTER TABLE "barrel_batch_prints" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "barrel_batches" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "barrels" ADD COLUMN     "chassisNumber" VARCHAR(50),
ADD COLUMN     "condition" "BarrelCondition" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "disposals" ADD COLUMN     "disposalReason" "DisposalReason",
ADD COLUMN     "photoUrl" VARCHAR(500);

-- AlterTable
ALTER TABLE "maintenance_orders" ADD COLUMN     "scheduledDate" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "ownership_history" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "super_admin_audit_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "entityType" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "entityId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "userAgent" SET DATA TYPE VARCHAR(500);

-- CreateIndex
CREATE UNIQUE INDEX "barrels_tenantId_chassisNumber_key" ON "barrels"("tenantId", "chassisNumber");

-- CreateIndex
CREATE INDEX "maintenance_orders_tenantId_scheduledDate_idx" ON "maintenance_orders"("tenantId", "scheduledDate");
