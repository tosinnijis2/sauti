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
const { completedDealInsights, completedDealDiagnostics } = require("../src/lib/completed-deal-insights.ts");
const { marketInsights } = require("../src/lib/insights.ts");
const { insightFiltersSchema } = require("../src/lib/insight-filters.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const marker = `DealSignal-${randomUUID()}`;
const mainLocation = `${marker}-main`;
const users = [];
async function user(kind, index) { const row = await prisma.user.create({ data: { name: `${marker}-${kind}-${index}`, email: `${marker}-${kind}-${index}@example.invalid`, passwordHash: "disabled", country: "KE" } }); users.push(row); return row; }
const sellers = []; const buyers = [];
function filters(location, unit = "KG") { return insightFiltersSchema.parse({ commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", unit, location, range: "all" }); }
async function deal({ index, location = mainLocation, unit = "KG", quantity = "1", price = "2", status = "COMPLETED", completedAt = new Date("2026-08-01T12:00:00Z"), legacy = false, sellerIndex = index % 3, buyerIndex = index % 3 }) {
  const product = await prisma.product.create({ data: { ownerId: sellers[sellerIndex].id, item: `${marker}-item-${location}-${index}-${randomUUID()}`, category: "Cereals", price: "99", quantity: "100", unit, status: "INACTIVE", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", location, country: "KE", description: "Completed deal aggregate fixture" } });
  const conversation = await prisma.conversation.create({ data: { productId: product.id, productName: product.item, buyerId: buyers[buyerIndex].id, sellerId: sellers[sellerIndex].id } });
  return prisma.deal.create({ data: { productId: product.id, conversationId: conversation.id, sellerId: sellers[sellerIndex].id, buyerId: buyers[buyerIndex].id, quantity, unit, status, completedAt: status === "COMPLETED" ? completedAt : null, ...(legacy ? {} : { agreedPrice: price, currency: "USD" }) } });
}

try {
  for (let index = 0; index < 3; index++) { sellers.push(await user("seller", index)); buyers.push(await user("buyer", index)); }
  const askingOwner = await user("asking-owner", 0);
  for (let index = 0; index < 5; index++) await prisma.product.create({ data: { ownerId: askingOwner.id, item: `${marker}-asking-${index}`, category: "Cereals", price: String(10 + index), quantity: "1", unit: "KG", status: "ACTIVE", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", location: mainLocation, country: "KE", description: "Asking-price control fixture" } });
  const askingBefore = await marketInsights(filters(mainLocation));
  const snapshotsBefore = await prisma.priceSnapshot.count();
  const notificationsBefore = await prisma.notification.count();

  for (let index = 0; index < 20; index++) await deal({ index, unit: index % 2 ? "KG" : "G", quantity: index % 2 ? "1" : "1000", price: index < 10 ? "2" : "3", completedAt: new Date(index < 10 ? "2026-08-01T12:00:00Z" : "2026-08-02T12:00:00Z") });
  await deal({ index: 30, status: "PENDING", price: "777.77" });
  await deal({ index: 31, status: "CANCELLED", price: "888.88" });
  await deal({ index: 32, status: "DISPUTED", price: "999.99" });
  await deal({ index: 33, legacy: true });
  for (let index = 40; index < 50; index++) await deal({ index, unit: "LITRE", quantity: "1", price: "50" });

  const result = await completedDealInsights(filters(mainLocation), new Date("2026-09-01T00:00:00Z"));
  assert.ok(result.summary); assert.equal(result.summary.count, 20); assert.equal(result.summary.medianTotal, "2.5"); assert.equal(result.summary.medianUnit, "2.5");
  assert.equal(result.summary.low, "2"); assert.equal(result.summary.high, "3");
  assert.equal(result.history.points.length, 2); assert.equal(result.history.trend.percentage, "50.0");
  assert.equal((await completedDealInsights(filters(mainLocation, "LITRE"))).summary.count, 10, "incompatible units remain separate");

  for (let index = 0; index < 10; index++) await deal({ index: 60 + index, location: `${marker}-one-seller`, sellerIndex: 0, buyerIndex: index % 3 });
  assert.equal((await completedDealInsights(filters(`${marker}-one-seller`))).summary, null, "distinct seller threshold enforced");
  for (let index = 0; index < 9; index++) await deal({ index: 80 + index, location: `${marker}-small` });
  assert.equal((await completedDealInsights(filters(`${marker}-small`))).summary, null, "deal-count threshold enforced");
  for (let index = 0; index < 10; index++) await deal({ index: 100 + index, location: `${marker}-sparse`, completedAt: new Date(index < 5 ? "2026-08-10T12:00:00Z" : "2026-08-17T12:00:00Z") });
  const sparse = await completedDealInsights(filters(`${marker}-sparse`)); assert.ok(sparse.summary); assert.equal(sparse.history.points.length, 0); assert.equal(sparse.history.trend, null);

  const askingAfter = await marketInsights(filters(mainLocation));
  assert.deepEqual(askingAfter.summary, askingBefore.summary, "asking-price analytics remain unchanged");
  assert.equal(await prisma.priceSnapshot.count(), snapshotsBefore, "completed deals do not write asking-price history");
  assert.equal(await prisma.notification.count(), notificationsBefore, "completed-deal analytics do not create alert notifications");
  const diagnostics = await completedDealDiagnostics(); assert.ok(diagnostics.qualifying >= 59); assert.ok(diagnostics.excludedLegacy >= 1); assert.ok(diagnostics.cohortCoverage >= 2); assert.ok(diagnostics.privacyThresholdFailures >= 2); assert.ok(diagnostics.latestQualifyingCompletion);

  const html = (await (await fetch(`${base}/market/insights?` + new URLSearchParams({ commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", unit: "KG", location: mainLocation, range: "all" }))).text()).replace(/<!--.*?-->/g, "");
  for (const text of ["Completed deal price signals", "Prices participants agreed to in completed Sauti deals", "$2.50", "do not confirm payment occurred"]) assert.ok(html.includes(text), text);
  for (const account of [...sellers, ...buyers]) { assert.ok(!html.includes(account.email)); assert.ok(!html.includes(account.name)); }
  assert.ok(!html.includes("777.77") && !html.includes("888.88") && !html.includes("999.99"), "excluded individual deal prices are private");
  console.log("PASS COMPLETED DEAL INSIGHTS: eligible-state filtering, Decimal normalization, unit separation, three-part privacy thresholds, sparse trends, aggregate-only rendering, diagnostics, and asking/alert isolation.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(value => value.id) } } });
  await prisma.$disconnect(); Module._load = load;
}
