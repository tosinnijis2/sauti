CREATE TYPE "DealStatus" AS ENUM ('PENDING', 'BUYER_CONFIRMED', 'SELLER_CONFIRMED', 'COMPLETED', 'CANCELLED', 'DISPUTED');
CREATE TABLE "Deal" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "status" "DealStatus" NOT NULL DEFAULT 'PENDING',
  "disputeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Deal_conversationId_key" ON "Deal"("conversationId");
CREATE INDEX "Deal_sellerId_createdAt_idx" ON "Deal"("sellerId", "createdAt");
CREATE INDEX "Deal_buyerId_createdAt_idx" ON "Deal"("buyerId", "createdAt");
CREATE INDEX "Deal_status_createdAt_idx" ON "Deal"("status", "createdAt");
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
