import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";
import { SignJWT } from "jose";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { normalizedPrice, UNIT_VALUES, formatUnitPrice } = require("../src/lib/units.ts");
const { productSchema, editProductSchema } = require("../src/lib/validation.ts");
const { saveListing, changeListingStatus } = require("../src/lib/listings.ts");
const { marketInsights, marketSnapshot } = require("../src/lib/insights.ts");
const { insightFiltersSchema } = require("../src/lib/insight-filters.ts");
const { dashboardData } = require("../src/lib/dashboard.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const marker = `UnitStatus-${randomUUID()}`;
const users = [];
const formData = values => { const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, value)); return form; };
const fields = { item: marker, commodity: "MAIZE", category: "Cereals", price: "40", quantity: "25", unit: "KG", location: "Kampala", country: "UG", description: marker };
const filters = (unit = "KG") => insightFiltersSchema.parse({ q: marker, commodity: "MAIZE", unit });
async function user() {
  const value = await prisma.user.create({ data: { name: "Unit status QA", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled-test-account" } });
  users.push(value.id);
  const token = await new SignJWT({ version: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(value.id).setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return { ...value, cookie: `sauti_session=${token}` };
}
async function html(path, cookie = "") { return (await fetch(base + path, { headers: { Cookie: cookie } })).text(); }
const approx = (a, b) => assert.ok(Math.abs(a - b) < 0.00000001, `${a} != ${b}`);
try {
  const owner = await user();
  const other = await user();
  for (const quantity of ["0", "-1", "0.0001", "1.2345", "1e3", "NaN", "Infinity", "", "1000000000"]) assert.ok(!productSchema.safeParse({ ...fields, quantity }).success, quantity);
  for (const quantity of ["0.001", "1", "25.125", "999999999.999"]) assert.ok(productSchema.safeParse({ ...fields, quantity }).success, quantity);
  for (const unit of UNIT_VALUES) assert.ok(productSchema.safeParse({ ...fields, unit }).success, unit);
  for (const unit of ["kg", "truck", "", "kilogram"]) assert.ok(!productSchema.safeParse({ ...fields, unit }).success);
  assert.ok(!productSchema.safeParse({ ...fields, price: "0.001" }).success);
  assert.ok(!productSchema.safeParse({ ...fields, status: "DRAFT" }).success);
  assert.equal(productSchema.parse(fields).status, "ACTIVE");
  assert.ok(editProductSchema.safeParse({ ...fields, quantity: "", unit: "" }).success);
  assert.ok(!editProductSchema.safeParse({ ...fields, unit: "" }).success);
  for (const [quantity, unit, result] of [[25, "KG", 1.6], [25000, "G", 1.6], [0.025, "TONNE", 1.6], [25, "LITRE", 1.6], [25000, "ML", 1.6], [2, "BAG", 20]]) approx(normalizedPrice(40, quantity, unit).price, result);
  assert.equal(normalizedPrice(40, 1000, "G").unit, "KG");
  assert.equal(normalizedPrice(40, 1, "TONNE").unit, "KG");
  assert.equal(normalizedPrice(40, 1000, "ML").unit, "LITRE");
  assert.equal(normalizedPrice(40, 1, "DOZEN").unit, "DOZEN");
  for (const args of [[40, null, null], [40, 0, "KG"], [40, 1, null], [0, 1, "KG"]]) assert.equal(normalizedPrice(...args), null);
  assert.equal(formatUnitPrice(0.00000001), "<$0.000001");

  await saveListing(owner.id, formData(fields));
  const product = await prisma.product.findFirstOrThrow({ where: { ownerId: owner.id } });
  assert.equal(product.status, "ACTIVE");
  assert.equal(product.quantity.toString(), "25");
  assert.equal(product.unit, "KG");
  await assert.rejects(saveListing(other.id, formData(fields), product.id));
  await assert.rejects(saveListing(owner.id, formData({ ...fields, quantity: "", unit: "" }), product.id));
  await assert.rejects(changeListingStatus(other.id, product.id, "SOLD"));
  await assert.rejects(changeListingStatus(owner.id, product.id, "DRAFT"));
  await prisma.favorite.create({ data: { userId: other.id, productId: product.id } });
  const conversation = await prisma.conversation.create({ data: { productId: product.id, buyerId: other.id, sellerId: owner.id, productName: product.item } });
  const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8"));
  const [actionId] = Object.entries(manifest.node).find(([, value]) => value.exportedName === "updateListingStatusAction");
  async function statusAction(cookie, status, origin = base) {
    const body = formData({ ["$ACTION_ID_" + actionId]: "", productId: product.id, status, userId: owner.id });
    const response = await fetch(base + "/listings", { method: "POST", headers: { Cookie: cookie, Origin: origin }, body, redirect: "manual" });
    await response.text();
    return response;
  }
  await statusAction(other.cookie, "SOLD");
  await statusAction("", "SOLD");
  await statusAction(owner.cookie, "SOLD", "https://untrusted.invalid");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status, "ACTIVE");
  for (const status of ["RESERVED", "SOLD", "INACTIVE", "ACTIVE"]) {
    await statusAction(owner.cookie, status);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status, status);
    const publicPage = await html("/market?q=" + marker);
    assert.equal(publicPage.includes(`/market/${product.id}`), status === "ACTIVE");
    const sellerPage = await html(`/sellers/${owner.id}`);
    assert.equal(sellerPage.includes(`/market/${product.id}`), status === "ACTIVE");
    const homePage = await html("/");
    assert.equal(homePage.includes(product.item), status === "ACTIVE");
    assert.ok((await html("/listings", owner.cookie)).includes(product.item));
    assert.ok((await html("/saved", other.cookie)).includes(product.item));
    assert.equal((await dashboardData(other.id, "UG")).fresh.some(row => row.id === product.id), status === "ACTIVE");
    assert.equal(await prisma.favorite.count({ where: { productId: product.id } }), 1);
    assert.ok(await prisma.conversation.findUnique({ where: { id: conversation.id } }));
  }
  const detail = await html(`/market/${product.id}`);
  assert.ok(detail.includes("$1.60") && detail.includes("for ") && detail.includes("kg"));
  await changeListingStatus(owner.id, product.id, "INACTIVE");

  const legacy = await prisma.product.create({ data: { ownerId: owner.id, item: "Legacy " + marker, category: "Cereals", price: 99, location: "Kampala", country: "UG", description: marker } });
  assert.equal(legacy.status, "ACTIVE");
  assert.equal(legacy.quantity, null);
  assert.equal(legacy.unit, null);
  await saveListing(owner.id, formData({ ...fields, item: legacy.item, quantity: "", unit: "" }), legacy.id);
  assert.ok((await html(`/market/${legacy.id}`)).includes("Quantity and unit not specified"));
  assert.equal((await marketInsights(filters())).count, 0);
  await saveListing(owner.id, formData({ ...fields, item: legacy.item }), legacy.id);
  assert.equal((await marketInsights(filters())).count, 1);
  await changeListingStatus(owner.id, legacy.id, "INACTIVE");

  const common = { ownerId: owner.id, commodity: "MAIZE", item: marker, category: "Cereals", description: marker, location: "Kampala", country: "UG" };
  const weights = [[10, "KG"], [10000, "G"], [0.01, "TONNE"], [10, "KG"], [10000, "G"]];
  await prisma.product.createMany({ data: weights.map(([quantity, unit], index) => ({ ...common, quantity, unit, price: (index + 1) * 10 })) });
  await prisma.product.createMany({ data: ["LITRE", "ML", "LITRE", "ML", "LITRE"].map((unit, index) => ({ ...common, quantity: unit === "ML" ? 1000 : 1, unit, price: index + 2 })) });
  await prisma.product.createMany({ data: ["BAG", "SACK", "BOX", "CRATE", "BUNDLE", "ITEM", "DOZEN"].flatMap(unit => [1, 2, 3, 4].map(price => ({ ...common, quantity: 1, unit, price }))) });
  await prisma.product.createMany({ data: ["SOLD", "RESERVED", "INACTIVE"].map(status => ({ ...common, quantity: 1, unit: "KG", price: 999, status })) });
  const kg = await marketInsights(filters());
  assert.deepEqual(kg.summary, { count: 5, median: "3", average: "3", low: "1", high: "5" });
  assert.ok(kg.products.every(row => ["KG", "G", "TONNE"].includes(row.unit) && row.status === "ACTIVE"));
  assert.equal(kg.locations[0].count, 5);
  assert.deepEqual((await marketInsights(filters("LITRE"))).summary, { count: 5, median: "4", average: "4", low: "2", high: "6" });
  for (const unit of ["BAG", "SACK", "BOX", "CRATE", "BUNDLE", "ITEM", "DOZEN"]) {
    const data = await marketInsights(filters(unit));
    assert.equal(data.count, 4);
    assert.equal(data.summary, null);
    assert.ok(data.products.every(row => row.unit === unit));
  }
  const snapshot = await marketSnapshot(owner.id);
  assert.ok(snapshot.some(row => row.commodity === "MAIZE" && row.unit === "KG"));
  assert.ok(!snapshot.some(row => row.commodity === "MAIZE" && row.unit === "BAG"));
  const insightPage = await html("/market/insights?" + new URLSearchParams({ q: marker, commodity: "MAIZE", unit: "KG" }));
  assert.ok(insightPage.includes("$3.00") && insightPage.replace(/<!--.*?-->/g, "").includes("USD/kg"));
  const changed = kg.products[0];
  await changeListingStatus(owner.id, changed.id, "SOLD");
  assert.equal((await marketInsights(filters())).summary, null);
  console.log("PASS UNITS/STATUS: precision and required pairs, all standardized units, defaults, owner-only status actions and edits, CSRF/auth rejection, status-aware discovery, retained saved/messages, legacy preservation/upgrades, metric conversion parity, normalized aggregates, incompatible-unit isolation and minimum samples.");
} finally {
  await prisma.priceSnapshot.deleteMany({ where: { product: { ownerId: { in: users } } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
  Module._load = load;
}
