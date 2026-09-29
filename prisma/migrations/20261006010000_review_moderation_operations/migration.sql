ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_MODERATION';

CREATE TYPE "ReviewReportReason" AS ENUM ('HARASSMENT', 'SPAM', 'FALSE_INFORMATION', 'PERSONAL_INFORMATION', 'OFF_TOPIC', 'OTHER');
CREATE TYPE "ReviewReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ReviewModerationAction" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');
CREATE TYPE "ReviewModerationReason" AS ENUM ('POLICY_VIOLATION', 'HARASSMENT', 'SPAM', 'PRIVACY', 'FRAUD_OR_MISREPRESENTATION', 'OTHER');

CREATE TABLE "ReviewReport" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "ReviewReportReason" NOT NULL,
  "note" TEXT,
  "status" "ReviewReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewReport_note_length_check" CHECK ("note" IS NULL OR char_length("note") <= 500)
);

CREATE TABLE "ReviewModerationEvent" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "moderatorId" TEXT NOT NULL,
  "action" "ReviewModerationAction" NOT NULL,
  "reason" "ReviewModerationReason" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewModerationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewModerationEvent_note_length_check" CHECK ("note" IS NULL OR char_length("note") <= 500)
);

CREATE UNIQUE INDEX "ReviewReport_open_reporter_review_key" ON "ReviewReport"("reviewId", "reporterId") WHERE "status" = 'OPEN';
CREATE INDEX "ReviewReport_reviewId_status_createdAt_idx" ON "ReviewReport"("reviewId", "status", "createdAt");
CREATE INDEX "ReviewReport_reporterId_createdAt_idx" ON "ReviewReport"("reporterId", "createdAt");
CREATE INDEX "ReviewReport_status_reason_createdAt_idx" ON "ReviewReport"("status", "reason", "createdAt");
CREATE INDEX "ReviewModerationEvent_reviewId_createdAt_idx" ON "ReviewModerationEvent"("reviewId", "createdAt");
CREATE INDEX "ReviewModerationEvent_moderatorId_createdAt_idx" ON "ReviewModerationEvent"("moderatorId", "createdAt");

ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewModerationEvent" ADD CONSTRAINT "ReviewModerationEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewModerationEvent" ADD CONSTRAINT "ReviewModerationEvent_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
