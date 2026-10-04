import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

process.loadEnvFile();

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
let routeSchedulerStub = false;
let routeCalls = 0;

Module._load = function (name, parent, isMain) {
  if (name === "server-only") return {};
  if (routeSchedulerStub && name === "@/lib/price-watch-runs") {
    return {
      runPriceWatchEvaluation: async ({ source }) => {
        routeCalls++;
        assert.equal(source, "SCHEDULED");
        return {
          acquired: true,
          runId: "phase26-route-smoke",
          status: "SUCCEEDED",
          summary: { scanned: 0, evaluated: 0, insufficient: 0, triggered: 0, suppressed: 0, errors: 0 },
          cleanup: { processed: 0, succeeded: 0, failed: 0, skipped: 0 },
        };
      },
    };
  }
  if (name.startsWith("@/")) name = fileURLToPath(new URL("../src/" + name.slice(2) + ".ts", import.meta.url));
  return originalLoad.call(this, name, parent, isMain);
};

require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};

const originalCronSecret = process.env.CRON_SECRET;
if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) process.env.CRON_SECRET = randomBytes(32).toString("hex");

const { prisma } = require("../src/lib/prisma.ts");
const { runPriceWatchEvaluation } = require("../src/lib/price-watch-runs.ts");
const { processCloudCleanupJobs } = require("../src/lib/cloud-cleanup.ts");
const { priceWatchRunHealth } = require("../src/lib/admin/price-watch-runs.ts");
const { validateProductionEnvironment } = require("../src/lib/env.ts");

routeSchedulerStub = true;
const { POST } = require("../src/app/api/internal/evaluate-price-watches/route.ts");
const { GET: healthGET } = require("../src/app/api/health/route.ts");
routeSchedulerStub = false;

const marker = `phase26-${randomUUID()}`;
const cleanupJobIds = [];
const runIds = [];
const leaseId = "price-watch-evaluator";
const now = new Date();

try {
  const unauthenticated = await POST(new Request("https://sauti.test/api/internal/evaluate-price-watches", { method: "POST" }));
  assert.equal(unauthenticated.status, 401);
  const wrongSecret = await POST(new Request("https://sauti.test/api/internal/evaluate-price-watches", { method: "POST", headers: { authorization: "Bearer wrong-secret" } }));
  assert.equal(wrongSecret.status, 401);
  const authorized = await POST(new Request("https://sauti.test/api/internal/evaluate-price-watches", { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.equal(authorized.status, 200);
  const authorizedBody = await authorized.json();
  assert.equal(authorizedBody.runId, "phase26-route-smoke");
  assert.equal(routeCalls, 1);

  const envResult = validateProductionEnvironment({
    NODE_ENV: "production",
    DATABASE_URL: "present",
    AUTH_SECRET: "a".repeat(32),
    CLOUDINARY_CLOUD_NAME: "present",
    CLOUDINARY_API_KEY: "present",
    CLOUDINARY_API_SECRET: "present",
    CRON_SECRET: "b".repeat(32),
    RESEND_API_KEY: "present",
    EMAIL_FROM: "pilot@example.test",
    APP_URL: "https://staging.sauti.example",
  });
  assert.equal(envResult.valid, true);

  const invalidCleanup = await prisma.cloudAssetCleanupJob.create({ data: { ownerId: marker, publicId: `unmanaged/${marker}`, kind: "PRODUCT", nextAttemptAt: new Date(now.getTime() - 1000) } });
  cleanupJobIds.push(invalidCleanup.id);
  const cleanup = await processCloudCleanupJobs(now);
  assert.equal(cleanup.failed, 1);
  const invalidCleanupAfter = await prisma.cloudAssetCleanupJob.findUniqueOrThrow({ where: { id: invalidCleanup.id } });
  assert.equal(invalidCleanupAfter.status, "FAILED");
  assert.equal(invalidCleanupAfter.lastErrorCode, "unmanaged-id");
  await prisma.cloudAssetCleanupJob.delete({ where: { id: invalidCleanup.id } });
  cleanupJobIds.pop();

  const dueCleanup = await prisma.cloudAssetCleanupJob.count({ where: { status: "PENDING", nextAttemptAt: { lte: now } } });
  assert.equal(dueCleanup, 0, "Phase 26 scheduler smoke expects no pre-existing due cleanup jobs.");

  await prisma.rateLimitBucket.create({ data: { key: `phase26:${marker}`, count: 1, windowStart: new Date(now.getTime() - 10_000), expiresAt: new Date(now.getTime() - 1000) } });

  await prisma.priceWatchEvaluatorLease.upsert({
    where: { id: leaseId },
    create: { id: leaseId, token: marker, acquiredAt: now, expiresAt: new Date(now.getTime() + 60_000) },
    update: { token: marker, acquiredAt: now, expiresAt: new Date(now.getTime() + 60_000) },
  });
  const skipped = await runPriceWatchEvaluation({ source: "SCHEDULED", now, evaluate: async () => { throw new Error("lease should prevent evaluation"); } });
  runIds.push(skipped.runId);
  assert.equal(skipped.acquired, false);
  assert.equal(skipped.status, "SKIPPED");
  await prisma.priceWatchEvaluatorLease.deleteMany({ where: { id: leaseId, token: marker } });

  const successful = await runPriceWatchEvaluation({
    source: "SCHEDULED",
    now,
    evaluate: async () => ({ scanned: 3, evaluated: 2, insufficient: 1, triggered: 1, suppressed: 0, errors: 0 }),
  });
  runIds.push(successful.runId);
  assert.equal(successful.acquired, true);
  assert.equal(successful.status, "SUCCEEDED");
  assert.equal(successful.cleanup?.failed, 0);

  const storedRun = await prisma.priceWatchEvaluationRun.findUniqueOrThrow({ where: { id: successful.runId } });
  assert.equal(storedRun.source, "SCHEDULED");
  assert.equal(storedRun.watchesScanned, 3);
  assert.equal(storedRun.notificationsCreated, 1);
  assert.equal(storedRun.cleanupFailed, 0);
  assert.equal(await prisma.rateLimitBucket.count({ where: { key: `phase26:${marker}` } }), 0);

  const health = await priceWatchRunHealth(new Date(), 1, 5);
  assert.equal(health.latest?.id, successful.runId);
  assert.equal(health.stale, false);
  assert.equal(health.cleanupFailures, 0);
  assert.equal(health.status, "Healthy");

  const healthResponse = await healthGET();
  assert.equal(healthResponse.status, 200);
  const healthBody = await healthResponse.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.ready, true);

  console.log("PASS PHASE 26 READINESS: env validation, scheduler auth, lease overlap, run recording, cleanup protections, rate-limit pruning, operations health, and readiness endpoint.");
} finally {
  await prisma.cloudAssetCleanupJob.deleteMany({ where: { id: { in: cleanupJobIds } } });
  await prisma.priceWatchEvaluationRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.rateLimitBucket.deleteMany({ where: { key: `phase26:${marker}` } });
  await prisma.priceWatchEvaluatorLease.deleteMany({ where: { id: leaseId, token: marker } });
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  await prisma.$disconnect();
  Module._load = originalLoad;
}
