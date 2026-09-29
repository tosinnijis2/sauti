import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const key = (value: string) => createHash("sha256").update(value).digest("hex");

export async function recordListingView(productId: string, viewerId: string | null, anonymousId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { ownerId: true } });
  if (!product || product.ownerId === viewerId) return false;
  const viewerKey = key(viewerId ? `user:${viewerId}` : `anonymous:${anonymousId}`);
  const result = await prisma.productView.createMany({ data: { productId, viewerKey }, skipDuplicates: true });
  return result.count === 1;
}

export function newAnonymousViewerId() { return randomBytes(24).toString("hex"); }

export async function listingAnalytics(ownerId: string) {
  const products = await prisma.product.findMany({ where: { ownerId }, select: { id: true, item: true, status: true, createdAt: true, _count: { select: { views: true, favorites: true, conversations: { where: { buyerId: { not: ownerId } } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return products.map(product => ({ id: product.id, item: product.item, status: product.status, createdAt: product.createdAt, views: product._count.views, saves: product._count.favorites, conversations: product._count.conversations }));
}

export async function sellerTrustData(sellerId: string) {
  const [seller, statusCounts, conversations, completedDeals, reviewStats] = await Promise.all([
    prisma.user.findUnique({ where: { id: sellerId }, select: { emailVerifiedAt: true, createdAt: true, name: true, location: true, country: true, imageUrl: true } }),
    prisma.product.groupBy({ by: ["status"], where: { ownerId: sellerId }, _count: { _all: true } }),
    prisma.conversation.findMany({ where: { sellerId }, select: { buyerId: true, messages: { select: { authorId: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } }),
    prisma.deal.count({ where: { sellerId, status: "COMPLETED" } }),
    prisma.review.aggregate({ where: { targetId: sellerId, status: "PUBLISHED" }, _count: { _all: true }, _avg: { rating: true } }),
  ]);
  if (!seller) return null;
  const count = (status: string) => statusCounts.find(row => row.status === status)?._count._all ?? 0;
  const responseMinutes: number[] = [];
  for (const conversation of conversations) {
    const firstBuyer = conversation.messages.find(message => message.authorId === conversation.buyerId);
    const reply = firstBuyer && conversation.messages.find(message => message.authorId === sellerId && message.createdAt > firstBuyer.createdAt);
    if (firstBuyer && reply) responseMinutes.push((reply.createdAt.getTime() - firstBuyer.createdAt.getTime()) / 60_000);
  }
  responseMinutes.sort((a, b) => a - b);
  const medianResponseMinutes = responseMinutes.length >= 3 ? responseMinutes[Math.floor(responseMinutes.length / 2)] : null;
  return { ...seller, activeListings: count("ACTIVE"), soldListings: count("SOLD"), completedDeals, publishedReviewCount: reviewStats._count._all, averageRating: reviewStats._avg.rating, profileComplete: Boolean(seller.location && seller.country && seller.imageUrl), medianResponseMinutes };
}
