import "server-only";
import { Prisma, type SafetyReportReason, type SafetyReportStatus, type SafetyReportTarget } from "@prisma/client";
import { prisma } from "./prisma";
import { consumeRateLimit } from "./rate-limit";

export class SafetyReportError extends Error {}
const reasons = new Set<SafetyReportReason>(["HARASSMENT", "SPAM_OR_SCAM", "MISLEADING", "PERSONAL_INFORMATION", "PROHIBITED_OR_UNSAFE", "IMPERSONATION", "OTHER"]);

function reportText(rawReason: unknown, rawNote: unknown) {
  const reason = String(rawReason ?? "") as SafetyReportReason;
  const note = String(rawNote ?? "").trim();
  if (!reasons.has(reason)) throw new SafetyReportError("Choose a valid report reason.");
  if (note.length > 500 || /[<>]/.test(note)) throw new SafetyReportError("Report notes must be plain text up to 500 characters.");
  return { reason, note: note || null };
}

export async function createSafetyReport(reporterId: string, targetType: SafetyReportTarget, targetId: string, rawReason: unknown, rawNote: unknown) {
  const text = reportText(rawReason, rawNote);
  if (!targetId || targetId.length > 100) throw new SafetyReportError("Report target not found.");
  const recent = await prisma.safetyReport.count({ where: { reporterId, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } });
  if (recent >= 5) throw new SafetyReportError("Too many reports. Please try again later.");
  if (!await consumeRateLimit("safety-report", reporterId, 5, 60 * 60_000)) throw new SafetyReportError("Too many reports. Please try again later.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reporterId} FOR UPDATE`;
    const dedupeKey = `${reporterId}:${targetType}:${targetId}`;
    const common = { reporterId, targetType, reason: text.reason, note: text.note, dedupeKey };
    try {
      if (targetType === "USER") {
        if (targetId === reporterId) throw new SafetyReportError("You cannot report yourself.");
        const user = await tx.user.findUnique({ where: { id: targetId }, select: { name: true } });
        if (!user) throw new SafetyReportError("Account not found.");
        return await tx.safetyReport.create({ data: { ...common, targetUserId: targetId, targetUserName: user.name } });
      }
      if (targetType === "LISTING") {
        const listing = await tx.product.findUnique({ where: { id: targetId }, select: { item: true, ownerId: true } });
        if (!listing || listing.ownerId === reporterId) throw new SafetyReportError("Listing cannot be reported.");
        return await tx.safetyReport.create({ data: { ...common, listingId: targetId, listingName: listing.item } });
      }
      const message = await tx.message.findUnique({ where: { id: targetId }, select: { body: true, authorId: true, conversationId: true, country: true, author: { select: { name: true } } } });
      if (!message || message.authorId === reporterId) throw new SafetyReportError("Message cannot be reported.");
      if (message.conversationId && !await tx.conversation.findFirst({ where: { id: message.conversationId, OR: [{ buyerId: reporterId }, { sellerId: reporterId }] }, select: { id: true } })) throw new SafetyReportError("Message cannot be reported.");
      if (!message.conversationId && !message.country) throw new SafetyReportError("Message cannot be reported.");
      return await tx.safetyReport.create({ data: { ...common, messageId: targetId, messageBodySnapshot: message.body, messageAuthorName: message.author.name, conversationIdSnapshot: message.conversationId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new SafetyReportError("You already have an open report for this target.");
      throw error;
    }
  }, { timeout: 30_000 });
}

export async function closeSafetyReport(reportId: string, moderatorId: string, status: Extract<SafetyReportStatus, "RESOLVED" | "DISMISSED">, rawNote: unknown, deactivateListing = false) {
  const note = String(rawNote ?? "").trim();
  if (note.length > 500 || /[<>]/.test(note)) throw new SafetyReportError("Moderator notes must be plain text up to 500 characters.");
  return prisma.$transaction(async tx => {
    const admin = await tx.user.findUnique({ where: { id: moderatorId }, select: { role: true } });
    if (admin?.role !== "ADMIN") throw new SafetyReportError("Report not found.");
    const report = await tx.safetyReport.findUnique({ where: { id: reportId }, select: { status: true, reporterId: true, listingId: true, targetType: true } });
    if (!report || report.status !== "OPEN") throw new SafetyReportError("Report is already closed.");
    if (deactivateListing) {
      if (report.targetType !== "LISTING" || !report.listingId) throw new SafetyReportError("This report does not reference a listing.");
      await tx.product.update({ where: { id: report.listingId }, data: { status: "INACTIVE" } });
    }
    const updated = await tx.safetyReport.update({ where: { id: reportId }, data: { status, dedupeKey: null, resolvedAt: new Date(), moderatorId, moderatorNote: note || null } });
    await tx.notification.create({ data: { userId: report.reporterId, type: "SAFETY_REPORT", title: "Safety report reviewed", message: status === "RESOLVED" ? "Your marketplace safety report was reviewed and resolved." : "Your marketplace safety report was reviewed and dismissed.", href: "/notifications" } });
    return updated;
  }, { timeout: 30_000 });
}
