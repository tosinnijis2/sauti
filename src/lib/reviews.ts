import "server-only";
import { Prisma, type ReviewModerationReason, type ReviewReportReason, type ReviewReportStatus, type ReviewStatus } from "@prisma/client";
import { canReview } from "./deals";
import { prisma } from "./prisma";

export class ReviewError extends Error {}
const reportReasons = new Set<ReviewReportReason>(["HARASSMENT", "SPAM", "FALSE_INFORMATION", "PERSONAL_INFORMATION", "OFF_TOPIC", "OTHER"]);
const moderationReasons = new Set<ReviewModerationReason>(["POLICY_VIOLATION", "HARASSMENT", "SPAM", "PRIVACY", "FRAUD_OR_MISREPRESENTATION", "OTHER"]);

export async function createReview(dealId: string, reviewerId: string, rawRating: unknown, rawComment: unknown) {
  const rating = Number(rawRating);
  const comment = String(rawComment ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError("Choose a whole-number rating from 1 to 5.");
  if (comment.length > 500) throw new ReviewError("Review comments must be 500 characters or fewer.");
  if (/[<>]/.test(comment)) throw new ReviewError("Review comments cannot contain HTML.");
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { buyerId: true, sellerId: true } });
  if (!deal || (deal.buyerId !== reviewerId && deal.sellerId !== reviewerId)) throw new ReviewError("This deal is not eligible for review.");
  const targetId = reviewerId === deal.buyerId ? deal.sellerId : deal.buyerId;
  if (!await canReview(reviewerId, dealId, targetId)) throw new ReviewError("This review opportunity is unavailable or already used.");
  try {
    return await prisma.review.create({ data: { dealId, reviewerId, targetId, rating, comment: comment || null } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ReviewError("This review opportunity has already been used.");
    throw error;
  }
}

export async function reportReview(reviewId: string, reporterId: string, rawReason: unknown, rawNote: unknown) {
  const reason = String(rawReason ?? "") as ReviewReportReason;
  const note = String(rawNote ?? "").trim();
  if (!reportReasons.has(reason)) throw new ReviewError("Choose a valid report reason.");
  if (note.length > 500 || /[<>]/.test(note)) throw new ReviewError("Report notes must be plain text up to 500 characters.");
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { reviewerId: true, targetId: true, status: true } });
  if (!review || review.status !== "PUBLISHED" || review.reviewerId === reporterId) throw new ReviewError("This review cannot be reported.");
  const recentReports = await prisma.reviewReport.count({ where: { reporterId, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } });
  if (recentReports >= 10) throw new ReviewError("Too many reports. Please try again later.");
  try {
    return await prisma.reviewReport.create({ data: { reviewId, reporterId, reason, note: note || null }, include: { review: { select: { targetId: true } } } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ReviewError("You already have an open report for this review.");
    throw error;
  }
}

export async function moderateReview(reviewId: string, adminId: string, action: "publish" | "hide" | "remove", rawReason: unknown = "OTHER", rawNote: unknown = "") {
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true, name: true } });
  if (admin?.role !== "ADMIN") throw new ReviewError("Review not found.");
  const reason = String(rawReason ?? "") as ReviewModerationReason;
  const note = String(rawNote ?? "").trim();
  if (!moderationReasons.has(reason)) throw new ReviewError("Choose a valid moderation reason.");
  if (note.length > 500 || /[<>]/.test(note)) throw new ReviewError("Moderator notes must be plain text up to 500 characters.");
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { status: true, reviewerId: true } });
  if (!review || review.status === "REMOVED") throw new ReviewError("This review can no longer be moderated.");
  const now = new Date();
  const status: ReviewStatus = action === "publish" ? "PUBLISHED" : action === "hide" ? "HIDDEN" : "REMOVED";
  if (review.status === status) throw new ReviewError("The review is already in that state.");
  return prisma.$transaction(async tx => {
    const updated = await tx.review.update({ where: { id: reviewId }, data: { status, moderatedAt: now, moderatedById: adminId, ...(status === "PUBLISHED" ? { publishedAt: now } : status === "HIDDEN" ? { hiddenAt: now } : { removedAt: now }) } });
    await tx.reviewModerationEvent.create({ data: { reviewId, moderatorId: adminId, moderatorName: admin.name, action: status, reason, note: note || null } });
    await tx.notification.create({ data: { userId: review.reviewerId, type: "REVIEW_MODERATION", title: status === "PUBLISHED" ? "Your review was published" : `Your review was ${status.toLowerCase()}`, message: status === "PUBLISHED" ? "Your marketplace review is now visible on the seller profile." : `Your marketplace review is no longer public following moderation.`, href: "/deals" } });
    return updated;
  });
}

export async function resolveReviewReport(reportId: string, adminId: string, status: Extract<ReviewReportStatus, "RESOLVED" | "DISMISSED">) {
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
  if (admin?.role !== "ADMIN") throw new ReviewError("Report not found.");
  return prisma.$transaction(async tx => {
    const report = await tx.reviewReport.findUnique({ where: { id: reportId }, select: { reporterId: true, status: true } });
    if (!report || report.status !== "OPEN") throw new ReviewError("This report is already closed.");
    const updated = await tx.reviewReport.update({ where: { id: reportId }, data: { status, resolvedAt: new Date() } });
    await tx.notification.create({ data: { userId: report.reporterId, type: "REVIEW_MODERATION", title: "Review report resolved", message: status === "DISMISSED" ? "Your review report was reviewed and dismissed." : "Your review report was reviewed and resolved.", href: "/notifications" } });
    return updated;
  });
}
