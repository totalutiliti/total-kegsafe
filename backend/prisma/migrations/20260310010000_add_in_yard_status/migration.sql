-- AlterEnum: Add IN_YARD status to BarrelStatus
-- Represents barrels that arrived at the factory yard and are awaiting triage/hygienization
ALTER TYPE "BarrelStatus" ADD VALUE 'IN_YARD' BEFORE 'IN_MAINTENANCE';
