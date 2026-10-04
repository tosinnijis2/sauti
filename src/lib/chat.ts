import { prisma } from "./prisma";
import { isCountry } from "./countries";
import { isInteractionBlocked } from "./interactions";

export class ChatError extends Error {}

export async function canReadConversation(id: string, userId: string) {
  return prisma.conversation.findFirst({ where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] }, include: { buyer: { select: { id: true, name: true, imageUrl: true } }, seller: { select: { id: true, name: true, imageUrl: true } }, product: { select: { item: true, price: true, country: true, status: true, quantity: true, originalQuantity: true, remainingQuantity: true, unit: true, imageUrl: true, commodity: true } } } });
}

export async function isBlocked(a: string, b: string) {
  return isInteractionBlocked(a, b);
}

export async function startConversation(productId: string, buyerId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.ownerId === buyerId) throw new ChatError("Choose another seller's listing.");
  if (await isBlocked(buyerId, product.ownerId)) throw new ChatError("Messaging is unavailable between these accounts.");
  return prisma.conversation.upsert({
    where: { productId_buyerId: { productId, buyerId } },
    create: { productId, buyerId, sellerId: product.ownerId, productName: product.item },
    update: {},
  });
}

export async function markConversationRead(conversationId: string, userId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const conversation = await tx.conversation.findFirst({ where: { id: conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] }, select: { buyerId: true, sellerId: true } });
    if (!conversation) throw new ChatError("Conversation not found.");
    await tx.conversation.update({ where: { id: conversationId }, data: conversation.buyerId === userId ? { buyerUnreadCount: 0, buyerLastReadAt: now } : { sellerUnreadCount: 0, sellerLastReadAt: now } });
    await tx.notification.updateMany({ where: { conversationId, userId, type: "PRIVATE_MESSAGE", readAt: null }, data: { readAt: now } });
  });
}

export async function unreadConversationCount(userId: string) {
  return prisma.conversation.count({ where: { OR: [{ buyerId: userId, buyerUnreadCount: { gt: 0 } }, { sellerId: userId, sellerUnreadCount: { gt: 0 } }] } });
}

export async function sendChat(userId: string, target: { conversationId?: string; country?: string }, body: string, clientMessageId?: string) {
  const text = body.trim();
  if (!text || text.length > 2000) throw new ChatError("Enter a message of 1 to 2,000 characters.");
  if (Boolean(target.country) === Boolean(target.conversationId)) throw new ChatError("Choose a conversation or country room.");
  if (target.country && !isCountry(target.country)) throw new ChatError("Choose a valid country.");
  if (clientMessageId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientMessageId)) throw new ChatError("Invalid message request.");
  const conversation = target.conversationId ? await canReadConversation(target.conversationId, userId) : null;
  if (target.conversationId && !conversation) throw new ChatError("Conversation not found.");
  if (conversation && await isBlocked(conversation.buyerId, conversation.sellerId)) throw new ChatError("Messaging is unavailable between these accounts.");
  return prisma.$transaction(async tx => {
    // Serialize sends per account so parallel submissions cannot bypass the cooldown.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (clientMessageId) {
      const existing = await tx.message.findUnique({ where: { clientMessageId } });
      if (existing) {
        if (existing.authorId !== userId) throw new ChatError("Invalid message request.");
        return existing;
      }
    }
    const recent = await tx.message.findFirst({ where: { authorId: userId, createdAt: { gt: new Date(Date.now() - 2000) } } });
    if (recent) throw new ChatError("Please wait a moment before sending another message.");
    const message = await tx.message.create({ data: { authorId: userId, body: text, conversationId: conversation?.id, country: target.country, clientMessageId } });
    if (conversation) {
      const recipientId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
      const updated = await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date(), ...(conversation.buyerId === recipientId ? { buyerUnreadCount: { increment: 1 } } : { sellerUnreadCount: { increment: 1 } }) }, select: { buyerUnreadCount: true, sellerUnreadCount: true, productName: true } });
      const unread = conversation.buyerId === recipientId ? updated.buyerUnreadCount : updated.sellerUnreadCount;
      const existingNotification = await tx.notification.findFirst({ where: { conversationId: conversation.id, userId: recipientId, type: "PRIVATE_MESSAGE", readAt: null }, orderBy: { createdAt: "desc" } });
      const data = { title: unread === 1 ? `New message about ${updated.productName}` : `${unread} new messages about ${updated.productName}`, message: `Open the conversation to read ${unread === 1 ? "the message" : "them"}.`, href: `/messages/${conversation.id}`, createdAt: new Date() };
      if (existingNotification) await tx.notification.update({ where: { id: existingNotification.id }, data });
      else await tx.notification.create({ data: { userId: recipientId, conversationId: conversation.id, type: "PRIVATE_MESSAGE", ...data } });
    }
    return message;
  });
}

export async function messagePage(userId: string, target: { conversationId?: string; country?: string }, before?: string) {
  if (Boolean(target.country) === Boolean(target.conversationId)) throw new Error("Invalid channel.");
  if (target.conversationId && !await canReadConversation(target.conversationId, userId)) throw new Error("Conversation not found.");
  if (target.country && !isCountry(target.country)) throw new Error("Invalid country.");
  const blocks = target.country ? await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } }) : [];
  let cursor: { id: string } | undefined;
  if (before) {
    const boundary = await prisma.message.findFirst({ where: { id: before, ...target }, select: { id: true } });
    if (!boundary) throw new Error("Invalid cursor.");
    cursor = { id: boundary.id };
  }
  const messages = await prisma.message.findMany({
    where: { ...target, hidden: false, authorId: { notIn: blocks.map(b => b.blockedId) } },
    include: { author: { select: { name: true, imageUrl: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    ...(cursor ? { cursor, skip: 1 } : {}),
  });
  const hasMore = messages.length > 50;
  const page = messages.slice(0, 50).reverse();
  return { messages: page, nextCursor: hasMore ? page[0]?.id ?? null : null };
}

export async function visibleMessages(userId: string, target: { conversationId?: string; country?: string }, before?: string) {
  return (await messagePage(userId, target, before)).messages;
}
