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
const { createSavedSearch, deleteSavedSearch, renameSavedSearch, savedSearchUrl, setSavedSearchEnabled } = require("../src/lib/saved-searches.ts");
const { evaluateSavedSearches } = require("../src/lib/saved-search-evaluator.ts");
const { marketFiltersSchema } = require("../src/lib/market-filters.ts");
const { searchMarket } = require("../src/lib/market-search.ts");
const marker = `Saved-${randomUUID()}`;
let owner;
let stranger;
async function listing(values = {}) { return prisma.product.create({ data: { ownerId: stranger.id, item: `${marker} maize`, category: "Cereals", price: "20", quantity: "10", originalQuantity: "10", remainingQuantity: "10", unit: "KG", status: "ACTIVE", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", location: "Nairobi", country: "KE", description: marker, ...values } }); }

try {
  owner = await prisma.user.create({ data: { name: `${marker} Owner`, email: `${marker}-owner@example.invalid`, passwordHash: "disabled", country: "KE" } });
  stranger = await prisma.user.create({ data: { name: `${marker} Seller`, email: `${marker}-seller@example.invalid`, passwordHash: "disabled", country: "KE" } });
  const existing = await listing();
  const saved = await createSavedSearch(owner.id, { q: `  ${marker}   maize `, country: "ke", unit: "KG", name: "Maize in Kenya", sort: "newest" });
  assert.equal(await prisma.savedSearchMatch.count({ where: { savedSearchId: saved.id, productId: existing.id } }), 1, "existing match establishes baseline");
  assert.equal(await prisma.notification.count({ where: { savedSearchId: saved.id } }), 0, "baseline does not notify");
  await assert.rejects(() => createSavedSearch(owner.id, { q: `${marker.toUpperCase()} MAIZE`, country: "KE", unit: "KG", sort: "price_asc" }), /already saved/i, "canonical duplicate ignores case, spacing, and sort");
  const structured = await createSavedSearch(owner.id, { q: "yellow", name: "Structured query" });
  const structuredMatch = await listing({ item: "Harvest lot", commodity: "MAIZE", variety: "YELLOW", description: "No query phrase here" });
  await evaluateSavedSearches();
  assert.equal(await prisma.savedSearchMatch.count({ where: { savedSearchId: structured.id, productId: structuredMatch.id } }), 1, "structured commodity/variety terms match exactly like Phase 18 search");

  const newMatch = await listing({ item: `${marker} maize fresh`, price: "24" });
  await listing({ item: "Unrelated rice", commodity: "RICE", variety: null, description: "not a match" });
  let result = await evaluateSavedSearches(new Date("2026-09-30T12:00:00Z"));
  assert.equal(result.triggered, 1);
  assert.equal(await prisma.notification.count({ where: { savedSearchId: saved.id, type: "NEW_LISTING_MATCH" } }), 1, "new matching listing notifies once");
  assert.equal(await prisma.savedSearchMatch.count({ where: { savedSearchId: saved.id, productId: newMatch.id } }), 1);
  await evaluateSavedSearches(new Date("2026-09-30T12:30:00Z"));
  assert.equal(await prisma.notification.count({ where: { savedSearchId: saved.id } }), 1, "repeat evaluation is idempotent");

  const inactive = await listing({ item: `${marker} maize inactive`, status: "INACTIVE" });
  await evaluateSavedSearches();
  assert.equal(await prisma.savedSearchMatch.count({ where: { productId: inactive.id } }), 0, "inactive listings do not match");
  await prisma.product.update({ where: { id: inactive.id }, data: { status: "ACTIVE" } });
  await evaluateSavedSearches();
  assert.equal(await prisma.savedSearchMatch.count({ where: { productId: inactive.id } }), 1, "new activation can notify");

  const edited = await listing({ item: "Initially unrelated", commodity: "RICE", variety: null, description: "unrelated" });
  await evaluateSavedSearches();
  await prisma.product.update({ where: { id: edited.id }, data: { item: `${marker} maize edited`, commodity: "MAIZE", variety: "WHITE" } });
  await evaluateSavedSearches();
  assert.equal(await prisma.savedSearchMatch.count({ where: { productId: edited.id } }), 1, "relevant edit can newly match");

  await setSavedSearchEnabled(owner.id, saved.id, false);
  const muted = await listing({ item: `${marker} maize muted` });
  await evaluateSavedSearches();
  assert.equal(await prisma.savedSearchMatch.count({ where: { productId: muted.id } }), 0, "disabled search is skipped");
  await assert.rejects(() => renameSavedSearch(stranger.id, saved.id, "Stolen"), /not found/i, "another user cannot rename");
  await assert.rejects(() => setSavedSearchEnabled(stranger.id, saved.id, true), /not found/i, "another user cannot enable");
  await assert.rejects(() => deleteSavedSearch(stranger.id, saved.id), /not found/i, "another user cannot delete");
  await renameSavedSearch(owner.id, saved.id, "Renamed search");
  assert.equal((await prisma.savedSearch.findUnique({ where: { id: saved.id } })).name, "Renamed search");

  const aggregate = await createSavedSearch(owner.id, { category: `${marker} aggregate`, name: "Aggregate" });
  await Promise.all([listing({ category: `${marker} aggregate`, item: "Aggregate one" }), listing({ category: `${marker} aggregate`, item: "Aggregate two" }), listing({ category: `${marker} aggregate`, item: "Aggregate three" })]);
  result = await evaluateSavedSearches();
  const aggregateNotifications = await prisma.notification.findMany({ where: { savedSearchId: aggregate.id } });
  assert.equal(aggregateNotifications.length, 1, "one evaluation aggregates notification spam");
  assert.match(aggregateNotifications[0].title, /^3 new listings/);

  const url = savedSearchUrl({ q: marker, category: "Cereals", commodity: "MAIZE", variety: "", grade: "", country: "KE", location: "Nairobi", unit: "KG", minPrice: "10", maxPrice: "30", sort: "price_asc" });
  const urlFilters = marketFiltersSchema.parse(Object.fromEntries(new URL(`http://sauti.test${url}`).searchParams));
  assert.equal(urlFilters.q, marker); assert.equal(urlFilters.country, "KE"); assert.equal(urlFilters.sort, "price_asc");
  assert.ok((await searchMarket(urlFilters)).products.some(row => row.id === existing.id), "saved URL reproduces Phase 18 filters");

  const aggregateNotificationId = aggregateNotifications[0].id;
  await deleteSavedSearch(owner.id, aggregate.id);
  assert.equal(await prisma.savedSearchMatch.count({ where: { savedSearchId: aggregate.id } }), 0, "deletion cascades match state");
  assert.equal((await prisma.notification.findUnique({ where: { id: aggregateNotificationId } })).savedSearchId, null, "notification remains after search deletion without exposing criteria");
  console.log("PASS SAVED SEARCHES: canonical creation, silent baseline, exact matching, activation/edit matching, ACTIVE-only and disabled behavior, aggregate idempotent notifications, ownership, URL fidelity, and deletion cleanup.");
} finally {
  if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
  if (stranger) await prisma.user.delete({ where: { id: stranger.id } }).catch(() => {});
  await prisma.$disconnect(); Module._load = load;
}
