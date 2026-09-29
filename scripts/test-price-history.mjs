import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const { saveListing, changeListingStatus, deleteOwnedListing } = require("../src/lib/listings.ts");
const { capturePriceSnapshot } = require("../src/lib/price-snapshots.ts");
const { historicalPriceHistory } = require("../src/lib/price-history.ts");
const { insightFiltersSchema } = require("../src/lib/insight-filters.ts");
const { marketSnapshot } = require("../src/lib/insights.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";

const marker = `History-${randomUUID()}`;
const productKeys = [];
let owner;
const form = values => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };
const fields = { item: marker, category: "Cereals", price: "40", quantity: "1", unit: "SACK", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", packageQuantity: "50", packageUnit: "KG", location: marker, country: "UG", description: "Initial historical listing description" };
const filters = values => insightFiltersSchema.parse({ commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", unit: "KG", location: marker, ...values });
async function count(key) { return prisma.priceSnapshot.count({ where: { productKey: key } }); }
async function directProduct(values = {}) {
  const product = await prisma.product.create({ data: { ownerId: owner.id, item: marker, category: "Cereals", price: "1", quantity: "1", unit: "KG", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", location: marker, country: "UG", description: "Historical aggregation fixture", ...values } });
  productKeys.push(product.id);
  return product;
}
async function capture(product, capturedAt, force = false) {
  return prisma.$transaction(tx => capturePriceSnapshot(tx, product, { capturedAt, force }));
}

try {
  owner = await prisma.user.create({ data: { name: "History QA", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled-test-account" } });
  await saveListing(owner.id, form(fields));
  let product = await prisma.product.findFirstOrThrow({ where: { ownerId: owner.id, item: marker } });
  productKeys.push(product.id);
  assert.equal(await count(product.id), 1, "eligible creation records one snapshot");
  const first = await prisma.priceSnapshot.findFirstOrThrow({ where: { productKey: product.id } });
  assert.equal(first.normalizedPrice.toString(), "0.8");
  assert.equal(first.normalizedUnit, "KG");

  await saveListing(owner.id, form({ ...fields, description: "Only the wording changed in this description" }), product.id);
  assert.equal(await count(product.id), 1, "description edit is not a price observation");
  await saveListing(owner.id, form({ ...fields, description: "Only the wording changed in this description", price: "50" }), product.id);
  assert.equal(await count(product.id), 2, "price change records a snapshot");
  await saveListing(owner.id, form({ ...fields, description: "Only the wording changed in this description", price: "50", quantity: "2" }), product.id);
  assert.equal(await count(product.id), 3, "quantity change records normalized state");
  const beforeMetadata = await prisma.priceSnapshot.findFirstOrThrow({ where: { productKey: product.id }, orderBy: { capturedAt: "desc" } });
  await saveListing(owner.id, form({ ...fields, description: "Only the wording changed in this description", price: "50", quantity: "2", commodity: "RICE", variety: "BASMATI", grade: "GRADE_2" }), product.id);
  assert.equal(await count(product.id), 4);
  const metadata = await prisma.priceSnapshot.findFirstOrThrow({ where: { productKey: product.id }, orderBy: { capturedAt: "desc" } });
  assert.equal(beforeMetadata.commodity, "MAIZE"); assert.equal(beforeMetadata.variety, "WHITE"); assert.equal(beforeMetadata.grade, "GRADE_1");
  assert.equal(metadata.commodity, "RICE"); assert.equal(metadata.variety, "BASMATI"); assert.equal(metadata.grade, "GRADE_2");
  await saveListing(owner.id, form({ ...fields, description: "Only the wording changed in this description", price: "50", quantity: "2", commodity: "RICE", variety: "BASMATI", grade: "GRADE_2" }), product.id);
  assert.equal(await count(product.id), 4, "duplicate effective state is ignored");
  await changeListingStatus(owner.id, product.id, "SOLD");
  assert.equal(await count(product.id), 4, "leaving ACTIVE retains history without adding an observation");
  await changeListingStatus(owner.id, product.id, "ACTIVE");
  assert.equal(await count(product.id), 5, "reactivation records a fresh observation");

  const deletedKey = product.id;
  await deleteOwnedListing(owner.id, product.id);
  const retained = await prisma.priceSnapshot.findMany({ where: { productKey: deletedKey } });
  assert.equal(retained.length, 5); assert.ok(retained.every(row => row.productId === null), "listing deletion preserves detached history");

  const firstDay = new Date("2026-01-05T12:00:00.000Z");
  const secondDay = new Date("2026-01-06T12:00:00.000Z");
  for (let index = 1; index <= 5; index++) {
    let row = await directProduct({ price: String(index) });
    await capture(row, firstDay);
    row = await prisma.product.update({ where: { id: row.id }, data: { price: String(index + 1) } });
    await capture(row, secondDay);
  }
  const daily = await historicalPriceHistory(filters());
  assert.equal(daily.granularity, "day");
  assert.deepEqual(daily.points.map(point => [point.period.slice(0, 10), point.observations, point.median]), [["2026-01-05", 5, "3"], ["2026-01-06", 5, "4"]]);
  assert.deepEqual(daily.trend, { current: "4", previous: "3", percentage: "33.3" });
  assert.ok((await marketSnapshot(owner.id)).some(row => row.commodity === "MAIZE" && row.variety === "WHITE" && row.grade === "GRADE_1" && row.trend === "33.3"));

  const weeklyLocation = `${marker}-weekly`;
  const weekDates = ["2026-02-02", "2026-02-03", "2026-02-09", "2026-02-10"];
  const weeklyProducts = [];
  for (let index = 0; index < 3; index++) weeklyProducts.push(await directProduct({ commodity: "BEANS", variety: null, grade: "STANDARD", location: weeklyLocation, price: String(index + 1) }));
  for (let day = 0; day < weekDates.length; day++) {
    for (let index = 0; index < weeklyProducts.length; index++) {
      const row = await prisma.product.update({ where: { id: weeklyProducts[index].id }, data: { price: String(index + 1 + day) } });
      await capture(row, new Date(`${weekDates[day]}T12:00:00.000Z`), day === 0);
    }
  }
  const weekly = await historicalPriceHistory(filters({ commodity: "BEANS", variety: "", grade: "STANDARD", location: weeklyLocation }));
  assert.equal(weekly.granularity, "week"); assert.equal(weekly.points.length, 2); assert.ok(weekly.points.every(point => point.observations === 6)); assert.ok(weekly.trend);
  const insufficient = await historicalPriceHistory(filters({ commodity: "RICE", variety: "BASMATI", grade: "GRADE_1", location: `${marker}-none` }));
  assert.equal(insufficient.points.length, 0); assert.equal(insufficient.trend, null);
  assert.equal((await historicalPriceHistory(filters({ q: "maize" }))).unavailableReason, "search-filter");

  const baseline = await directProduct({ commodity: "COFFEE", variety: null, grade: null, location: `${marker}-backfill` });
  const started = Date.now();
  const run = () => execFileSync(process.execPath, ["scripts/backfill-price-snapshots.mjs"], { cwd: process.cwd(), encoding: "utf8" });
  assert.match(run(), /created: 1/);
  assert.match(run(), /created: 0/);
  const baselineRows = await prisma.priceSnapshot.findMany({ where: { productKey: baseline.id } });
  assert.equal(baselineRows.length, 1); assert.ok(baselineRows[0].capturedAt.getTime() >= started, "baseline uses execution time, never a fabricated historical date");
  const response = await fetch(base + "/market/insights?" + new URLSearchParams({ category: "Cereals", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", unit: "KG", location: marker }));
  assert.equal(response.status, 200);
  const html = await response.text();
  const rendered = html.replace(/<!--.*?-->/g, "");
  for (const value of ["Price History", "Based on Sauti asking prices", "Latest recorded median", "$4.00", "33.3%", "Recorded observations", "Missing periods are not interpolated"]) assert.ok(rendered.includes(value), value);
  assert.ok(!html.includes("official commodity price") && !html.includes("transaction price"));
  console.log("PASS PRICE HISTORY: creation/change triggers, unrelated-edit and duplicate suppression, normalized state changes, immutable dimensions, status transitions, deletion retention, daily/weekly medians, trend threshold, search honesty and idempotent execution-time backfill.");
} finally {
  await prisma.priceSnapshot.deleteMany({ where: { OR: [{ productKey: { in: productKeys } }, { location: { startsWith: marker } }] } });
  if (owner) await prisma.user.deleteMany({ where: { id: owner.id } });
  await prisma.$disconnect();
  Module._load = load;
}
