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
const { createReview, moderateReview, ReviewError } = require("../src/lib/reviews.ts");
const { canReview } = require("../src/lib/deals.ts");
const { sellerTrustData } = require("../src/lib/listing-analytics.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const users = [];
async function user(name, role = "USER") { const row = await prisma.user.create({ data: { name, role, email: `review-${randomUUID()}@example.invalid`, passwordHash: "disabled", location: "Nairobi", country: "KE" } }); users.push(row); return row; }
async function cookie(account) { const token = await new SignJWT({ version: account.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(account.id).setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET)); return `sauti_session=${token}`; }
async function deal(seller, buyer, status = "COMPLETED") { const product = await prisma.product.create({ data: { ownerId: seller.id, item: `Review fixture ${randomUUID()}`, category: "Other", price: "10", quantity: "1", unit: "ITEM", status: "SOLD", location: "Nairobi", country: "KE", description: "Private review fixture" } }); const conversation = await prisma.conversation.create({ data: { productId: product.id, productName: product.item, buyerId: buyer.id, sellerId: seller.id } }); return prisma.deal.create({ data: { productId: product.id, conversationId: conversation.id, sellerId: seller.id, buyerId: buyer.id, status, ...(status === "COMPLETED" ? { completedAt: new Date() } : status === "DISPUTED" ? { disputedAt: new Date(), disputeReason: "Private dispute marker" } : {}) } }); }

try {
  const seller = await user("Review Seller"); const buyer = await user("Review Buyer"); const outsider = await user("Review Outsider"); const admin = await user("Review Admin", "ADMIN"); const member = await user("Review Member");
  const firstDeal = await deal(seller, buyer);
  assert.equal(await canReview(buyer.id, firstDeal.id, seller.id), true);
  const pending = await createReview(firstDeal.id, buyer.id, 5, "  Excellent produce  ");
  assert.equal(pending.targetId, seller.id); assert.equal(pending.reviewerId, buyer.id); assert.equal(pending.status, "PENDING"); assert.equal(pending.comment, "Excellent produce");
  assert.equal(await canReview(buyer.id, firstDeal.id, seller.id), false, "creation consumes the opportunity");
  const reciprocal = await createReview(firstDeal.id, seller.id, 4, "Prompt buyer"); assert.equal(reciprocal.targetId, buyer.id, "opposing party has an independent opportunity");
  await assert.rejects(() => createReview(firstDeal.id, buyer.id, 5, "duplicate"), ReviewError);
  await assert.rejects(() => createReview(firstDeal.id, outsider.id, 5, "unrelated"), ReviewError);
  assert.equal(await canReview(buyer.id, firstDeal.id, buyer.id), false, "self review is ineligible");

  const disputedDeal = await deal(seller, buyer, "DISPUTED"); const cancelledDeal = await deal(seller, buyer, "CANCELLED");
  await assert.rejects(() => createReview(disputedDeal.id, buyer.id, 5, "no"), ReviewError);
  await assert.rejects(() => createReview(cancelledDeal.id, buyer.id, 5, "no"), ReviewError);
  const validationDeal = await deal(seller, buyer);
  for (const rating of [0, 6, 2.5, "bad"]) await assert.rejects(() => createReview(validationDeal.id, buyer.id, rating, "invalid rating"), ReviewError);
  await assert.rejects(() => createReview(validationDeal.id, buyer.id, 3, "x".repeat(501)), ReviewError);
  await assert.rejects(() => createReview(validationDeal.id, buyer.id, 3, "<b>HTML</b>"), ReviewError);

  const pendingMarker = `Pending-${randomUUID()}`; const pendingDeal = await deal(seller, buyer); await createReview(pendingDeal.id, buyer.id, 2, pendingMarker);
  const hiddenMarker = `Hidden-${randomUUID()}`; const hiddenDeal = await deal(seller, buyer); const hidden = await createReview(hiddenDeal.id, buyer.id, 1, hiddenMarker); await moderateReview(hidden.id, admin.id, "hide");
  const removedMarker = `Removed-${randomUUID()}`; const removedDeal = await deal(seller, buyer); const removed = await createReview(removedDeal.id, buyer.id, 1, removedMarker); await moderateReview(removed.id, admin.id, "remove"); await assert.rejects(() => moderateReview(removed.id, admin.id, "publish"), ReviewError);
  await assert.rejects(() => moderateReview(pending.id, member.id, "publish"), ReviewError, "normal user cannot moderate");
  await moderateReview(pending.id, admin.id, "publish");
  const secondPublishedMarker = `Published-${randomUUID()}`; const secondPublishedDeal = await deal(seller, buyer); const secondPublished = await createReview(secondPublishedDeal.id, buyer.id, 3, secondPublishedMarker); await moderateReview(secondPublished.id, admin.id, "publish");
  const trust = await sellerTrustData(seller.id); assert.equal(trust.publishedReviewCount, 2); assert.equal(trust.averageRating, 4);

  const sellerCookie = await cookie(seller); const buyerCookie = await cookie(buyer); const memberCookie = await cookie(member); const adminCookie = await cookie(admin);
  const dealsHtml = await (await fetch(`${base}/deals`, { headers: { Cookie: buyerCookie } })).text(); assert.ok(dealsHtml.includes("Your review") && dealsHtml.includes("published"));
  assert.equal((await fetch(`${base}/admin/reviews`, { headers: { Cookie: memberCookie }, redirect: "manual" })).status, 404);
  const adminResponse = await fetch(`${base}/admin/reviews`, { headers: { Cookie: adminCookie } }); assert.equal(adminResponse.status, 200); const adminHtml = await adminResponse.text(); assert.ok(adminHtml.includes("Review moderation") && adminHtml.includes(pendingMarker) && adminHtml.includes(seller.name));
  const publicHtml = await (await fetch(`${base}/sellers/${seller.id}`)).text(); const rendered = publicHtml.replace(/<!--.*?-->/g, ""); assert.ok(rendered.includes("4.0/5") && rendered.includes("2 published reviews") && rendered.includes("Excellent produce") && rendered.includes(secondPublishedMarker));
  for (const hiddenValue of [pendingMarker, hiddenMarker, removedMarker, buyer.email, buyer.name, firstDeal.id, "Private dispute marker", "Private review fixture"]) assert.ok(!publicHtml.includes(hiddenValue), `public seller profile leaked ${hiddenValue}`);
  assert.ok(!publicHtml.includes(seller.email));
  assert.equal((await fetch(`${base}/admin/reviews`, { headers: { Cookie: sellerCookie }, redirect: "manual" })).status, 404);
  console.log("PASS REVIEWS: completed-deal eligibility, independent one-time opportunities, validation, moderation, published-only public reviews/averages, admin authorization, and privacy.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(item => item.id) } } });
  await prisma.$disconnect(); Module._load = load;
}
