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
const { marketFiltersSchema } = require("../src/lib/market-filters.ts");
const { searchMarket } = require("../src/lib/market-search.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const marker = `Search-${randomUUID()}`;
let owner;
function parsed(values = {}) { return marketFiltersSchema.parse(values); }
async function listing(values = {}) { return prisma.product.create({ data: { ownerId: owner.id, item: `${marker} item`, category: "Cereals", price: "20", quantity: "10", originalQuantity: "10", remainingQuantity: "10", unit: "KG", status: "ACTIVE", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", location: marker, country: "KE", description: "Search discovery fixture", ...values } }); }

try {
  owner = await prisma.user.create({ data: { name: `${marker} Seller`, email: `${marker}@example.invalid`, passwordHash: "disabled", country: "KE" } });
  const title = await listing({ item: "Maize", price: "25", createdAt: new Date("2026-01-01T00:00:00Z") });
  const description = await listing({ item: "Harvest lot", commodity: "BEANS", variety: null, description: "Contains the word maize only in this description", price: "15", createdAt: new Date("2026-02-01T00:00:00Z") });
  assert.equal(await prisma.product.count({ where: { location: marker, status: "ACTIVE" } }), 2);
  const ranked = await searchMarket(parsed({ q: "maize", sort: "relevance" }));
  assert.ok(ranked.total >= 2, `expected ranked fixtures, got ${ranked.total}`);
  assert.equal(ranked.products[0].id, title.id, "title and commodity match outrank description-only match");
  assert.ok(ranked.products.some(row => row.id === description.id), "description remains searchable");

  const combined = await listing({ item: `${marker} premium maize`, category: "Produce", price: "45", quantity: "5", unit: "KG", location: "  New   Town  ", country: "UG", commodity: "MAIZE", variety: "YELLOW", grade: "GRADE_2" });
  const combinedResult = await searchMarket(parsed({ category: "Produce", commodity: "MAIZE", variety: "YELLOW", grade: "GRADE_2", country: "ug", location: " new   town ", unit: "KG", minPrice: "40", maxPrice: "50" }));
  assert.deepEqual(combinedResult.products.map(row => row.id), [combined.id], "combined filters and normalized location/country");
  assert.equal((await searchMarket(parsed({ q: "Uganda", location: "new town" }))).products[0].id, combined.id, "country names are searchable without geocoding");

  const cheap = await listing({ item: `${marker} cheap`, category: "UnitSort", price: "5", quantity: "1", createdAt: new Date("2026-03-01T00:00:00Z") });
  const costly = await listing({ item: `${marker} costly`, category: "UnitSort", price: "90", quantity: "100", createdAt: new Date("2026-04-01T00:00:00Z") });
  assert.equal((await searchMarket(parsed({ location: marker, sort: "price_asc" }))).products[0].id, cheap.id);
  assert.equal((await searchMarket(parsed({ location: marker, sort: "price_desc" }))).products[0].id, costly.id);
  const unitSorted = await searchMarket(parsed({ category: "UnitSort", location: marker, unit: "KG", sort: "unit_asc" }));
  assert.equal(unitSorted.products[0].id, costly.id, "normalized unit price uses asking price divided by compatible quantity");
  const incompatible = await listing({ item: `${marker} liquid`, price: "1", quantity: "100", unit: "LITRE" });
  assert.ok(!unitSorted.products.some(row => row.id === incompatible.id), "incompatible units are not mixed in unit-price sorting");
  assert.equal((await searchMarket(parsed({ location: marker, sort: "unit_asc" }))).sort, "newest", "unit sorting requires an explicit compatible unit");

  const hidden = await listing({ item: `${marker} private inactive`, status: "INACTIVE" });
  assert.ok(!(await searchMarket(parsed({ q: "private inactive" }))).products.some(row => row.id === hidden.id), "inactive inventory never appears");
  for (let index = 0; index < 13; index++) await listing({ item: `${marker} page ${index}`, description: `${marker}-pagination`, price: String(index + 1) });
  const pageTwo = await searchMarket(parsed({ q: `${marker}-pagination`, country: "KE", sort: "price_asc", page: "2" }));
  assert.equal(pageTwo.total, 13); assert.equal(pageTwo.products.length, 1);

  const malformed = parsed({ page: "-9", sort: "mystery", minPrice: "-1", maxPrice: "NaN", country: "KEN", unit: "UNKNOWN" });
  assert.equal(malformed.page, 1); assert.equal(malformed.sort, "relevance"); assert.equal(malformed.minPrice, ""); assert.equal(malformed.maxPrice, ""); assert.equal(malformed.country, ""); assert.equal(malformed.unit, "");

  const pageHtml = (await (await fetch(`${base}/market?` + new URLSearchParams({ q: `${marker}-pagination`, country: "KE", sort: "price_asc" }))).text()).replace(/<!--.*?-->/g, "");
  assert.ok(pageHtml.includes("13 active listings") && pageHtml.includes("country=KE") && pageHtml.includes("sort=price_asc") && pageHtml.includes("page=2"), "URL state survives pagination");
  assert.ok(pageHtml.includes("Search:") && pageHtml.includes("Country:") && pageHtml.includes("Clear all"), "active filter chips render");
  const productHref = `/market/${title.id}?from=${encodeURIComponent(`/market?q=maize&location=${marker}`)}`;
  const detailHtml = await (await fetch(base + productHref)).text();
  assert.ok(detailHtml.includes(`href="/market?q=maize&amp;location=${marker}"`), "detail navigation preserves marketplace state");
  const emptyHtml = await (await fetch(`${base}/market?q=${randomUUID()}`)).text();
  assert.ok(emptyHtml.includes("No listings match these filters") && emptyHtml.includes("Clear filters") && emptyHtml.includes("Browse newest listings"));
  const inactiveHtml = await (await fetch(`${base}/market?q=${encodeURIComponent(marker)}`)).text();
  assert.ok(!inactiveHtml.includes(hidden.item), "inactive listing data is not rendered publicly");
  console.log("PASS MARKET SEARCH: weighted keyword relevance, combined URL filters, normalized location/country, safe sorting, unit compatibility, ACTIVE-only pagination, malformed input handling, stateful navigation, and distinct empty states.");
} finally {
  if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
  await prisma.$disconnect(); Module._load = load;
}
