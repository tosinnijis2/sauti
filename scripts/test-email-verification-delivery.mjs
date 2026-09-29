import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

process.loadEnvFile();
process.env.APP_URL = "http://localhost:3101";
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { requestEmailVerification, verifyEmailToken } = require("../src/lib/email-verification.ts");
const { setEmailTransportForTests, EmailDeliveryError } = require("../src/lib/email.ts");
const { setEmailPriceAlertPreference, NotificationPreferenceError } = require("../src/lib/notification-preferences.ts");
const { deliverPendingPriceAlertEmails } = require("../src/lib/notification-delivery.ts");

const suffix = randomUUID();
const sent = [];
let failure = null;
setEmailTransportForTests({ send: async message => { if (failure) throw failure; sent.push(message); } });
let user; let other;
try {
  user = await prisma.user.create({ data: { name: "Email test user", email: `phase10-${suffix}@example.test`, passwordHash: "disabled" } });
  other = await prisma.user.create({ data: { name: "Email test other", email: `phase10-other-${suffix}@example.test`, passwordHash: "disabled" } });

  assert.equal(await requestEmailVerification(user.id, new Date("2026-10-01T00:00:00Z")), "sent");
  const token = sent.at(-1).text.match(/token=([a-f0-9]{64})/)?.[1];
  assert.ok(token, "verification email contains an unguessable token");
  assert.equal(sent.at(-1).text.includes(process.env.RESEND_API_KEY ?? "not-a-secret"), false, "provider secrets never enter email output");
  assert.equal(await requestEmailVerification(user.id, new Date("2026-10-01T00:00:30Z")), "rate-limited");
  assert.equal(await verifyEmailToken(other.id, token, new Date("2026-10-01T00:01:00Z")), false, "another user cannot verify with this token");
  assert.equal(await verifyEmailToken(user.id, token, new Date("2026-10-01T00:01:00Z")), true);
  assert.equal(await verifyEmailToken(user.id, token, new Date("2026-10-01T00:01:01Z")), false, "used token cannot be reused");
  assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt);

  assert.equal(await requestEmailVerification(other.id, new Date("2026-10-01T02:00:00Z")), "sent");
  const expiredToken = sent.at(-1).text.match(/token=([a-f0-9]{64})/)?.[1];
  await prisma.emailVerification.update({ where: { tokenHash: require("../src/lib/recovery.ts").tokenDigest(expiredToken) }, data: { expiresAt: new Date("2026-10-01T02:00:00Z") } });
  assert.equal(await verifyEmailToken(other.id, expiredToken, new Date("2026-10-01T02:00:01Z")), false, "expired token is rejected");

  await assert.rejects(() => setEmailPriceAlertPreference(other.id, true), NotificationPreferenceError);
  const preference = await setEmailPriceAlertPreference(user.id, true);
  assert.equal(preference.emailPriceAlerts, true, "verified users may enable email alerts");

  const notification = await prisma.notification.create({ data: { userId: user.id, type: "PRICE_ALERT", title: "Maize price watch triggered", message: "fixture", href: "/market/insights?commodity=MAIZE" } });
  await prisma.notificationEmailDelivery.create({ data: { notificationId: notification.id, cohort: "Maize", trigger: "Median falls below $10/Kilogram", currentMedian: "9", unit: "Kilogram", country: "UG", location: "Kampala", href: "/market/insights?commodity=MAIZE" } });
  const beforeAlert = sent.length;
  assert.deepEqual(await deliverPendingPriceAlertEmails(new Date("2026-10-01T03:00:00Z")), { sent: 1, failed: 0, skipped: 0 });
  assert.equal(sent.length, beforeAlert + 1, "one in-app notification produces one email");
  assert.match(sent.at(-1).text, /Sauti median asking price/);
  assert.match(sent.at(-1).text, /Manage price-alert preferences/);
  await deliverPendingPriceAlertEmails(new Date("2026-10-01T04:00:00Z"));
  assert.equal(sent.length, beforeAlert + 1, "sent delivery is idempotent");
  assert.equal(await prisma.notification.count({ where: { id: notification.id } }), 1, "in-app notification remains authoritative");

  const retryNotification = await prisma.notification.create({ data: { userId: user.id, type: "PRICE_ALERT", title: "Rice price watch triggered", message: "fixture", href: "/market/insights?commodity=RICE" } });
  await prisma.notificationEmailDelivery.create({ data: { notificationId: retryNotification.id, cohort: "Rice", trigger: "Median rises above $20/Kilogram", currentMedian: "21", unit: "Kilogram", href: "/market/insights?commodity=RICE" } });
  failure = new EmailDeliveryError("network", true);
  assert.deepEqual(await deliverPendingPriceAlertEmails(new Date("2026-10-01T05:00:00Z")), { sent: 0, failed: 1, skipped: 0 });
  const pending = await prisma.notificationEmailDelivery.findUniqueOrThrow({ where: { notificationId: retryNotification.id } });
  assert.equal(pending.status, "PENDING"); assert.equal(pending.failureCount, 1);
  assert.equal(await prisma.notification.count({ where: { id: retryNotification.id } }), 1, "failed email cannot remove the in-app alert");
  failure = null;
  assert.deepEqual(await deliverPendingPriceAlertEmails(pending.nextAttemptAt), { sent: 1, failed: 0, skipped: 0 });
  assert.equal((await prisma.notificationEmailDelivery.findUniqueOrThrow({ where: { notificationId: retryNotification.id } })).status, "SENT");
  console.log("PASS EMAIL VERIFICATION + DELIVERY: signed tokens, expiry/single-use/ownership, resend limits, verified preference gating, one-email delivery, idempotency, and bounded retry.");
} finally {
  setEmailTransportForTests(undefined);
  if (user) await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  if (other) await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
  await prisma.$disconnect();
  Module._load = load;
}
