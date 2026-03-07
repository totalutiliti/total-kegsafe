-- CreateTable: barrel_batches
CREATE TABLE "barrel_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "codeStart" VARCHAR(20) NOT NULL,
    "codeEnd" VARCHAR(20) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "barrel_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable: barrel_batch_prints
CREATE TABLE "barrel_batch_prints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batchId" UUID NOT NULL,
    "printedById" UUID NOT NULL,
    "printedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500),

    CONSTRAINT "barrel_batch_prints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "barrel_batches_tenantId_idx" ON "barrel_batches"("tenantId");
CREATE INDEX "barrel_batches_createdAt_idx" ON "barrel_batches"("createdAt");
CREATE INDEX "barrel_batch_prints_batchId_idx" ON "barrel_batch_prints"("batchId");

-- AddForeignKey
ALTER TABLE "barrel_batches" ADD CONSTRAINT "barrel_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "barrel_batch_prints" ADD CONSTRAINT "barrel_batch_prints_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "barrel_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
