CREATE TYPE "PriceSnapshotReason" AS ENUM ('CREATE', 'CHANGE', 'REACTIVATED', 'BASELINE', 'REPAIR');

ALTER TABLE "PriceSnapshot"
ADD COLUMN "captureReason" "PriceSnapshotReason" NOT NULL DEFAULT 'CHANGE';
