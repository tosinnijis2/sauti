import "server-only";
import { prisma } from "./prisma";
import { productCardSelect } from "./market";
import { savedProductIds } from "./favorites";
import { listingAnalytics } from "./listing-analytics";
import { dealsAwaitingConfirmationWhere } from "./deals";
import { unreadConversationCount } from "./chat";
import { isInteractionBlocked } from "./interactions";

export async function dashboardData(userId: string, country: string | null) {
  const membership = { OR: [{ buyerId: userId }, { sellerId: userId }] };
  const visible = { hidden: false, author: { blockedBy: { none: { blockerId: userId } } } };
  const [listingCount, savedCount, savedSearchCount, conversationCount, listings, favorites, fresh, conversations, community] = await Promise.all([
    prisma.product.count({ where: { ownerId: userId } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.savedSearch.count({ where: { userId } }),
    prisma.conversation.count({ where: membership }),
    prisma.product.findMany({ where: { ownerId: userId }, select: productCardSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 3 }),
    prisma.favorite.findMany({ where: { userId }, select: { product: { select: productCardSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 3 }),
    prisma.product.findMany({ where: { ownerId: { not: userId }, status: "ACTIVE" }, select: productCardSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 3 }),
    prisma.conversation.findMany({ where: membership, select: {
      id: true, productName: true, buyerId: true,
      buyer: { select: { name: true, imageUrl: true } }, seller: { select: { name: true, imageUrl: true } },
      messages: { where: visible, select: { body: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
    }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 3 }),
    country ? prisma.message.findMany({ where: { ...visible, country, conversationId: null }, select: { id: true, body: true, createdAt: true, author: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 3 }) : Promise.resolve([]),
  ]);
  const [saved, sellingAnalytics] = await Promise.all([savedProductIds(userId, fresh.map(product => product.id)), listingAnalytics(userId)]);
  const sellerPerformance = { active: sellingAnalytics.filter(item => item.status === "ACTIVE").length, views: sellingAnalytics.reduce((total, item) => total + item.views, 0), saves: sellingAnalytics.reduce((total, item) => total + item.saves, 0), conversations: sellingAnalytics.reduce((total, item) => total + item.conversations, 0) };
  const [unreadConversations, waitingConfirmations, reviewCandidates] = await Promise.all([
    unreadConversationCount(userId),
    prisma.deal.count({ where: dealsAwaitingConfirmationWhere(userId) }),
    prisma.deal.findMany({ where: { status: "COMPLETED", OR: [{ buyerId: userId }, { sellerId: userId }], reviews: { none: { reviewerId: userId } } }, select: { buyerId: true, sellerId: true } }),
  ]);
  const reviewEligible = (await Promise.all(reviewCandidates.map(async deal => !await isInteractionBlocked(userId, deal.buyerId === userId ? deal.sellerId : deal.buyerId)))).filter(Boolean).length;
  return { listingCount, savedCount, savedSearchCount, conversationCount, listings, favorites, fresh, conversations, community, saved, sellerPerformance, marketplaceActivity: { unreadConversations, waitingConfirmations, reviewEligible, activeListings: sellerPerformance.active } };
}
