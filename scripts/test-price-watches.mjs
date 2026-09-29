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
const { capturePriceSnapshot } = require("../src/lib/price-snapshots.ts");
const { createPriceWatch, deletePriceWatch, PriceWatchError, setPriceWatchEnabled } = require("../src/lib/price-watches.ts");
const { evaluatePriceWatches } = require("../src/lib/price-watch-evaluator.ts");
const { markAllNotificationsRead, markNotificationRead, unreadNotificationCount } = require("../src/lib/notifications.ts");

const marker = `Watch-${randomUUID()}`;
const productKeys = [];
let user;
let other;
const watch = (location, condition, threshold) => createPriceWatch(user.id, { commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", normalizedUnit: "KG", country: "UG", location, condition, threshold });
async function cohort(location, medians) {
  const rows = [];
  for (let index = 0; index < 5; index++) {
    let row = await prisma.product.create({ data: { ownerId: user.id, item: marker, category: "Cereals", price: String(medians[0] + index - 2), quantity: "1", unit: "KG", commodity: "MAIZE", variety: "WHITE", grade: "GRADE_1", country: "UG", location, description: "Price watch evaluation fixture" } });
    productKeys.push(row.id); rows.push(row);
    await prisma.$transaction(tx => capturePriceSnapshot(tx, row, { capturedAt: new Date("2026-09-01T12:00:00Z"), force: true, reason: "BASELINE" }));
    for (let day = 1; day < medians.length; day++) {
      row = await prisma.product.update({ where: { id: row.id }, data: { price: String(medians[day] + index - 2) } });
      rows[index] = row;
      await prisma.$transaction(tx => capturePriceSnapshot(tx, row, { capturedAt: new Date(`2026-09-${String(day + 1).padStart(2, "0")}T12:00:00Z`), reason: "CHANGE" }));
    }
  }
  return rows;
}
async function append(rows, median, day) {
  for (let index = 0; index < rows.length; index++) {
    rows[index] = await prisma.product.update({ where: { id: rows[index].id }, data: { price: String(median + index - 2) } });
    await prisma.$transaction(tx => capturePriceSnapshot(tx, rows[index], { capturedAt: new Date(`2026-09-${String(day).padStart(2, "0")}T12:00:00Z`), reason: "CHANGE" }));
  }
}

try {
  await prisma.priceSnapshot.deleteMany({ where: { location: { startsWith: "Watch-" } } });
  await prisma.user.deleteMany({ where: { name: { in: ["Watch owner", "Other user"] }, email: { endsWith: "@example.invalid" } } });
  user = await prisma.user.create({ data: { name: "Watch owner", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled" } });
  other = await prisma.user.create({ data: { name: "Other user", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled" } });
  const crossingRows = await cohort(`${marker}-cross`, [110, 80]);
  await cohort(`${marker}-rise`, [100, 120]);
  await cohort(`${marker}-drop`, [100, 80]);
  const insufficientRows = await cohort(`${marker}-insufficient`, [100]);
  await prisma.priceSnapshot.deleteMany({ where: { productKey: { in: insufficientRows.slice(1).map(row => row.id) } } });

  const below = await watch(`${marker}-cross`, "BELOW", "100");
  await watch(`${marker}-cross`, "ABOVE", "70");
  await watch(`${marker}-rise`, "PERCENT_RISE", "10");
  await watch(`${marker}-drop`, "PERCENT_DROP", "10");
  await watch(`${marker}-insufficient`, "BELOW", "200");
  const disabled = await watch(`${marker}-cross`, "BELOW", "90");
  await setPriceWatchEnabled(user.id, disabled.id, false);
  await assert.rejects(() => watch(`${marker}-cross`, "BELOW", "100"), PriceWatchError);

  const first = await evaluatePriceWatches(new Date("2026-09-10T12:00:00Z"));
  assert.equal(first.triggered, 4); assert.equal(first.insufficient, 1);
  assert.equal(await unreadNotificationCount(user.id), 4);
  const repeated = await evaluatePriceWatches(new Date("2026-09-10T13:00:00Z"));
  assert.equal(repeated.triggered, 0); assert.equal(await unreadNotificationCount(user.id), 4);

  await append(crossingRows, 120, 3);
  await evaluatePriceWatches(new Date("2026-09-10T14:00:00Z"));
  assert.equal((await prisma.priceWatch.findUniqueOrThrow({ where: { id: below.id } })).lastConditionMet, false);
  await append(crossingRows, 70, 4);
  const recross = await evaluatePriceWatches(new Date("2026-09-10T15:00:00Z"));
  assert.ok(recross.triggered >= 1); assert.equal(await prisma.notification.count({ where: { watchId: below.id } }), 2);

  const one = await prisma.notification.findFirstOrThrow({ where: { userId: user.id, readAt: null } });
  assert.equal((await markNotificationRead(other.id, one.id)).count, 0, "other user cannot mark notification read");
  assert.equal((await markNotificationRead(user.id, one.id)).count, 1);
  assert.equal((await markAllNotificationsRead(other.id)).count, 0);
  await markAllNotificationsRead(user.id); assert.equal(await unreadNotificationCount(user.id), 0);

  await prisma.notificationPreference.create({ data: { userId: user.id, inAppPriceAlerts: false } });
  const preferenceWatch = await watch(`${marker}-cross`, "BELOW", "75");
  const suppressed = await evaluatePriceWatches(new Date("2026-09-10T16:00:00Z"));
  assert.ok(suppressed.suppressed >= 1); assert.equal(await prisma.notification.count({ where: { watchId: preferenceWatch.id } }), 0);
  await assert.rejects(() => deletePriceWatch(other.id, below.id), PriceWatchError);
  await deletePriceWatch(user.id, disabled.id);
  assert.equal(await prisma.priceWatch.count({ where: { id: disabled.id } }), 0);
  assert.equal(await prisma.notification.count({ where: { userId: other.id } }), 0, "notifications remain private");
  console.log("PASS PRICE WATCHES: creation, duplicate prevention, below/above and percentage triggers, insufficient and disabled suppression, crossing dedupe, reset/re-cross, preferences, ownership, privacy, and read state.");
} finally {
  if (user) await prisma.notification.deleteMany({ where: { userId: user.id } });
  if (user) await prisma.priceWatch.deleteMany({ where: { userId: user.id } });
  await prisma.priceSnapshot.deleteMany({ where: { productKey: { in: productKeys } } });
  await prisma.user.deleteMany({ where: { id: { in: [user?.id, other?.id].filter(Boolean) } } });
  await prisma.$disconnect(); Module._load = load;
}
