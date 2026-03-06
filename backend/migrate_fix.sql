CREATE TYPE "BarrelCondition" AS ENUM ('NEW', 'USED'); 
ALTER TABLE "barrels" ADD COLUMN "condition" "BarrelCondition" NOT NULL DEFAULT 'NEW'; 
