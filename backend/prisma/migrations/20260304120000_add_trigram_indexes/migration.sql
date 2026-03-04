-- Extensão pg_trgm para índices trigram (busca por substring performática)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para busca por internalCode (ex: "KS-BAR-000000001")
CREATE INDEX IF NOT EXISTS "idx_barrel_internal_code_trgm"
  ON "barrels" USING gin ("internalCode" gin_trgm_ops);

-- Índice trigram para busca por qrCode (ex: "KS-QR-000000001")
CREATE INDEX IF NOT EXISTS "idx_barrel_qr_code_trgm"
  ON "barrels" USING gin ("qrCode" gin_trgm_ops);

-- Índice composto para LogisticsEvent: geofence violation job (actionType + timestamp)
CREATE INDEX IF NOT EXISTS "idx_logistics_event_action_timestamp"
  ON "logistics_events" ("tenantId", "actionType", "timestamp");

-- Índice para Barrel: criação recente
CREATE INDEX IF NOT EXISTS "idx_barrel_tenant_created"
  ON "barrels" ("tenantId", "createdAt");
