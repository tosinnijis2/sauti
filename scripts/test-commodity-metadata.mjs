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
const { productSchema } = require("../src/lib/validation.ts");
const { normalizedPrice } = require("../src/lib/units.ts");
const { ExactDecimal, decimalMoney } = require("../src/lib/decimal.ts");
const { saveListing } = require("../src/lib/listings.ts");
const { marketInsights, comparableWhere, marketSnapshot } = require("../src/lib/insights.ts");
const { insightFiltersSchema } = require("../src/lib/insight-filters.ts");
const { marketWhere, marketFiltersSchema } = require("../src/lib/market-filters.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const marker = `Commodity-${randomUUID()}`;
const users = [];
const fields = { item: marker, category: "Cereals", price: "40", quantity: "1", unit: "SACK", location: marker, country: "UG", description: "Fresh harvest for sale", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", packageQuantity: "50", packageUnit: "KG" };
const form = values => { const body = new FormData(); Object.entries(values).forEach(([key, value]) => body.set(key, value)); return body; };
const filters = values => insightFiltersSchema.parse({ q: marker, commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", ...values });
try {
  for (const values of [fields, { ...fields, variety: "", grade: "" }, { ...fields, commodity: "", variety: "", grade: "" }]) assert.ok(productSchema.safeParse(values).success);
  for (const changes of [{ commodity: "UNKNOWN" }, { variety: "BASMATI" }, { commodity: "", grade: "GRADE_1" }, { grade: "CERTIFIED" }, { packageQuantity: "0" }, { packageQuantity: "-1" }, { packageQuantity: "0.0001" }, { packageQuantity: "" }, { packageUnit: "" }, { packageUnit: "BAG" }, { packageUnit: "DOZEN" }, { unit: "KG" }, { quantity: "" }]) assert.ok(!productSchema.safeParse({ ...fields, ...changes }).success, JSON.stringify(changes));
  for (const price of ["abc", "NaN", "Infinity", "-1", "0", "1e2", "0.001", "10000000000"]) assert.ok(!productSchema.safeParse({ ...fields, price }).success);
  for (const packageUnit of ["G", "KG", "TONNE", "ML", "LITRE", "ITEM"]) assert.ok(productSchema.safeParse({ ...fields, packageUnit }).success);
  for (const [args, expected, quantity] of [
    [["40", "25", "KG"], "1.6", "25"],
    [["40", "1", "SACK", "50", "KG"], "0.8", "50"],
    [["60", "2", "CRATE", "20", "KG"], "1.5", "40"],
    [["0.3", "0.1", "BAG", "0.2", "KG"], "15", "0.02"],
    [["40", "1", "SACK", "50000", "G"], "0.8", "50"],
    [["40", "1", "SACK", "0.05", "TONNE"], "0.8", "50"],
  ]) { const result = normalizedPrice(...args); assert.ok(result.price.eq(expected)); assert.ok(result.quantity.eq(quantity)); }
  assert.equal(normalizedPrice("40", "1", "SACK").unit, "SACK");
  assert.equal(normalizedPrice("40", "1", "SACK", "50", "BAG"), null);
  assert.equal(normalizedPrice("40", "1", "KG", "50", "KG"), null);
  assert.equal(normalizedPrice("40", "1", "SACK", "50", null), null);
  const large = normalizedPrice("9999999999.99", "999999999.999", "SACK", "999999999.999", "KG");
  assert.ok(large.price.eq(new ExactDecimal("9999999999.99").div(new ExactDecimal("999999999.999").pow(2))));
  assert.equal(decimalMoney("0.1000005"), "$0.100001");
  const owner = await prisma.user.create({ data: { name: "Commodity QA", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled-test-account" } });
  users.push(owner.id);
  await saveListing(owner.id, form(fields));
  const saved = await prisma.product.findFirstOrThrow({ where: { ownerId: owner.id } });
  assert.equal(saved.commodity, "MAIZE"); assert.equal(saved.variety, "WHITE"); assert.equal(saved.grade, "GRADE_1");
  assert.equal(saved.packageQuantity.toString(), "50"); assert.equal(saved.packageUnit, "KG");
  await saveListing(owner.id, form({ ...fields, commodity: "RICE", variety: "BASMATI", grade: "STANDARD" }), saved.id);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: saved.id } })).variety, "BASMATI");
  await saveListing(owner.id, form({ ...fields, commodity: "", variety: "", grade: "", packageQuantity: "", packageUnit: "" }), saved.id);
  const cleared = await prisma.product.findUniqueOrThrow({ where: { id: saved.id } });
  for (const key of ["commodity", "variety", "grade", "packageQuantity", "packageUnit"]) assert.equal(cleared[key], null);
  await prisma.product.update({ where: { id: saved.id }, data: { status: "INACTIVE" } });
  const common = { ownerId: owner.id, item: marker, description: "Fresh harvest", category: "Cereals", location: marker, country: "UG", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", quantity: "1", unit: "KG", price: "0.80" };
  await prisma.product.createMany({ data: [common, common, common, { ...common, unit: "SACK", packageQuantity: "50", packageUnit: "KG", price: "40" }, { ...common, quantity: "2", unit: "CRATE", packageQuantity: "20", packageUnit: "KG", price: "32" }] });
  for (const attributes of [{ grade: "GRADE_2" }, { variety: "YELLOW" }, { commodity: "RICE", variety: "BASMATI" }]) await prisma.product.createMany({ data: Array.from({ length: 5 }, () => ({ ...common, ...attributes, price: "10" })) });
  await prisma.product.createMany({ data: Array.from({ length: 4 }, () => ({ ...common, variety: null, grade: null, price: "99" })) });
  await prisma.product.createMany({ data: ["SOLD", "RESERVED", "INACTIVE"].map(status => ({ ...common, status, price: "999" })) });
  await prisma.product.createMany({ data: Array.from({ length: 5 }, () => ({ ...common, unit: "SACK", price: "40" })) });
  const legacy = await prisma.product.create({ data: { ...common, item: `Maize legacy ${marker}`, commodity: null, variety: null, grade: null } });
  const result = await marketInsights(filters());
  assert.deepEqual(result.summary, { count: 5, median: "0.8", average: "0.8", low: "0.8", high: "0.8" });
  assert.equal(result.locations[0].count, 5);
  assert.equal(result.products.length, 5);
  for (const product of result.products) assert.ok(normalizedPrice(product.price, product.quantity, product.unit, product.packageQuantity, product.packageUnit).price.eq(result.summary.median));
  for (const attributes of [{ grade: "GRADE_2" }, { variety: "YELLOW" }, { commodity: "RICE", variety: "BASMATI" }]) {
    const query = filters(attributes); const group = await marketInsights(query);
    assert.equal(group.count, 5); assert.equal(group.summary.median, "10");
    assert.equal(await prisma.product.count({ where: comparableWhere(query) }), 5);
  }
  assert.equal((await marketInsights(filters({ variety: "", grade: "" }))).summary, null);
  assert.equal((await marketInsights(filters({ unit: "SACK" }))).summary.median, "40");
  const unselected = await marketInsights(filters({ commodity: "", variety: "", grade: "" }));
  assert.equal(unselected.summary, null); assert.equal(unselected.products.length, 0); assert.ok(unselected.groups.length >= 5);
  const search = marketWhere(marketFiltersSchema.parse({ q: "maize", location: marker }));
  assert.equal(await prisma.product.count({ where: { AND: [search, { id: result.products[0].id }] } }), 1);
  const snapshots = await marketSnapshot(owner.id);
  assert.ok(snapshots.every(row => row.commodity && row.count >= 5));
  for (const changes of [{ commodity: null }, { variety: "BASMATI" }, { unit: "SACK", packageQuantity: "50", packageUnit: "BAG" }, { unit: "KG", packageQuantity: "50", packageUnit: "KG" }]) await assert.rejects(prisma.product.create({ data: { ...common, ...changes } }));
  const detail = await (await fetch(`${base}/market/${result.products.find(row => row.unit === "SACK").id}`)).text();
  assert.ok(detail.includes("seller-provided") && detail.includes("$0.80") && detail.includes("50 kg"));
  const legacyHtml = await (await fetch(`${base}/market/${legacy.id}`)).text();
  assert.ok(legacyHtml.includes(legacy.item));
  const insightHtml = await (await fetch(base + "/market/insights?" + new URLSearchParams({ q: marker, commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1" }))).text();
  assert.ok(insightHtml.includes("$0.80") && insightHtml.includes("Grade 1"));
  let searchHtml = "";
  for (const page of ["1", "2", "3"]) searchHtml += await (await fetch(base + "/market?" + new URLSearchParams({ q: "maize", location: marker, page }))).text();
  assert.ok(searchHtml.includes(`/market/${result.products[0].id}`));
  console.log("PASS COMMODITY: persistence/edit/clear, validation and database constraints, explicit/multiple packages, metric conversion, Decimal precision, no inferred weights, separate grade/variety/unspecified cohorts, ACTIVE-only, legacy discovery, structured search and HTTP rendering.");
} finally {
  await prisma.priceSnapshot.deleteMany({ where: { product: { ownerId: { in: users } } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
  Module._load = load;
}
