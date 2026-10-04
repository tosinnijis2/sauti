ALTER TABLE "PriceWatchEvaluationRun" ADD COLUMN "cleanupProcessed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cleanupSucceeded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cleanupFailed" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "CloudAssetKind" AS ENUM ('PRODUCT', 'AVATAR');
CREATE TYPE "CloudAssetCleanupStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "CloudAssetCleanupJob" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "kind" "CloudAssetKind" NOT NULL,
  "status" "CloudAssetCleanupStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudAssetCleanupJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CloudAssetCleanupJob_publicId_key" ON "CloudAssetCleanupJob"("publicId");
CREATE INDEX "CloudAssetCleanupJob_status_nextAttemptAt_idx" ON "CloudAssetCleanupJob"("status", "nextAttemptAt");
CREATE INDEX "CloudAssetCleanupJob_createdAt_id_idx" ON "CloudAssetCleanupJob"("createdAt", "id");

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
