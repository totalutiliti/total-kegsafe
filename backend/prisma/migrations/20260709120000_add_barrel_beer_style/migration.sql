-- Adiciona o estilo de chopp atualmente envasado no barril (rótulo do produto no ativo).
-- Coluna opcional e aditiva: não afeta RLS, índices ou dados existentes.
ALTER TABLE "barrels" ADD COLUMN "currentBeerStyle" VARCHAR(100);
