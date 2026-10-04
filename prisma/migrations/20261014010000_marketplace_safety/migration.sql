ALTER TYPE "NotificationType" ADD VALUE 'SAFETY_REPORT';
ALTER TABLE "UserBlock" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TYPE "SafetyReportTarget" AS ENUM ('USER', 'LISTING', 'MESSAGE');
CREATE TYPE "SafetyReportReason" AS ENUM ('HARASSMENT', 'SPAM_OR_SCAM', 'MISLEADING', 'PERSONAL_INFORMATION', 'PROHIBITED_OR_UNSAFE', 'IMPERSONATION', 'OTHER');
CREATE TYPE "SafetyReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "SafetyReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "SafetyReportTarget" NOT NULL,
  "targetUserId" TEXT,
  "listingId" TEXT,
  "messageId" TEXT,
  "reason" "SafetyReportReason" NOT NULL,
  "note" TEXT,
  "status" "SafetyReportStatus" NOT NULL DEFAULT 'OPEN',
  "dedupeKey" TEXT,
  "targetUserName" TEXT,
  "listingName" TEXT,
  "messageBodySnapshot" TEXT,
  "messageAuthorName" TEXT,
  "conversationIdSnapshot" TEXT,
  "moderatorId" TEXT,
  "moderatorNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SafetyReport_dedupeKey_key" ON "SafetyReport"("dedupeKey");
CREATE INDEX "SafetyReport_status_createdAt_idx" ON "SafetyReport"("status", "createdAt");
CREATE INDEX "SafetyReport_targetType_reason_createdAt_idx" ON "SafetyReport"("targetType", "reason", "createdAt");
CREATE INDEX "SafetyReport_reporterId_createdAt_idx" ON "SafetyReport"("reporterId", "createdAt");
CREATE INDEX "SafetyReport_targetUserId_idx" ON "SafetyReport"("targetUserId");
CREATE INDEX "SafetyReport_listingId_idx" ON "SafetyReport"("listingId");
CREATE INDEX "SafetyReport_messageId_idx" ON "SafetyReport"("messageId");
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
