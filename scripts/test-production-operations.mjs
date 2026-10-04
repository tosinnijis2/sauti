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
const originalFetch = globalThis.fetch;
let destroyCalls = 0;
globalThis.fetch = async url => {
  if (String(url).includes("api.cloudinary.com") && String(url).endsWith("/destroy")) { destroyCalls++; return new Response(JSON.stringify({ result: "ok" }), { status: 200 }); }
  return originalFetch(url);
};
const { prisma } = require("../src/lib/prisma.ts");
const { processCloudCleanupJobs } = require("../src/lib/cloud-cleanup.ts");
const { consumeRateLimit } = require("../src/lib/rate-limit.ts");
const { validateProductionEnvironment } = require("../src/lib/env.ts");
const ids = [];

try {
  const ownerId = randomUUID();
  const publicId = `sauti/products/${ownerId}/${randomUUID()}`;
  const job = await prisma.cloudAssetCleanupJob.create({ data: { ownerId, publicId, kind: "PRODUCT" } }); ids.push(job.id);
  const success = await processCloudCleanupJobs(new Date("2030-10-01T00:00:00Z"));
  assert.equal(success.succeeded, 1); assert.equal(destroyCalls, 1);
  assert.equal((await prisma.cloudAssetCleanupJob.findUniqueOrThrow({ where: { id: job.id } })).status, "SUCCEEDED");
  await processCloudCleanupJobs(new Date("2030-10-02T00:00:00Z")); assert.equal(destroyCalls, 1, "completed cleanup is idempotent");

  const invalid = await prisma.cloudAssetCleanupJob.create({ data: { ownerId, publicId: `unmanaged/${randomUUID()}`, kind: "PRODUCT" } }); ids.push(invalid.id);
  await processCloudCleanupJobs(new Date("2030-10-03T00:00:00Z"));
  assert.equal((await prisma.cloudAssetCleanupJob.findUniqueOrThrow({ where: { id: invalid.id } })).lastErrorCode, "unmanaged-id");
  assert.equal(destroyCalls, 1, "unmanaged public IDs never reach Cloudinary");

  globalThis.fetch = async url => String(url).endsWith("/destroy") ? new Response("unavailable", { status: 503 }) : originalFetch(url);
  const failingId = `sauti/avatars/${ownerId}/${randomUUID()}`;
  const failing = await prisma.cloudAssetCleanupJob.create({ data: { ownerId, publicId: failingId, kind: "AVATAR" } }); ids.push(failing.id);
  for (let attempt = 0; attempt < 5; attempt++) await processCloudCleanupJobs(new Date(Date.UTC(2031, 9, 10 + attempt * 2)));
  const terminal = await prisma.cloudAssetCleanupJob.findUniqueOrThrow({ where: { id: failing.id } });
  assert.equal(terminal.status, "FAILED"); assert.equal(terminal.attempts, 5); assert.equal(terminal.lastErrorCode, "provider-unavailable");

  const rateKey = randomUUID();
  assert.equal(await consumeRateLimit("phase23", rateKey, 2, 60_000, new Date("2026-10-01T00:00:00Z")), true);
  assert.equal(await consumeRateLimit("phase23", rateKey, 2, 60_000, new Date("2026-10-01T00:00:01Z")), true);
  assert.equal(await consumeRateLimit("phase23", rateKey, 2, 60_000, new Date("2026-10-01T00:00:02Z")), false);
  assert.equal(await consumeRateLimit("phase23", rateKey, 2, 60_000, new Date("2026-10-01T00:02:00Z")), true, "expired durable window resets");

  const invalidEnv = validateProductionEnvironment({ NODE_ENV: "production" });
  assert.equal(invalidEnv.valid, false); assert.ok(invalidEnv.missing.includes("DATABASE_URL"));
  const source = ["next.config.ts", "src/app/admin/reports/page.tsx", "src/app/admin/reviews/page.tsx", "src/app/admin/evaluations/page.tsx"].map(file => readFileSync(file, "utf8")).join("\n");
  for (const value of ["Content-Security-Policy", "X-Frame-Options", "Referrer-Policy", "skip:", "Cloud asset cleanup jobs"]) assert.ok(source.includes(value), `missing hardening marker: ${value}`);
  console.log("PASS PRODUCTION OPERATIONS: durable validated cleanup, bounded retries, idempotency, database rate limits, production env checks, security headers, and paginated admin operations.");
} finally {
  globalThis.fetch = originalFetch;
  await prisma.cloudAssetCleanupJob.deleteMany({ where: { id: { in: ids } } });
  await prisma.rateLimitBucket.deleteMany({ where: { key: { contains: "phase23:" } } });
  await prisma.$disconnect(); Module._load = load;
}
