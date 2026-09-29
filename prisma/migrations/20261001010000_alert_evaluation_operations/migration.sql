CREATE TYPE "PriceWatchRunSource" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "PriceWatchRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED');

ALTER TABLE "NotificationPreference" ADD COLUMN "emailPriceAlerts" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PriceWatchEvaluationRun" (
  "id" TEXT NOT NULL,
  "source" "PriceWatchRunSource" NOT NULL,
  "status" "PriceWatchRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "watchesScanned" INTEGER NOT NULL DEFAULT 0,
  "watchesEvaluated" INTEGER NOT NULL DEFAULT 0,
  "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
  "watchesSkipped" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  CONSTRAINT "PriceWatchEvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceWatchEvaluatorLease" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "acquiredAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceWatchEvaluatorLease_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceWatchEvaluationRun_startedAt_idx" ON "PriceWatchEvaluationRun"("startedAt");
CREATE INDEX "PriceWatchEvaluationRun_status_startedAt_idx" ON "PriceWatchEvaluationRun"("status", "startedAt");
