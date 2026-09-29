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
const { auditHistoricalData, computeHistoricalDataHealth, repairCurrentPriceSnapshots } = require("../src/lib/admin/history.ts");
const { capturePriceSnapshot } = require("../src/lib/price-snapshots.ts");
const { historicalPriceHistory } = require("../src/lib/price-history.ts");
const { insightFiltersSchema } = require("../src/lib/insight-filters.ts");

const base = process.env.TEST_APP_URL || "http://localhost:3101";
const marker = `HistoryOps-${randomUUID()}`;
const productKeys = [];
let owner;
let admin;
let member;

async function session(user) {
  return new SignJWT({ version: user.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
}

async function product(data = {}) {
  const row = await prisma.product.create({ data: { ownerId: owner.id, item: marker, category: "Cereals", price: "10", quantity: "1", unit: "KG", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", location: marker, country: "UG", description: "Historical operations fixture", ...data } });
  productKeys.push(row.id);
  return row;
}

async function capture(row, capturedAt, force = false) {
  return prisma.$transaction(tx => capturePriceSnapshot(tx, row, { capturedAt, force, reason: "BASELINE", operation: "history-operations-test" }));
}

try {
  owner = await prisma.user.create({ data: { name: `${marker} Owner`, email: `${randomUUID()}@example.invalid`, passwordHash: "disabled" } });
  admin = await prisma.user.create({ data: { name: "History admin", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled", role: "ADMIN" } });
  member = await prisma.user.create({ data: { name: "History member", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled" } });

  const before = await computeHistoricalDataHealth(new Date("2026-09-29T12:00:00.000Z"));
  const missing = await product();
  const health = await computeHistoricalDataHealth(new Date("2026-09-29T12:00:00.000Z"));
  assert.equal(health.eligibleActive, before.eligibleActive + 1);
  assert.ok(health.missingExpected >= before.missingExpected + 1);
  assert.equal(health.status, "Needs attention");
  assert.ok((await auditHistoricalData()).issues.some(issue => issue.type === "missing-current" && issue.productKey === missing.id));

  const dryRun = await repairCurrentPriceSnapshots({ dryRun: true });
  assert.ok(dryRun.missingSnapshot >= 1);
  assert.equal(await prisma.priceSnapshot.count({ where: { productKey: missing.id } }), 0, "dry run does not write");
  const repairStarted = Date.now();
  const repaired = await repairCurrentPriceSnapshots();
  assert.ok(repaired.created >= 1);
  const repairedRow = await prisma.priceSnapshot.findFirstOrThrow({ where: { productKey: missing.id } });
  assert.ok(repairedRow.capturedAt.getTime() >= repairStarted, "repair uses its execution timestamp");
  const again = await repairCurrentPriceSnapshots();
  assert.equal(again.created, 0, "repair is idempotent");
  assert.ok(again.alreadyCurrent >= 1);

  await prisma.product.update({ where: { id: missing.id }, data: { price: "11" } });
  assert.ok((await auditHistoricalData()).issues.some(issue => issue.type === "state-mismatch" && issue.productKey === missing.id));
  await repairCurrentPriceSnapshots();
  assert.ok(!(await auditHistoricalData()).issues.some(issue => issue.type === "state-mismatch" && issue.productKey === missing.id));

  const now = new Date("2026-09-29T12:00:00.000Z");
  const dates = ["2025-09-30", "2026-04-03", "2026-07-02", "2026-09-01"];
  for (let index = 0; index < 5; index++) {
    let row = await product({ price: String(index + 1), location: `${marker}-ranges` });
    for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
      if (dateIndex) row = await prisma.product.update({ where: { id: row.id }, data: { price: String(index + dateIndex + 1) } });
      await capture(row, new Date(`${dates[dateIndex]}T12:00:00.000Z`), dateIndex === 0);
    }
  }
  const history = async range => historicalPriceHistory(insightFiltersSchema.parse({ commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", unit: "KG", location: `${marker}-ranges`, range }), now);
  assert.equal((await history("30")).points.length, 1);
  assert.equal((await history("90")).points.length, 2);
  assert.equal((await history("180")).points.length, 3);
  assert.equal((await history("365")).points.length, 4);
  assert.equal((await history("all")).points.length, 4);
  assert.equal((await history("30")).trend, null, "trend stays inside the selected range");
  assert.ok((await history("90")).trend, "trend uses two in-range periods");
  assert.equal((await historicalPriceHistory(insightFiltersSchema.parse({ commodity: "RICE", variety: "BASMATI", grade: "GRADE_1", unit: "KG", location: marker, range: "30" }), now)).points.length, 0);

  const deleted = await product({ item: `${marker} private`, location: `${marker}-private` });
  await capture(deleted, now);
  await prisma.product.delete({ where: { id: deleted.id } });
  const detached = await prisma.priceSnapshot.findFirstOrThrow({ where: { productKey: deleted.id } });
  assert.equal(detached.productId, null);
  assert.ok(!Object.hasOwn(detached, "ownerId") && !Object.hasOwn(detached, "email") && !Object.hasOwn(detached, "phone"));

  const anonymous = await fetch(`${base}/admin/history`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymous.status));
  const memberResponse = await fetch(`${base}/admin/history`, { headers: { Cookie: `sauti_session=${await session(member)}` }, redirect: "manual" });
  assert.equal(memberResponse.status, 404);
  const adminResponse = await fetch(`${base}/admin/history`, { headers: { Cookie: `sauti_session=${await session(admin)}` } });
  assert.equal(adminResponse.status, 200);
  const html = await adminResponse.text();
  assert.ok(html.includes("Snapshot health") && html.includes("Consistency audit"));
  assert.ok(!html.includes(owner.email) && !html.includes(owner.name), "admin history omits seller identity");

  console.log("PASS HISTORY OPERATIONS: health metrics, current-state audit, dry-run/idempotent repair, execution timestamps, bounded ranges and trends, sparse ranges, detached privacy, and admin-only access.");
} finally {
  await prisma.priceSnapshot.deleteMany({ where: { productKey: { in: productKeys } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner?.id, admin?.id, member?.id].filter(Boolean) } } });
  await prisma.$disconnect();
  Module._load = load;
}
