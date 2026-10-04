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
const { runPriceWatchEvaluation } = require("../src/lib/price-watch-runs.ts");
const { markNotificationRead } = require("../src/lib/notifications.ts");
const { deliverPriceAlertEmail } = require("../src/lib/notification-delivery.ts");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const runIds = [];
let user; let other; let admin; let member;

async function token(account) {
  return new SignJWT({ version: account.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(account.id).setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
}

try {
  await prisma.priceWatchEvaluatorLease.deleteMany({ where: { id: "price-watch-evaluator" } });
  const success = await runPriceWatchEvaluation({ source: "MANUAL", evaluate: async () => ({ scanned: 7, evaluated: 5, insufficient: 1, triggered: 2, suppressed: 1, errors: 0 }) });
  runIds.push(success.runId); assert.equal(success.status, "SUCCEEDED");
  const successRun = await prisma.priceWatchEvaluationRun.findUniqueOrThrow({ where: { id: success.runId } });
  assert.deepEqual([successRun.watchesScanned, successRun.watchesEvaluated, successRun.notificationsCreated, successRun.watchesSkipped, successRun.errors], [7, 5, 2, 2, 0]);

  const partial = await runPriceWatchEvaluation({ source: "MANUAL", evaluate: async () => ({ scanned: 4, evaluated: 2, insufficient: 1, triggered: 1, suppressed: 0, errors: 1 }) });
  runIds.push(partial.runId); assert.equal(partial.status, "PARTIAL");
  const originalError = console.error; console.error = () => {};
  const failed = await runPriceWatchEvaluation({ source: "MANUAL", evaluate: async () => { throw new Error("intentional test failure"); } });
  console.error = originalError;
  runIds.push(failed.runId); assert.equal(failed.status, "FAILED");

  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const firstPromise = runPriceWatchEvaluation({ source: "MANUAL", evaluate: async () => { await blocked; return { scanned: 0, evaluated: 0, insufficient: 0, triggered: 0, suppressed: 0, errors: 0 }; } });
  await new Promise(resolve => setTimeout(resolve, 100));
  const overlap = await runPriceWatchEvaluation({ source: "SCHEDULED" });
  runIds.push(overlap.runId); assert.equal(overlap.status, "SKIPPED"); assert.equal(overlap.acquired, false);
  release(); const first = await firstPromise; runIds.push(first.runId); assert.equal(first.status, "SUCCEEDED");

  assert.equal((await fetch(`${base}/api/internal/evaluate-price-watches`, { method: "POST" })).status, 401);
  assert.equal((await fetch(`${base}/api/internal/evaluate-price-watches`, { method: "POST", headers: { Authorization: "Bearer invalid" } })).status, 401);
  const scheduled = await fetch(`${base}/api/internal/evaluate-price-watches`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(scheduled.status, 200); const scheduledBody = await scheduled.json(); runIds.push(scheduledBody.runId); assert.ok(["SUCCEEDED", "PARTIAL", "SKIPPED"].includes(scheduledBody.status));

  user = await prisma.user.create({ data: { name: "Paged notices", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled" } });
  other = await prisma.user.create({ data: { name: "Private notices", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled" } });
  admin = await prisma.user.create({ data: { name: "Run admin", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled", role: "ADMIN" } });
  member = await prisma.user.create({ data: { name: "Run member", email: `${randomUUID()}@example.invalid`, passwordHash: "disabled" } });
  const marker = `Notice-${randomUUID()}`;
  await prisma.notification.createMany({ data: Array.from({ length: 31 }, (_, index) => ({ userId: user.id, type: "PRICE_ALERT", title: `${marker}-${String(index).padStart(2, "0")}`, message: "Pagination fixture", createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)) })) });
  await prisma.notification.create({ data: { userId: other.id, type: "PRICE_ALERT", title: `${marker}-PRIVATE`, message: "Must not leak" } });
  const cookie = `sauti_session=${await token(user)}`;
  const pageOne = await (await fetch(`${base}/notifications?page=1`, { headers: { Cookie: cookie } })).text();
  const pageTwo = await (await fetch(`${base}/notifications?page=2`, { headers: { Cookie: cookie } })).text();
  const renderedOne = pageOne.replace(/<!--.*?-->/g, ""); const renderedTwo = pageTwo.replace(/<!--.*?-->/g, "");
  assert.ok(renderedOne.includes("Page 1 of 2") && renderedTwo.includes("Page 2 of 2"));
  assert.ok(!pageOne.includes(`${marker}-PRIVATE`) && !pageTwo.includes(`${marker}-PRIVATE`));
  const secondPageNotification = await prisma.notification.findFirstOrThrow({ where: { userId: user.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  assert.equal((await markNotificationRead(other.id, secondPageNotification.id)).count, 0);
  assert.equal((await markNotificationRead(user.id, secondPageNotification.id)).count, 1);

  await prisma.notificationPreference.create({ data: { userId: user.id, emailPriceAlerts: false } });
  const email = await deliverPriceAlertEmail({ deliveryId: secondPageNotification.id, recipient: user.email, cohort: "Maize", trigger: "below", currentMedian: "1.00", href: `${base}/market/insights` });
  assert.equal(email.status, "disabled");
  assert.equal(await prisma.notification.count({ where: { id: secondPageNotification.id } }), 1, "email state cannot remove in-app source record");

  const anonymousAdmin = await fetch(`${base}/admin/evaluations`, { redirect: "manual" }); assert.ok([302, 303, 307, 308].includes(anonymousAdmin.status));
  assert.equal((await fetch(`${base}/admin/evaluations`, { headers: { Cookie: `sauti_session=${await token(member)}` }, redirect: "manual" })).status, 404);
  const adminPage = await fetch(`${base}/admin/evaluations`, { headers: { Cookie: `sauti_session=${await token(admin)}` } });
  assert.equal(adminPage.status, 200); const adminHtml = await adminPage.text(); assert.ok(adminHtml.includes("Scheduled operations") && adminHtml.includes("Run history") && adminHtml.includes("Cloud asset cleanup jobs")); assert.ok(!adminHtml.includes(user.email));
  console.log("PASS ALERT OPERATIONS: endpoint secret, lease overlap, durable success/partial/failure metrics, admin-only monitoring, private pagination/read state, and disabled email delivery.");
} finally {
  await prisma.priceWatchEvaluatorLease.deleteMany({ where: { id: "price-watch-evaluator" } });
  await prisma.priceWatchEvaluationRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [user?.id, other?.id, admin?.id, member?.id].filter(Boolean) } } });
  await prisma.$disconnect(); Module._load = load;
}
