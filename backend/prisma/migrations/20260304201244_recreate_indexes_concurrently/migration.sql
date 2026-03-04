-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_barrel_internal_code_trgm"
  ON "barrels" USING gin ("internalCode" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_barrel_qr_code_trgm"
  ON "barrels" USING gin ("qrCode" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_logistics_event_action_timestamp"
  ON "logistics_events" ("tenantId", "actionType", "timestamp");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_barrel_tenant_created"
  ON "barrels" ("tenantId", "createdAt");
