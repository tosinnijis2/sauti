import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { SignJWT } from "jose";
import ts from "typescript";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { createReview, moderateReview, reportReview, resolveReviewReport, ReviewError } = require("../src/lib/reviews.ts");
const { sellerTrustData } = require("../src/lib/listing-analytics.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const users = [];
async function user(name, role = "USER") { const row = await prisma.user.create({ data: { name, role, email: `review-ops-${randomUUID()}@example.invalid`, passwordHash: "disabled", location: "Nairobi", country: "KE" } }); users.push(row); return row; }
async function cookie(account) { const token = await new SignJWT({ version: account.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(account.id).setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET)); return `sauti_session=${token}`; }
async function reviewFixture(seller, buyer, comment, rating = 5) { const product = await prisma.product.create({ data: { ownerId: seller.id, item: `Moderation fixture ${randomUUID()}`, category: "Other", price: "10", quantity: "1", unit: "ITEM", status: "SOLD", location: "Nairobi", country: "KE", description: "Private moderation fixture" } }); const conversation = await prisma.conversation.create({ data: { productId: product.id, productName: product.item, buyerId: buyer.id, sellerId: seller.id } }); const deal = await prisma.deal.create({ data: { productId: product.id, conversationId: conversation.id, sellerId: seller.id, buyerId: buyer.id, status: "COMPLETED", completedAt: new Date() } }); return createReview(deal.id, buyer.id, rating, comment); }

try {
  await prisma.user.deleteMany({ where: { email: { startsWith: "review-ops-" } } });
  const seller = await user("Moderation Seller"); const author = await user("Moderation Author"); const reporter = await user("Secret Reporter"); const outsider = await user("Other Reporter"); const admin = await user("Moderation Admin", "ADMIN"); const member = await user("Moderation Member");
  const marker = `Published-${randomUUID()}`; const review = await reviewFixture(seller, author, marker, 5);
  await assert.rejects(() => reportReview(review.id, reporter.id, "SPAM", "not public yet"), ReviewError);
  await moderateReview(review.id, admin.id, "publish", "OTHER", "Initial publication");
  const publishedEvent = await prisma.reviewModerationEvent.findFirstOrThrow({ where: { reviewId: review.id } }); assert.equal(publishedEvent.action, "PUBLISHED"); assert.equal(publishedEvent.reason, "OTHER"); assert.equal(publishedEvent.note, "Initial publication");
  const authorPublishedNotice = await prisma.notification.findFirst({ where: { userId: author.id, type: "REVIEW_MODERATION", title: { contains: "published" } } }); assert.ok(authorPublishedNotice); assert.ok(!authorPublishedNotice.message.includes(reporter.name));

  const report = await reportReview(review.id, reporter.id, "SPAM", "Repeated promotional content"); assert.equal(report.status, "OPEN"); assert.equal(report.reason, "SPAM");
  await assert.rejects(() => reportReview(review.id, reporter.id, "SPAM", "duplicate"), ReviewError);
  await assert.rejects(() => reportReview(review.id, author.id, "OTHER", "own review"), ReviewError);
  await resolveReviewReport(report.id, admin.id, "DISMISSED");
  assert.equal((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).status, "PUBLISHED", "dismissal cannot change review visibility");
  assert.ok(await prisma.notification.findFirst({ where: { userId: reporter.id, title: "Review report resolved", message: { contains: "dismissed" } } }));

  const secondReport = await reportReview(review.id, outsider.id, "PERSONAL_INFORMATION", "Contains private details");
  await assert.rejects(() => moderateReview(review.id, member.id, "hide", "PRIVACY", "unauthorized"), ReviewError);
  await moderateReview(review.id, admin.id, "hide", "PRIVACY", "Removed personal information exposure");
  await resolveReviewReport(secondReport.id, admin.id, "RESOLVED");
  const events = await prisma.reviewModerationEvent.findMany({ where: { reviewId: review.id }, orderBy: { createdAt: "asc" } }); assert.equal(events.length, 2); assert.deepEqual(events.map(event => [event.action, event.reason]), [["PUBLISHED", "OTHER"], ["HIDDEN", "PRIVACY"]]); assert.equal(events[0].note, "Initial publication", "earlier audit event remains unchanged");
  assert.ok(await prisma.notification.findFirst({ where: { userId: author.id, title: { contains: "hidden" } } })); assert.ok(await prisma.notification.findFirst({ where: { userId: outsider.id, title: "Review report resolved", message: { contains: "resolved" } } }));

  const removeMarker = `Removed-${randomUUID()}`; const removed = await reviewFixture(seller, author, removeMarker, 1); await moderateReview(removed.id, admin.id, "publish", "OTHER"); await moderateReview(removed.id, admin.id, "remove", "POLICY_VIOLATION", "Policy breach");
  const pendingMarker = `Pending-${randomUUID()}`; await reviewFixture(seller, author, pendingMarker, 3);
  const trust = await sellerTrustData(seller.id); assert.equal(trust.publishedReviewCount, 0); assert.equal(trust.averageRating, null);

  const reporterCookie = await cookie(reporter); const memberCookie = await cookie(member); const adminCookie = await cookie(admin);
  assert.equal((await fetch(`${base}/admin/reviews`, { headers: { Cookie: memberCookie }, redirect: "manual" })).status, 404);
  const adminResponse = await fetch(`${base}/admin/reviews?status=HIDDEN&reportStatus=DISMISSED&reason=SPAM&q=${encodeURIComponent(seller.name)}&order=oldest`, { headers: { Cookie: adminCookie } }); assert.equal(adminResponse.status, 200); const adminHtml = await adminResponse.text(); assert.ok(adminHtml.includes("Review moderation") && adminHtml.includes("Moderation history") && adminHtml.includes("Initial publication") && adminHtml.includes(reporter.name));
  const publicHtml = await (await fetch(`${base}/sellers/${seller.id}`, { headers: { Cookie: reporterCookie } })).text(); for (const hidden of [marker, removeMarker, pendingMarker, reporter.email, "Repeated promotional content", "Contains private details", "Private moderation fixture"]) assert.ok(!publicHtml.includes(hidden), `public profile leaked ${hidden}`);
  const reporterNotices = await prisma.notification.findMany({ where: { userId: reporter.id, type: "REVIEW_MODERATION" } }); assert.ok(reporterNotices.length > 0); for (const notice of reporterNotices) assert.ok(!notice.message.includes(admin.name) && !notice.message.includes("Initial publication"));
  console.log("PASS REVIEW MODERATION: public-only reports, duplicate/self prevention, structured reasons, immutable events, explicit report closure, safe notifications, admin filters, and immediate public aggregate privacy.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(item => item.id) } } });
  await prisma.$disconnect(); Module._load = load;
}
