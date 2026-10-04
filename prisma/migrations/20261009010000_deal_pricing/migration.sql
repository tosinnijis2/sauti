DROP INDEX "Deal_conversationId_key";

ALTER TABLE "Deal"
  ADD COLUMN "agreedPrice" DECIMAL(12,2),
  ADD COLUMN "currency" CHAR(3);

ALTER TABLE "Deal"
  ADD CONSTRAINT "Deal_price_currency_pair_check" CHECK (("agreedPrice" IS NULL) = ("currency" IS NULL)),
  ADD CONSTRAINT "Deal_agreed_price_positive_check" CHECK ("agreedPrice" IS NULL OR "agreedPrice" > 0),
  ADD CONSTRAINT "Deal_currency_usd_check" CHECK ("currency" IS NULL OR "currency" = 'USD');

CREATE INDEX "Deal_conversationId_createdAt_idx" ON "Deal"("conversationId", "createdAt");

CREATE UNIQUE INDEX "Deal_active_conversation_key"
  ON "Deal"("conversationId")
  WHERE "status" IN ('PENDING', 'BUYER_CONFIRMED', 'SELLER_CONFIRMED');
