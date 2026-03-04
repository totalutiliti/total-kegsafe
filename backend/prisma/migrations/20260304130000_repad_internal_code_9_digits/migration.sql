-- Migração: Repadding do internalCode de 5 para 9 dígitos
-- KS-BAR-00053 → KS-BAR-000000053
-- Suporta até 999.999.999 barris (escalabilidade para 100M+)

UPDATE "barrels"
SET "internalCode" = 'KS-BAR-' || LPAD(REPLACE("internalCode", 'KS-BAR-', ''), 9, '0')
WHERE "internalCode" LIKE 'KS-BAR-%'
  AND LENGTH(REPLACE("internalCode", 'KS-BAR-', '')) < 9;
