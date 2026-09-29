import "server-only";
import { Prisma, type DealStatus } from "@prisma/client";
import { prisma } from "./prisma";

export class DealError extends Error {}

export async function createDeal(conversationId: string, sellerId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, productId: true, buyerId: true, sellerId: true, product: { select: { status: true } }, buyer: { select: { blockedBy: { where: { blockerId: sellerId }, select: { blockerId: true } }, blocks: { where: { blockedId: sellerId }, select: { blockedId: true } } } } } });
  if (!conversation?.productId || conversation.sellerId !== sellerId || conversation.buyerId === sellerId || !conversation.product || conversation.product.status !== "ACTIVE" || conversation.buyer.blockedBy.length || conversation.buyer.blocks.length) throw new DealError("This conversation cannot create a deal.");
  try { return await prisma.deal.create({ data: { conversationId, productId: conversation.productId, sellerId: conversation.sellerId, buyerId: conversation.buyerId } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DealError("A deal already exists for this conversation."); throw error; }
}

export async function transitionDeal(dealId: string, actorId: string, action: "confirm" | "cancel" | "dispute", reason?: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`;
    const deal = await tx.deal.findUnique({ where: { id: dealId } });
    if (!deal || (deal.buyerId !== actorId && deal.sellerId !== actorId)) throw new DealError("Deal not found.");
    if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(deal.status)) throw new DealError("This deal can no longer be changed.");
    if (action === "cancel") return tx.deal.update({ where: { id: dealId }, data: { status: "CANCELLED" } });
    if (action === "dispute") return tx.deal.update({ where: { id: dealId }, data: { status: "DISPUTED", disputedAt: new Date(), disputeReason: reason?.trim().slice(0, 200) || null } });
    const buyerConfirming = actorId === deal.buyerId;
    if ((buyerConfirming && deal.status === "BUYER_CONFIRMED") || (!buyerConfirming && deal.status === "SELLER_CONFIRMED")) throw new DealError("You already confirmed this deal.");
    const both = buyerConfirming ? deal.status === "SELLER_CONFIRMED" : deal.status === "BUYER_CONFIRMED";
    const status = both ? "COMPLETED" : buyerConfirming ? "BUYER_CONFIRMED" : "SELLER_CONFIRMED";
    const completedAt = both ? new Date() : null;
    const updated = await tx.deal.update({ where: { id: dealId }, data: { status, completedAt } });
    const product = await tx.product.findUniqueOrThrow({ where: { id: deal.productId }, select: { quantity: true } });
    if (both && product.quantity !== null && product.quantity.lte(1)) await tx.product.update({ where: { id: deal.productId }, data: { status: "SOLD" } });
    return updated;
  });
}

export function dealStatusLabel(status: DealStatus, viewerId: string, buyerId: string, sellerId: string) {
  if (status === "PENDING") return "Waiting for buyer and seller confirmation";
  if (status === "BUYER_CONFIRMED") return viewerId === buyerId ? "Waiting for seller" : "Buyer confirmed - confirm to complete";
  if (status === "SELLER_CONFIRMED") return viewerId === sellerId ? "Waiting for buyer" : "Seller confirmed - confirm to complete";
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return "Disputed";
}

export async function canReview(userId: string, dealId: string, targetUserId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { buyerId: true, sellerId: true, status: true, reviews: { where: { reviewerId: userId }, select: { id: true }, take: 1 } } });
  return Boolean(deal && deal.status === "COMPLETED" && deal.reviews.length === 0 && userId !== targetUserId && ((deal.buyerId === userId && deal.sellerId === targetUserId) || (deal.sellerId === userId && deal.buyerId === targetUserId)));
}
