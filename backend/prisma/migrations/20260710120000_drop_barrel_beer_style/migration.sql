-- Remove o estilo de chopp do barril.
-- O KegSafe rastreia o barril (ativo físico); o chopp é o produto líquido de
-- venda da cervejaria e não pertence ao cadastro do ativo.
ALTER TABLE "barrels" DROP COLUMN IF EXISTS "currentBeerStyle";
