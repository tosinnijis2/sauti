import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { startConversation } = require("../src/lib/chat.ts");
const { createDeal, transitionDeal, canReview, dealStatusLabel } = require("../src/lib/deals.ts");
const { createReview } = require("../src/lib/reviews.ts");
const { blockInteraction } = require("../src/lib/interactions.ts");
const { dashboardData } = require("../src/lib/dashboard.ts");
const users = [];

async function user(role) {
  const row = await prisma.user.create({ data: { name: `Journey ${role}`, email: `journey-${randomUUID()}@example.invalid`, passwordHash: "disabled", country: "KE", location: "Nairobi" } });
  users.push(row);
  return row;
}

try {
  const seller = await user("Seller");
  const buyer = await user("Buyer");
  const product = await prisma.product.create({ data: { ownerId: seller.id, item: `Journey maize ${randomUUID()}`, category: "Cereals", commodity: "MAIZE", price: "80", quantity: "100", originalQuantity: "100", remainingQuantity: "100", unit: "KG", status: "ACTIVE", country: "KE", location: "Nairobi", description: "Phase 22 journey fixture" } });

  const conversation = await startConversation(product.id, buyer.id);
  assert.equal((await startConversation(product.id, buyer.id)).id, conversation.id, "listing resumes the existing conversation");
  const deal = await createDeal(conversation.id, seller.id, "25", "22");
  const proposal = await prisma.notification.findFirstOrThrow({ where: { userId: buyer.id, type: "DEAL_UPDATE", title: "New deal proposal" } });
  assert.equal(proposal.href, `/messages/${conversation.id}#deal-${deal.id}`);
  assert.equal(dealStatusLabel(deal.status, buyer.id, buyer.id, seller.id), "Pending confirmation");

  const buyerConfirmed = await transitionDeal(deal.id, buyer.id, "confirm");
  assert.equal(buyerConfirmed.status, "BUYER_CONFIRMED");
  assert.equal(dealStatusLabel(buyerConfirmed.status, seller.id, buyer.id, seller.id), "Waiting for seller");
  const activity = await dashboardData(seller.id, "KE");
  assert.equal(activity.marketplaceActivity.waitingConfirmations, 1, "dashboard exposes an actionable confirmation count");
  const confirmationNotice = await prisma.notification.findFirstOrThrow({ where: { userId: seller.id, type: "DEAL_UPDATE", title: "Deal confirmation needed" } });
  assert.equal(confirmationNotice.href, `/messages/${conversation.id}#deal-${deal.id}`);

  const completed = await transitionDeal(deal.id, seller.id, "confirm");
  assert.equal(completed.status, "COMPLETED");
  assert.equal(dealStatusLabel(completed.status, buyer.id, buyer.id, seller.id), "Completed");
  assert.equal(await prisma.notification.count({ where: { type: "DEAL_UPDATE", title: "Deal completed", href: `/deals#deal-${deal.id}` } }), 2);
  assert.equal(await canReview(buyer.id, deal.id, seller.id), true);
  await createReview(deal.id, buyer.id, 5, "Clear marketplace communication.");
  assert.equal(await canReview(buyer.id, deal.id, seller.id), false, "consumed review opportunity no longer prompts");

  const secondBuyer = await user("Blocked buyer");
  await blockInteraction(secondBuyer.id, seller.id);
  await assert.rejects(() => startConversation(product.id, secondBuyer.id), /unavailable/i, "blocked interaction remains denied");

  const listingSource = readFileSync("src/app/market/[id]/page.tsx", "utf8");
  const proposalSource = readFileSync("src/components/deal-proposal-form.tsx", "utf8");
  const controlsSource = readFileSync("src/components/deal-controls.tsx", "utf8");
  const conversationSource = readFileSync("src/app/messages/[id]/page.tsx", "utf8");
  const dealsSource = readFileSync("src/app/deals/page.tsx", "utf8");
  assert.match(listingSource, /Continue conversation/); assert.match(listingSource, /View deal/); assert.match(listingSource, /Listing unavailable/);
  assert.match(proposalSource, /Review proposal/); assert.match(proposalSource, /Effective unit price/); assert.match(proposalSource, /I confirm the quantity and agreed price are correct/);
  assert.match(controlsSource, /Review deal terms/); assert.match(controlsSource, />Confirm deal</); assert.doesNotMatch(controlsSource, />Pay</);
  assert.match(conversationSource, /reviewEligible/); assert.match(conversationSource, /DealReview/);
  assert.match(dealsSource, /Continue conversation/); assert.match(dealsSource, /View listing/); assert.match(dealsSource, /DealReview/);
  console.log("PASS TRANSACTION JOURNEY: resumable conversations, explicit proposal review, consistent confirmations, exact notifications, completion and review handoff, dashboard counts, blocking, and UI state wiring.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
  Module._load = load;
}
