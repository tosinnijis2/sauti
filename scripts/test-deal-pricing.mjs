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
const { createDeal, transitionDeal, DealError } = require("../src/lib/deals.ts");
const { agreedUnitPrice } = require("../src/lib/deal-pricing.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const userIds = [];
async function user(name) { const row = await prisma.user.create({ data: { name, email: `pricing-${randomUUID()}@example.invalid`, passwordHash: "disabled", country: "KE" } }); userIds.push(row.id); return row; }
async function cookie(account) { const token = await new SignJWT({ version: account.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(account.id).setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET)); return `sauti_session=${token}`; }
async function product(sellerId, quantity = "100") { return prisma.product.create({ data: { ownerId: sellerId, item: `Pricing ${randomUUID()}`, category: "Cereals", price: "80", quantity, originalQuantity: quantity, remainingQuantity: quantity, unit: "KG", status: "ACTIVE", location: "Nairobi", country: "KE", description: "Explicit deal pricing fixture" } }); }
async function conversation(item, buyer, seller) { return prisma.conversation.create({ data: { productId: item.id, productName: item.item, buyerId: buyer.id, sellerId: seller.id } }); }

try {
  const seller = await user("Pricing Seller"); const buyer = await user("Pricing Buyer"); const buyer2 = await user("Pricing Buyer Two");
  const item = await product(seller.id); const thread = await conversation(item, buyer, seller);
  for (const invalid of [undefined, "0", "-1", "1.001", "1e3"]) await assert.rejects(() => createDeal(thread.id, seller.id, "25", invalid), DealError);

  const deal = await createDeal(thread.id, seller.id, "25", "22");
  assert.equal(deal.quantity.toString(), "25"); assert.equal(deal.agreedPrice.toString(), "22"); assert.equal(deal.currency, "USD");
  assert.equal(agreedUnitPrice(deal.agreedPrice, deal.quantity).toFixed(2), "0.88");
  await assert.rejects(() => createDeal(thread.id, seller.id, "24", "21"), DealError, "active terms cannot be replaced");
  const afterBuyer = await transitionDeal(deal.id, buyer.id, "confirm");
  assert.equal(afterBuyer.status, "BUYER_CONFIRMED"); assert.equal(afterBuyer.quantity.toString(), "25"); assert.equal(afterBuyer.agreedPrice.toString(), "22");

  const sellerCookie = await cookie(seller); const buyerCookie = await cookie(buyer);
  for (const auth of [sellerCookie, buyerCookie]) {
    const response = await fetch(`${base}/messages/${thread.id}`, { headers: { Cookie: auth } });
    assert.equal(response.status, 200, `participant deal page status (${response.url})`);
    const html = (await response.text()).replace(/<!--.*?-->/g, "");
    const expected = ["25 kg", "$22.00 agreed", "$0.88/kg", "$80.00 USD asking for 100 kg"];
    assert.ok(expected.every(value => html.includes(value)), `both participants see identical deal and asking context: ${expected.filter(value => !html.includes(value)).join(", ")}`);
  }
  await transitionDeal(deal.id, seller.id, "confirm");
  const completed = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
  assert.equal(completed.status, "COMPLETED"); assert.equal(completed.agreedPrice.toString(), "22"); assert.equal(completed.currency, "USD");

  const fullItem = await product(seller.id, "5"); const full = await createDeal((await conversation(fullItem, buyer2, seller)).id, seller.id, "5", "17.50");
  await transitionDeal(full.id, seller.id, "confirm"); await transitionDeal(full.id, buyer2.id, "confirm");
  assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: full.id } })).agreedPrice.toString(), "17.5");

  const recreateItem = await product(seller.id, "10"); const recreateThread = await conversation(recreateItem, buyer, seller);
  const cancelled = await createDeal(recreateThread.id, seller.id, "2", "7"); await transitionDeal(cancelled.id, buyer.id, "cancel");
  const replacement = await createDeal(recreateThread.id, seller.id, "3", "11");
  assert.notEqual(replacement.id, cancelled.id); assert.equal(replacement.agreedPrice.toString(), "11");

  const legacyItem = await product(seller.id, "2"); const legacyThread = await conversation(legacyItem, buyer2, seller);
  const legacy = await prisma.deal.create({ data: { conversationId: legacyThread.id, productId: legacyItem.id, sellerId: seller.id, buyerId: buyer2.id, quantity: "2", unit: "KG" } });
  await transitionDeal(legacy.id, buyer2.id, "confirm"); await transitionDeal(legacy.id, seller.id, "confirm");
  assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: legacy.id } })).agreedPrice, null, "historical null pricing remains valid");

  const snapshotCount = await prisma.priceSnapshot.count({ where: { productKey: item.id } });
  assert.equal(snapshotCount, 0, "deal activity does not enter asking-price history");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: item.id } })).price.toString(), "80", "asking price remains unchanged");
  const publicHtml = await (await fetch(`${base}/sellers/${seller.id}`)).text();
  for (const privatePrice of ["$22.00 agreed", "$17.50 agreed", "$11.00 agreed"]) assert.ok(!publicHtml.includes(privatePrice), `public seller profile leaked ${privatePrice}`);
  console.log("PASS DEAL PRICING: explicit Decimal-safe USD terms, visibility, immutability, recreation, legacy compatibility, privacy, and asking-price isolation.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect(); Module._load = load;
}
