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
const { createDeal, transitionDeal, canReview, DealError } = require("../src/lib/deals.ts");
const { sellerTrustData } = require("../src/lib/listing-analytics.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const users = [];
async function user(name, role = "USER") { const row = await prisma.user.create({ data: { name, role, email: `deal-${randomUUID()}@example.invalid`, passwordHash: "disabled", location: "Nairobi", country: "KE" } }); users.push(row); return row; }
async function cookie(account) { const token = await new SignJWT({ version: account.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(account.id).setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET)); return `sauti_session=${token}`; }
async function listing(ownerId, item, quantity = "1", status = "ACTIVE") { return prisma.product.create({ data: { ownerId, item, category: "Other", price: "10", quantity, unit: "ITEM", status, location: "Nairobi", country: "KE", description: "Phase 12 fixture" } }); }
async function conversation(product, buyer, seller) { return prisma.conversation.create({ data: { productId: product.id, productName: product.item, buyerId: buyer.id, sellerId: seller.id } }); }

try {
  const seller = await user("Deal Seller"); const buyer = await user("Deal Buyer"); const outsider = await user("Deal Outsider"); const admin = await user("Deal Admin", "ADMIN");
  const product = await listing(seller.id, `Whole listing ${randomUUID()}`); const c = await conversation(product, buyer, seller);
  await assert.rejects(() => createDeal(c.id, outsider.id), DealError, "only seller can initiate");
  const deal = await createDeal(c.id, seller.id);
  assert.equal(deal.buyerId, buyer.id); assert.equal(deal.sellerId, seller.id); assert.equal(deal.productId, product.id);
  await assert.rejects(() => createDeal(c.id, seller.id), DealError, "duplicate conversation deal rejected");
  await assert.rejects(() => transitionDeal(deal.id, outsider.id, "confirm"), DealError, "unrelated user denied");
  const oneSide = await transitionDeal(deal.id, buyer.id, "confirm"); assert.equal(oneSide.status, "BUYER_CONFIRMED"); assert.equal(oneSide.completedAt, null);
  await assert.rejects(() => transitionDeal(deal.id, buyer.id, "confirm"), DealError, "repeat confirmation rejected");
  const completed = await transitionDeal(deal.id, seller.id, "confirm"); assert.equal(completed.status, "COMPLETED"); assert.ok(completed.completedAt);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status, "SOLD", "single-unit listing becomes sold");
  assert.equal(await canReview(buyer.id, deal.id, seller.id), true); assert.equal(await canReview(seller.id, deal.id, buyer.id), true); assert.equal(await canReview(outsider.id, deal.id, seller.id), false); assert.equal(await canReview(buyer.id, deal.id, buyer.id), false);
  await assert.rejects(() => transitionDeal(deal.id, buyer.id, "cancel"), DealError, "completed deal is terminal");

  const multi = await listing(seller.id, `Multi listing ${randomUUID()}`, "5"); const multiConversation = await conversation(multi, buyer, seller); const multiDeal = await createDeal(multiConversation.id, seller.id);
  await transitionDeal(multiDeal.id, seller.id, "confirm"); await transitionDeal(multiDeal.id, buyer.id, "confirm");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: multi.id } })).status, "ACTIVE", "multi-unit inventory stays seller-controlled");

  const cancelProduct = await listing(seller.id, `Cancel listing ${randomUUID()}`); const cancelConversation = await conversation(cancelProduct, buyer, seller); const cancelled = await createDeal(cancelConversation.id, seller.id); assert.equal((await transitionDeal(cancelled.id, buyer.id, "cancel")).status, "CANCELLED"); await assert.rejects(() => transitionDeal(cancelled.id, seller.id, "confirm"), DealError);
  const disputeProduct = await listing(seller.id, `Dispute listing ${randomUUID()}`); const disputeConversation = await conversation(disputeProduct, buyer, seller); const disputed = await createDeal(disputeConversation.id, seller.id); const disputedResult = await transitionDeal(disputed.id, buyer.id, "dispute", "Item condition differs"); assert.equal(disputedResult.status, "DISPUTED"); assert.equal(disputedResult.disputeReason, "Item condition differs"); assert.ok(disputedResult.disputedAt); assert.equal(await canReview(buyer.id, disputed.id, seller.id), false); await assert.rejects(() => transitionDeal(disputed.id, seller.id, "confirm"), DealError);

  const inactive = await listing(seller.id, `Inactive listing ${randomUUID()}`, "1", "INACTIVE"); const inactiveConversation = await conversation(inactive, outsider, seller); await assert.rejects(() => createDeal(inactiveConversation.id, seller.id), DealError);
  const available = await listing(seller.id, `Available listing ${randomUUID()}`); const availableConversation = await conversation(available, outsider, seller);
  const selfProduct = await listing(seller.id, `Self listing ${randomUUID()}`); const selfConversation = await conversation(selfProduct, seller, seller); await assert.rejects(() => createDeal(selfConversation.id, seller.id), DealError);

  assert.equal((await sellerTrustData(seller.id)).completedDeals, 2, "public aggregate counts completed deals only");
  const sellerCookie = await cookie(seller); const buyerCookie = await cookie(buyer); const outsiderCookie = await cookie(outsider); const adminCookie = await cookie(admin);
  const sellerDeals = await (await fetch(`${base}/deals`, { headers: { Cookie: sellerCookie } })).text(); const buyerDeals = await (await fetch(`${base}/deals`, { headers: { Cookie: buyerCookie } })).text(); const outsiderDeals = await (await fetch(`${base}/deals`, { headers: { Cookie: outsiderCookie } })).text();
  assert.ok(sellerDeals.includes(product.item) && buyerDeals.includes(product.item)); assert.ok(!outsiderDeals.includes(product.item) && !outsiderDeals.includes(buyer.name));
  const conversationHtml = await (await fetch(`${base}/messages/${disputeConversation.id}`, { headers: { Cookie: sellerCookie } })).text(); assert.ok(conversationHtml.includes("Disputed") && !conversationHtml.includes("Start deal"));
  const startHtml = await (await fetch(`${base}/messages/${inactiveConversation.id}`, { headers: { Cookie: sellerCookie } })).text(); assert.ok(!startHtml.includes("Start deal"), "inactive listing cannot show start action");
  const availableSellerHtml = await (await fetch(`${base}/messages/${availableConversation.id}`, { headers: { Cookie: sellerCookie } })).text(); const availableBuyerHtml = await (await fetch(`${base}/messages/${availableConversation.id}`, { headers: { Cookie: outsiderCookie } })).text(); assert.ok(availableSellerHtml.includes("Start deal"), "seller sees deal initiation"); assert.ok(!availableBuyerHtml.includes("Start deal"), "buyer cannot initiate a deal");
  assert.equal((await fetch(`${base}/admin/deals`, { headers: { Cookie: outsiderCookie }, redirect: "manual" })).status, 404);
  const adminResponse = await fetch(`${base}/admin/deals`, { headers: { Cookie: adminCookie } }); assert.equal(adminResponse.status, 200); const adminHtml = await adminResponse.text(); assert.ok(adminHtml.includes("Disputed deals") && adminHtml.includes("Item condition differs") && adminHtml.includes(buyer.name));
  const publicHtml = await (await fetch(`${base}/sellers/${seller.id}`)).text(); const renderedPublic = publicHtml.replace(/<!--.*?-->/g, ""); assert.ok(renderedPublic.includes("2 completed deals")); for (const privateValue of [buyer.name, buyer.email, "Item condition differs"]) assert.ok(!publicHtml.includes(privateValue), `public profile leaked ${privateValue}`);
  console.log("PASS DEALS: conversation-derived creation, seller-only initiation, confirmation state machine, terminal cancellation/dispute, review eligibility, private participant pages, admin disputes, public aggregate privacy, and conservative SOLD behavior.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(item => item.id) } } });
  await prisma.$disconnect(); Module._load = load;
}
