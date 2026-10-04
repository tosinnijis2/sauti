import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

process.loadEnvFile(); const require = createRequire(import.meta.url); const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { blockInteraction, unblockInteraction, isInteractionBlocked } = require("../src/lib/interactions.ts");
const { startConversation, sendChat, visibleMessages } = require("../src/lib/chat.ts");
const { createDeal } = require("../src/lib/deals.ts");
const { createReview } = require("../src/lib/reviews.ts");
const { createSafetyReport, closeSafetyReport } = require("../src/lib/safety-reports.ts");
const marker = `Safety-${randomUUID()}`; const users = [];
async function user(name, role = "USER") { const value = await prisma.user.create({ data: { name: `${marker} ${name}`, email: `${marker}-${name}@example.invalid`, passwordHash: "disabled", role, country: "KE" } }); users.push(value); return value; }
async function listing(ownerId, item = "maize") { return prisma.product.create({ data: { item: `${marker} ${item}`, category: "Cereals", price: "20", quantity: "10", originalQuantity: "10", remainingQuantity: "10", unit: "KG", status: "ACTIVE", location: "Nairobi", description: marker, ownerId } }); }

try {
  const seller = await user("Seller"); const buyer = await user("Buyer"); const outsider = await user("Outsider"); const admin = await user("Admin", "ADMIN");
  const product = await listing(seller.id); const conversation = await startConversation(product.id, buyer.id);
  const message = await sendChat(seller.id, { conversationId: conversation.id }, "Original safety context", randomUUID());
  const completed = await prisma.deal.create({ data: { productId: product.id, conversationId: conversation.id, sellerId: seller.id, buyerId: buyer.id, status: "COMPLETED", quantity: "1", unit: "KG", agreedPrice: "5", currency: "USD", completedAt: new Date() } });

  await assert.rejects(blockInteraction(buyer.id, buyer.id), /cannot block yourself/i);
  const block = await blockInteraction(buyer.id, seller.id); assert.ok(block.createdAt); assert.equal(await isInteractionBlocked(seller.id, buyer.id), true);
  await assert.rejects(blockInteraction(buyer.id, seller.id), /already blocked/i);
  assert.ok((await visibleMessages(buyer.id, { conversationId: conversation.id })).some(row => row.id === message.id), "existing history remains readable");
  await assert.rejects(sendChat(seller.id, { conversationId: conversation.id }, "Blocked message", randomUUID()), /unavailable/i);
  const secondProduct = await listing(seller.id, "beans"); await assert.rejects(startConversation(secondProduct.id, buyer.id), /unavailable/i);
  await assert.rejects(createDeal(conversation.id, seller.id, "1", "5"), /cannot create/i);
  await assert.rejects(createReview(completed.id, buyer.id, 5, "Good"), /blocked/i);
  assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: completed.id } })).status, "COMPLETED", "blocking preserves completed deals");
  await unblockInteraction(buyer.id, seller.id); assert.equal(await isInteractionBlocked(seller.id, buyer.id), false);

  const userReport = await createSafetyReport(buyer.id, "USER", seller.id, "HARASSMENT", "Private reporter note");
  const listingReport = await createSafetyReport(buyer.id, "LISTING", product.id, "MISLEADING", "Listing note");
  const messageReport = await createSafetyReport(buyer.id, "MESSAGE", message.id, "SPAM_OR_SCAM", "Message note");
  assert.equal(userReport.status, "OPEN"); assert.equal(listingReport.status, "OPEN"); assert.equal(messageReport.messageBodySnapshot, "Original safety context");
  await prisma.message.update({ where: { id: message.id }, data: { body: "Changed later" } });
  assert.equal((await prisma.safetyReport.findUniqueOrThrow({ where: { id: messageReport.id } })).messageBodySnapshot, "Original safety context", "message evidence is immutable");
  await assert.rejects(createSafetyReport(outsider.id, "MESSAGE", message.id, "OTHER", "No access"), /cannot be reported/i);
  await assert.rejects(createSafetyReport(buyer.id, "USER", seller.id, "OTHER", "Duplicate"), /already have an open report/i);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status, "ACTIVE", "report alone does not alter target");

  const rateUser = await user("Rate");
  for (let index = 0; index < 5; index++) await prisma.safetyReport.create({ data: { reporterId: rateUser.id, targetType: "USER", targetUserId: seller.id, targetUserName: seller.name, reason: "OTHER", note: `Rate ${index}` } });
  await assert.rejects(createSafetyReport(rateUser.id, "LISTING", secondProduct.id, "OTHER", "Sixth"), /too many reports/i);
  await assert.rejects(closeSafetyReport(userReport.id, outsider.id, "DISMISSED", "", false), /not found/i, "moderation is admin-only");
  await closeSafetyReport(userReport.id, admin.id, "DISMISSED", "Private admin note", false);
  const closed = await prisma.safetyReport.findUniqueOrThrow({ where: { id: userReport.id } }); assert.equal(closed.status, "DISMISSED"); assert.equal(closed.dedupeKey, null);
  assert.equal(await prisma.notification.count({ where: { userId: buyer.id, type: "SAFETY_REPORT" } }), 1, "reporter receives safe closure notification");
  assert.equal(await prisma.notification.count({ where: { userId: seller.id, type: "SAFETY_REPORT" } }), 0, "reported user receives no notification");
  await closeSafetyReport(listingReport.id, admin.id, "RESOLVED", "Policy review", true);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status, "INACTIVE", "admin explicitly deactivates reported listing");

  const adminSource = readFileSync("src/app/admin/reports/page.tsx", "utf8"); const sellerSource = readFileSync("src/app/sellers/[id]/page.tsx", "utf8");
  assert.match(adminSource, /requireAdmin/); assert.match(adminSource, /deactivateListing/); assert.match(sellerSource, /SafetyReportForm/);
  assert.ok(!sellerSource.includes("reporterId") && !sellerSource.includes("moderatorNote"), "public seller page exposes no report identities or notes");
  console.log("PASS MARKETPLACE SAFETY: bilateral blocking, historical access, interaction restrictions, review/deal protection, typed reports, immutable message snapshots, dedupe/rate limits, private moderation, safe notifications, and explicit listing deactivation.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(value => value.id) } } });
  await prisma.$disconnect(); Module._load = load;
}
