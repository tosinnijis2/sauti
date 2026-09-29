import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { SignJWT } from "jose";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { marketInsights, marketSnapshot, comparableWhere } = require("../src/lib/insights.ts");
const { insightFiltersSchema } = require("../src/lib/insight-filters.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const users = [];
const marker = `Insights-${randomUUID()}`;
const category = marker;
const parse = (values = {}) => insightFiltersSchema.parse({ category, commodity: "MAIZE", ...values });
async function account() {
  const user = await prisma.user.create({ data: { name: "Insights QA", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled-test-account" } });
  users.push(user.id);
  return user;
}
try {
  const owner = await account();
  const buyer = await account();
  const other = await account();
  const fixture = (price, location, country = "UG") => ({ ownerId: owner.id, item: `${marker} maize`, category, commodity: "MAIZE", price, quantity: 1, unit: "KG", location, country, description: `Comparable produce ${marker}` });
  await prisma.product.createMany({ data: [
    ...[10, 20, 30, 40, 50].map(price => fixture(price, "Kampala")),
    ...[10, 20, 30, 40, 50, 60].map(price => fixture(price, "Jinja")),
    ...[100, 200, 300, 400].map(price => fixture(price, "Kampala", "KE")),
    fixture(0, "Kampala"), fixture(-20, "Kampala"),
  ] });
  const nan = await prisma.product.create({ data: fixture(1, "Kampala") });
  await prisma.$executeRaw`UPDATE "Product" SET "price" = 'NaN'::numeric WHERE id = ${nan.id}`;
  const odd = await marketInsights(parse({ location: "kampala", country: "UG" }));
  assert.deepEqual(odd.summary, { count: 5, median: "30", average: "30", low: "10", high: "50" });
  assert.equal(odd.products.length, 5);
  const even = await marketInsights(parse({ location: "jinja", country: "UG" }));
  assert.deepEqual(even.summary, { count: 6, median: "35", average: "35", low: "10", high: "60" });
  const all = await marketInsights(parse());
  assert.equal(all.count, 15);
  assert.equal(all.summary.median, "40");
  assert.ok(new Prisma.Decimal(all.summary.average).minus(new Prisma.Decimal(1360).div(15)).abs().lt("0.000000000001"));
  assert.equal(all.summary.low, "10");
  assert.equal(all.summary.high, "400");
  assert.equal(all.products.length, 12);
  assert.deepEqual(all.locations.map(row => [row.location, row.country, row.count, row.median]), [["Jinja", "UG", 6, "35"], ["Kampala", "UG", 5, "30"]]);
  const last = await marketInsights(parse({ page: 999 }));
  assert.equal(last.page, 2);
  assert.equal(last.products.length, 3);
  assert.ok(last.products.every(p => !all.products.some(first => first.id === p.id)));
  for (const values of [{ q: "MAIZE" }, { q: "Comparable produce" }, { location: "kamp" }, { country: "KE" }, { country: "UG", location: "jinja" }]) {
    const filters = parse(values);
    const result = await marketInsights(filters);
    const matching = await prisma.product.findMany({ where: comparableWhere(filters), select: { id: true } });
    assert.equal(result.count, matching.length);
    assert.ok(result.products.every(p => matching.some(m => m.id === p.id)));
  }
  const small = await marketInsights(parse({ country: "KE" }));
  assert.equal(small.count, 4);
  assert.equal(small.summary, null);
  assert.equal(small.locations.length, 0);
  assert.equal(small.products.length, 4);
  const empty = await marketInsights(parse({ q: "' OR 1=1 --" }));
  assert.equal(empty.count, 0);
  assert.equal(empty.summary, null);
  assert.equal(empty.products.length, 0);
  // Case and surrounding whitespace normalize within a country, not across countries.
  await prisma.product.update({ where: { id: odd.products[0].id }, data: { location: " kampala " } });
  assert.equal((await marketInsights(parse({ country: "UG" }))).locations.find(row => row.median === "30").count, 5);
  // Favor a smaller saved category ahead of larger unrelated categories.
  const savedCategory = `${marker}-saved`;
  await prisma.product.createMany({ data: [10.01, 10.02, 10.03, 10.04, 10.05].map(price => ({ ...fixture(price, "Entebbe"), category: savedCategory, commodity: "RICE" })) });
  const savedProduct = await prisma.product.findFirstOrThrow({ where: { category: savedCategory } });
  await prisma.favorite.create({ data: { userId: buyer.id, productId: savedProduct.id } });
  const snapshot = await marketSnapshot(buyer.id);
  assert.equal(snapshot[0].commodity, "RICE");
  assert.ok(Math.abs(snapshot[0].median - 10.03) < 0.000001);
  assert.notEqual((await marketSnapshot(other.id))[0]?.commodity, "RICE");
  assert.ok(snapshot.length <= 3 && snapshot.every(row => row.count >= 5));
  const token = await new SignJWT({ version: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(buyer.id).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const response = await fetch(base + "/market/insights?" + new URLSearchParams({ category, commodity: "MAIZE", location: "Jinja", country: "UG", q: "maize" }));
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const label of ["Median asking price", "$35.00", "$10.00", "$60.00", "Sauti asking prices", "USD", "Contributing listings", "Jinja"]) assert.ok(html.includes(label), label);
  for (const secret of [owner.email, owner.passwordHash, "Kampala", "price trend"]) assert.ok(!html.includes(secret), `Excluded: ${secret}`);
  const smallHtml = await (await fetch(base + "/market/insights?" + new URLSearchParams({ category, commodity: "MAIZE", country: "KE" }))).text();
  assert.ok(smallHtml.includes("Not enough listings yet"));
  assert.ok(!smallHtml.includes("Average asking price"));
  const emptyHtml = await (await fetch(base + "/market/insights?" + new URLSearchParams({ category, commodity: "MAIZE", q: "does-not-match-any-fixture" }))).text();
  assert.ok(emptyHtml.includes("No active comparable listings match these filters"));
  assert.ok(!emptyHtml.includes("Average asking price"));
  assert.ok(!html.includes("price trend") && !html.includes("% change"));
  const dashboard = await (await fetch(base + "/dashboard", { headers: { Cookie: `sauti_session=${token}` } })).text();
  assert.ok(dashboard.includes("Market Snapshot") && dashboard.includes("Rice") && dashboard.includes("$10.03"));
  // Removing one fixture crosses the minimum-sample boundary immediately.
  await prisma.product.delete({ where: { id: odd.products[0].id } });
  assert.equal((await marketInsights(parse({ location: "kampala", country: "UG" }))).summary, null);
  const model = Prisma.dmmf.datamodel.models.find(model => model.name === "Product");
  const [priceColumn] = await prisma.$queryRaw`SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'price'`;
  assert.equal(priceColumn.is_nullable, "NO");
  assert.ok(model.fields.some(field => field.name === "status"));
  console.log("PASS INSIGHTS: even/odd median, average/min/max/count, invalid-price exclusion, filters, literal SQL safety, paginated contributors, per-country location thresholds, insufficient samples, deleted rows, saved-category priority/isolation, public HTTP and authenticated dashboard rendering with standardized kg fixtures.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
  Module._load = load;
}
