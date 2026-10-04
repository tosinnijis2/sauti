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
const { createDeal, transitionDeal, canReview, DealError } = require("../src/lib/deals.ts");
const { saveListing, ListingError } = require("../src/lib/listings.ts");
const users = [];
async function user(name) { const value = await prisma.user.create({ data: { name, email: `inventory-${randomUUID()}@example.invalid`, passwordHash: "disabled", country: "KE" } }); users.push(value); return value; }
async function product(ownerId, quantity, tracked = true) { return prisma.product.create({ data: { ownerId, item: `Inventory ${randomUUID()}`, category: "Other", price: "100", quantity, ...(tracked ? { originalQuantity: quantity, remainingQuantity: quantity } : {}), unit: "KG", status: "ACTIVE", location: "Nairobi", country: "KE", description: "Partial inventory fixture" } }); }
async function conversation(item, buyer, seller) { return prisma.conversation.create({ data: { productId: item.id, productName: item.item, buyerId: buyer.id, sellerId: seller.id } }); }
function editForm(item, quantity, status = "ACTIVE") { const form = new FormData(); Object.entries({ item: item.item, category: item.category, price: item.price.toString(), quantity, unit: item.unit, status, location: item.location, country: item.country, description: item.description, photoMode: "keep" }).forEach(([key, value]) => form.set(key, value)); return form; }

try {
  const seller = await user("Inventory Seller"); const buyer = await user("Inventory Buyer"); const buyer2 = await user("Inventory Buyer Two"); const buyer3 = await user("Inventory Buyer Three");
  const partialProduct = await product(seller.id, "100");
  const partialConversation = await conversation(partialProduct, buyer, seller);
  const partial = await createDeal(partialConversation.id, seller.id, "25", "22");
  assert.equal(partial.quantity.toString(), "25"); assert.equal(partial.unit, "KG");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: partialProduct.id } })).remainingQuantity.toString(), "100", "pending deal must not reserve stock");
  await transitionDeal(partial.id, buyer.id, "confirm");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: partialProduct.id } })).remainingQuantity.toString(), "100", "one confirmation must not spend stock");
  await transitionDeal(partial.id, seller.id, "confirm");
  let inventory = await prisma.product.findUniqueOrThrow({ where: { id: partialProduct.id } });
  assert.equal(inventory.remainingQuantity.toString(), "75"); assert.equal(inventory.originalQuantity.toString(), "100"); assert.equal(inventory.status, "ACTIVE");
  assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: partial.id } })).quantity.toString(), "25", "deal quantity is immutable through confirmation");
  assert.equal(await canReview(buyer.id, partial.id, seller.id), true);
  await assert.rejects(() => transitionDeal(partial.id, seller.id, "confirm"), DealError, "duplicate completion rejected");

  const depletionConversation = await conversation(partialProduct, buyer2, seller); const depletion = await createDeal(depletionConversation.id, seller.id, "75", "60");
  await transitionDeal(depletion.id, buyer2.id, "confirm"); await transitionDeal(depletion.id, seller.id, "confirm");
  inventory = await prisma.product.findUniqueOrThrow({ where: { id: partialProduct.id } }); assert.equal(inventory.remainingQuantity.toString(), "0"); assert.equal(inventory.status, "SOLD");
  const soldOutConversation = await conversation(partialProduct, buyer3, seller);
  await assert.rejects(() => createDeal(soldOutConversation.id, seller.id, "1", "1"), DealError, "sold-out listing rejected");

  await saveListing(seller.id, editForm(inventory, "120"), inventory.id);
  inventory = await prisma.product.findUniqueOrThrow({ where: { id: inventory.id } }); assert.equal(inventory.originalQuantity.toString(), "120"); assert.equal(inventory.remainingQuantity.toString(), "20"); assert.equal(inventory.status, "ACTIVE", "safe increase can reactivate inventory");
  await assert.rejects(() => saveListing(seller.id, editForm(inventory, "99"), inventory.id), ListingError, "cannot reduce total below completed sales");

  const single = await product(seller.id, "1"); const singleDeal = await createDeal((await conversation(single, buyer, seller)).id, seller.id, "1", "10"); await transitionDeal(singleDeal.id, seller.id, "confirm"); await transitionDeal(singleDeal.id, buyer.id, "confirm");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: single.id } })).status, "SOLD", "quantity one fully depletes");

  const scarce = await product(seller.id, "5");
  const oversizedConversation = await conversation(scarce, buyer3, seller);
  await assert.rejects(() => createDeal(oversizedConversation.id, seller.id, "5.001", "10"), DealError, "creation rejects insufficient inventory");
  const dealA = await createDeal((await conversation(scarce, buyer, seller)).id, seller.id, "4", "40"); const dealB = await createDeal((await conversation(scarce, buyer2, seller)).id, seller.id, "4", "40");
  await transitionDeal(dealA.id, buyer.id, "confirm"); await transitionDeal(dealB.id, buyer2.id, "confirm");
  const concurrent = await Promise.allSettled([transitionDeal(dealA.id, seller.id, "confirm"), transitionDeal(dealB.id, seller.id, "confirm")]);
  assert.equal(concurrent.filter(result => result.status === "fulfilled").length, 1); assert.equal(concurrent.filter(result => result.status === "rejected").length, 1);
  const scarceAfter = await prisma.product.findUniqueOrThrow({ where: { id: scarce.id } }); assert.equal(scarceAfter.remainingQuantity.toString(), "1"); assert.ok(scarceAfter.remainingQuantity.gte(0));

  const legacy = await product(seller.id, "5", false); const legacyDeal = await createDeal((await conversation(legacy, buyer3, seller)).id, seller.id, "2", "20"); await transitionDeal(legacyDeal.id, buyer3.id, "confirm"); await transitionDeal(legacyDeal.id, seller.id, "confirm");
  const upgraded = await prisma.product.findUniqueOrThrow({ where: { id: legacy.id } }); assert.equal(upgraded.originalQuantity.toString(), "5"); assert.equal(upgraded.remainingQuantity.toString(), "3"); assert.equal(upgraded.status, "ACTIVE");
  console.log("PASS INVENTORY: partial/full depletion, pending semantics, Decimal-safe edits, quantity immutability, review eligibility, legacy upgrade, and concurrent oversell prevention.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(value => value.id) } } });
  await prisma.$disconnect(); Module._load = load;
}
