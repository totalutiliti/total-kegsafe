-- AlterTable: make qrCode nullable for barrels that don't have a QR code yet (bulk import / linking workflow)
ALTER TABLE "barrels" ALTER COLUMN "qrCode" DROP NOT NULL;
