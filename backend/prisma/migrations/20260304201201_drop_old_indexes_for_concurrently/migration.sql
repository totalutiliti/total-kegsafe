-- Dropar índices criados sem CONCURRENTLY para recriá-los com CONCURRENTLY
DROP INDEX IF EXISTS "idx_barrel_internal_code_trgm";
DROP INDEX IF EXISTS "idx_barrel_qr_code_trgm";
DROP INDEX IF EXISTS "idx_logistics_event_action_timestamp";
DROP INDEX IF EXISTS "idx_barrel_tenant_created";
