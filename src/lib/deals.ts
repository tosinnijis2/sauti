import "server-only";
import { Prisma, type DealStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { isInteractionBlocked } from "./interactions";

export class DealError extends Error {}

export function dealsAwaitingConfirmationWhere(userId: string): Prisma.DealWhereInput {
  return {
    OR: [
      { buyerId: userId, status: { in: ["PENDING", "SELLER_CONFIRMED"] } },
      { sellerId: userId, status: { in: ["PENDING", "BUYER_CONFIRMED"] } },
    ],
  };
}

function dealQuantity(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(text)) throw new DealError("Enter a quantity with up to three decimal places.");
  const quantity = new Prisma.Decimal(text);
  if (quantity.lte(0)) throw new DealError("Deal quantity must be greater than zero.");
  return quantity;
}

function dealPrice(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) throw new DealError("Enter an agreed price with no more than two decimal places.");
  const price = new Prisma.Decimal(text);
  if (price.lte(0)) throw new DealError("Agreed price must be greater than zero.");
  return price;
}

export async function createDeal(conversationId: string, sellerId: string, rawQuantity: unknown, rawAgreedPrice: unknown) {
  const quantity = dealQuantity(rawQuantity);
  const agreedPrice = dealPrice(rawAgreedPrice);
  return prisma.$transaction(async tx => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { id: true, productId: true, buyerId: true, sellerId: true } });
    if (!conversation?.productId || conversation.sellerId !== sellerId || conversation.buyerId === sellerId || await isInteractionBlocked(conversation.buyerId, conversation.sellerId, tx)) throw new DealError("This conversation cannot create a deal.");
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${conversation.productId} FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: conversation.productId }, select: { status: true, unit: true, quantity: true, remainingQuantity: true } });
    const available = product?.remainingQuantity ?? product?.quantity;
    if (!product || product.status !== "ACTIVE" || !product.unit || !available || quantity.gt(available)) throw new DealError("Enter a quantity within the available inventory.");
    try {
      const deal = await tx.deal.create({ data: { conversationId, productId: conversation.productId, sellerId: conversation.sellerId, buyerId: conversation.buyerId, quantity, unit: product.unit, agreedPrice, currency: "USD" } });
      await tx.notification.create({ data: { userId: conversation.buyerId, conversationId, type: "DEAL_UPDATE", title: "New deal proposal", message: `Review ${quantity.toString()} ${product.unit} at $${agreedPrice.toFixed(2)} agreed.`, href: `/messages/${conversationId}#deal-${deal.id}` } });
      return deal;
    }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DealError("An active deal already exists for this conversation."); throw error; }
  });
}

export async function transitionDeal(dealId: string, actorId: string, action: "confirm" | "cancel" | "dispute", reason?: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`;
    const deal = await tx.deal.findUnique({ where: { id: dealId } });
    if (!deal || (deal.buyerId !== actorId && deal.sellerId !== actorId)) throw new DealError("Deal not found.");
    if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(deal.status)) throw new DealError("This deal can no longer be changed.");
    if (action === "confirm" && await isInteractionBlocked(deal.buyerId, deal.sellerId, tx)) throw new DealError("This deal cannot be confirmed while interaction is blocked.");
    const otherParticipantId = actorId === deal.buyerId ? deal.sellerId : deal.buyerId;
    if (action === "cancel" || action === "dispute") {
      const status = action === "cancel" ? "CANCELLED" : "DISPUTED";
      const updated = await tx.deal.update({ where: { id: dealId }, data: action === "cancel" ? { status, cancelledAt: new Date() } : { status, disputedAt: new Date(), disputeReason: reason?.trim().slice(0, 200) || null } });
      await tx.notification.create({ data: { userId: otherParticipantId, conversationId: deal.conversationId, type: "DEAL_UPDATE", title: `Deal ${status.toLowerCase()}`, message: `The marketplace deal was ${status.toLowerCase()}.`, href: `/messages/${deal.conversationId}#deal-${deal.id}` } });
      return updated;
    }
    if (!deal.quantity || !deal.unit) throw new DealError("This legacy deal does not have an inventory quantity.");
    const buyerConfirming = actorId === deal.buyerId;
    if ((buyerConfirming && deal.status === "BUYER_CONFIRMED") || (!buyerConfirming && deal.status === "SELLER_CONFIRMED")) throw new DealError("You already confirmed this deal.");
    const both = buyerConfirming ? deal.status === "SELLER_CONFIRMED" : deal.status === "BUYER_CONFIRMED";
    if (!both) {
      const updated = await tx.deal.update({ where: { id: dealId }, data: { status: buyerConfirming ? "BUYER_CONFIRMED" : "SELLER_CONFIRMED", ...(buyerConfirming ? { buyerConfirmedAt: new Date() } : { sellerConfirmedAt: new Date() }) } });
      await tx.notification.create({ data: { userId: otherParticipantId, conversationId: deal.conversationId, type: "DEAL_UPDATE", title: "Deal confirmation needed", message: "The other participant confirmed. Review the agreed terms and confirm when ready.", href: `/messages/${deal.conversationId}#deal-${deal.id}` } });
      return updated;
    }
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${deal.productId} FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: deal.productId }, select: { quantity: true, originalQuantity: true, remainingQuantity: true, unit: true } });
    const available = product?.remainingQuantity ?? product?.quantity;
    if (!product || !available || product.unit !== deal.unit || available.lt(deal.quantity)) throw new DealError("The listing no longer has enough compatible inventory.");
    const remaining = available.sub(deal.quantity);
    if (remaining.lt(0)) throw new DealError("The listing no longer has enough inventory.");
    const completedAt = new Date();
    const updated = await tx.deal.update({ where: { id: dealId }, data: { status: "COMPLETED", completedAt, ...(buyerConfirming ? { buyerConfirmedAt: completedAt } : { sellerConfirmedAt: completedAt }) } });
    await tx.product.update({ where: { id: deal.productId }, data: {
      originalQuantity: product.originalQuantity ?? product.quantity,
      remainingQuantity: remaining,
      status: remaining.eq(0) ? "SOLD" : "ACTIVE",
    } });
    await tx.notification.createMany({ data: [deal.buyerId, deal.sellerId].map(userId => ({ userId, conversationId: deal.conversationId, type: "DEAL_UPDATE" as const, title: "Deal completed", message: `${deal.quantity?.toString()} ${deal.unit} at $${deal.agreedPrice?.toFixed(2)} agreed was confirmed by both participants.`, href: `/deals#deal-${deal.id}` })) });
    return updated;
  });
}

export function dealStatusLabel(status: DealStatus, viewerId: string, buyerId: string, sellerId: string) {
  void viewerId; void buyerId; void sellerId;
  if (status === "PENDING") return "Pending confirmation";
  if (status === "BUYER_CONFIRMED") return "Waiting for seller";
  if (status === "SELLER_CONFIRMED") return "Waiting for buyer";
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return "Disputed";
}

export async function canReview(userId: string, dealId: string, targetUserId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { buyerId: true, sellerId: true, status: true, reviews: { where: { reviewerId: userId }, select: { id: true }, take: 1 } } });
  return Boolean(deal && deal.status === "COMPLETED" && deal.reviews.length === 0 && userId !== targetUserId && !await isInteractionBlocked(userId, targetUserId) && ((deal.buyerId === userId && deal.sellerId === targetUserId) || (deal.sellerId === userId && deal.buyerId === targetUserId)));
}
