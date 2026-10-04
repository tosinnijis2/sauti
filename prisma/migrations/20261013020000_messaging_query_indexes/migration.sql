CREATE INDEX "Conversation_buyerId_buyerUnreadCount_idx" ON "Conversation"("buyerId", "buyerUnreadCount");
CREATE INDEX "Conversation_sellerId_sellerUnreadCount_idx" ON "Conversation"("sellerId", "sellerUnreadCount");
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");
