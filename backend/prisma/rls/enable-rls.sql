-- ============================================================================
-- RLS (Row Level Security) — isolamento multi-tenant no nível do banco.
-- Defesa-em-profundidade: mesmo que uma query da aplicação esqueça o
-- `where tenantId`, o Postgres NÃO devolve/insere linhas de outro tenant.
--
-- VALIDADO por PoC: com FORCE RLS + role não-owner + set_config, o SELECT só
-- vê o tenant do contexto (sem contexto = 0 linhas) e o INSERT cross-tenant é
-- bloqueado pela policy (WITH CHECK).
--
-- ⚠️ ATIVAÇÃO É ACOPLADA À APP (ver README.md nesta pasta):
--   1) A app precisa conectar como `app_user` (NÃO como owner — o owner só é
--      submetido ao RLS com FORCE, e mesmo assim o app precisa setar o contexto).
--   2) Cada request/transação precisa rodar `set_config('app.tenant_id', <id>, true)`
--      (via a extensão Prisma em src/prisma/tenant-rls.extension.ts).
--   3) Rodar ISTO com a app AINDA conectando como owner sem contexto ZERA as
--      queries (app quebra). Ative junto com os passos 1 e 2.
--
-- Rode como OWNER/superuser (kegsafe). Idempotente.
-- ============================================================================

-- 1) Role da aplicação (runtime): NÃO é owner, NÃO tem BYPASSRLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    -- Troque a senha por um segredo forte do seu cofre.
    CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME_use_a_strong_secret'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- Cobre tabelas/sequências FUTURAS (criadas pelo owner nas migrations):
ALTER DEFAULT PRIVILEGES FOR ROLE kegsafe IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE kegsafe IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
-- Fecha a criação de objetos por qualquer role no schema public:
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 2) Habilita RLS + FORCE + policy fail-closed em toda tabela com tenantId.
--    A policy libera cross-tenant só quando `app.bypass_rls = 'on'` (super-admin).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'alerts','audit_logs','barrel_batches','barrels','clients',
    'component_configs','disposals','geofences','idempotency_keys',
    'logistics_events','maintenance_logs','maintenance_orders',
    'service_providers','suppliers','triages','users'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      || 'USING (current_setting(''app.bypass_rls'', true) = ''on'' '
      || '       OR "tenantId"::text = current_setting(''app.tenant_id'', true)) '
      || 'WITH CHECK (current_setting(''app.bypass_rls'', true) = ''on'' '
      || '            OR "tenantId"::text = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

-- Verificação rápida (deve listar as 16 tabelas com rowsecurity = t):
-- SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
--   WHERE relname = ANY(ARRAY['barrels','clients','users']) ORDER BY relname;
