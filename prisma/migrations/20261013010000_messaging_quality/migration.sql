ALTER TYPE "NotificationType" ADD VALUE 'PRIVATE_MESSAGE';

ALTER TABLE "Conversation"
  ADD COLUMN "buyerUnreadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sellerUnreadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "buyerLastReadAt" TIMESTAMP(3),
  ADD COLUMN "sellerLastReadAt" TIMESTAMP(3);

ALTER TABLE "Message" ADD COLUMN "clientMessageId" TEXT;
CREATE UNIQUE INDEX "Message_clientMessageId_key" ON "Message"("clientMessageId");

ALTER TABLE "Notification" ADD COLUMN "conversationId" TEXT;
CREATE INDEX "Notification_conversationId_userId_readAt_idx" ON "Notification"("conversationId", "userId", "readAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Deal"
  ADD COLUMN "buyerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "sellerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);
