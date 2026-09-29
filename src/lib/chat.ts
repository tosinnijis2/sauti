import { prisma } from "./prisma";
import { isCountry } from "./countries";

export class ChatError extends Error {}

export async function canReadConversation(id: string, userId: string) {
  return prisma.conversation.findFirst({ where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] }, include: { buyer: { select: { id: true, name: true } }, seller: { select: { id: true, name: true } }, product: { select: { item: true, price: true, country: true, status: true } } } });
}

export async function isBlocked(a: string, b: string) {
  return Boolean(await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } }));
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

export async function sendChat(userId: string, target: { conversationId?: string; country?: string }, body: string) {
  const text = body.trim();
  if (!text || text.length > 2000) throw new ChatError("Enter a message of 1 to 2,000 characters.");
  if (Boolean(target.country) === Boolean(target.conversationId)) throw new ChatError("Choose a conversation or country room.");
  if (target.country && !isCountry(target.country)) throw new ChatError("Choose a valid country.");
  const conversation = target.conversationId ? await canReadConversation(target.conversationId, userId) : null;
  if (target.conversationId && !conversation) throw new ChatError("Conversation not found.");
  if (conversation && await isBlocked(conversation.buyerId, conversation.sellerId)) throw new ChatError("Messaging is unavailable between these accounts.");
  return prisma.$transaction(async tx => {
    // Serialize sends per account so parallel submissions cannot bypass the cooldown.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const recent = await tx.message.findFirst({ where: { authorId: userId, createdAt: { gt: new Date(Date.now() - 2000) } } });
    if (recent) throw new ChatError("Please wait a moment before sending another message.");
    const message = await tx.message.create({ data: { authorId: userId, body: text, conversationId: conversation?.id, country: target.country } });
    if (conversation) await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return message;
  });
}

export async function visibleMessages(userId: string, target: { conversationId?: string; country?: string }, before?: string) {
  if (Boolean(target.country) === Boolean(target.conversationId)) throw new Error("Invalid channel.");
  if (target.conversationId && !await canReadConversation(target.conversationId, userId)) throw new Error("Conversation not found.");
  if (target.country && !isCountry(target.country)) throw new Error("Invalid country.");
  const blocks = await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } });
  const date = before ? new Date(before) : null;
  if (date && Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  const messages = await prisma.message.findMany({
    where: { ...target, hidden: false, authorId: { notIn: blocks.map(b => b.blockedId) }, ...(date ? { createdAt: { lt: date } } : {}) },
    include: { author: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
  });
  return messages.reverse();
}
