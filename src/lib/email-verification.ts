import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { tokenDigest } from "./recovery";
import { EmailDeliveryError, sendEmail } from "./email";

const TOKEN_TTL_MS = 24 * 60 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;

export type VerificationRequestResult = "sent" | "rate-limited" | "already-verified" | "unavailable";

function appOrigin() {
  const value = process.env.APP_URL;
  if (!value) return null;
  try {
    const origin = new URL(value);
    return origin.protocol === "https:" || ["localhost", "127.0.0.1"].includes(origin.hostname) ? origin : null;
  } catch { return null; }
}

export async function requestEmailVerification(userId: string, now = new Date()): Promise<VerificationRequestResult> {
  const origin = appOrigin();
  if (!origin) return "unavailable";
  const token = randomBytes(32).toString("hex");
  const user = await prisma.$transaction(async tx => {
    const found = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, emailVerifiedAt: true } });
    if (!found || found.emailVerifiedAt) return null;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const recent = await tx.emailVerification.findFirst({ where: { userId, createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) } } });
    if (recent) return "rate-limited" as const;
    await tx.emailVerification.deleteMany({ where: { userId } });
    await tx.emailVerification.create({ data: { userId, tokenHash: tokenDigest(token), createdAt: now, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) } });
    return found;
  });
  if (user === null) return "already-verified";
  if (user === "rate-limited") return "rate-limited";
  const link = new URL("/verify-email", origin);
  link.searchParams.set("token", token);
  try {
    await sendEmail({ to: user.email, subject: "Verify your Sauti email", text: `Verify your Sauti email address using this single-use link (expires in 24 hours):\n${link}\n\nFor your security, sign in to the same Sauti account before confirming. If you did not request this, ignore this email.` });
    return "sent";
  } catch (error) {
    await prisma.emailVerification.deleteMany({ where: { tokenHash: tokenDigest(token) } });
    if (error instanceof EmailDeliveryError && error.code === "provider-unconfigured") return "unavailable";
    console.error("Email verification delivery failed", { userId, code: error instanceof EmailDeliveryError ? error.code : "unknown" });
    return "unavailable";
  }
}

export async function verifyEmailToken(userId: string, token: string, now = new Date()) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return prisma.$transaction(async tx => {
    const verification = await tx.emailVerification.findUnique({ where: { tokenHash: tokenDigest(token) } });
    if (!verification || verification.userId !== userId || verification.expiresAt <= now) return false;
    const claimed = await tx.emailVerification.deleteMany({ where: { tokenHash: verification.tokenHash, userId, expiresAt: { gt: now } } });
    if (!claimed.count) return false;
    await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: now } });
    await tx.emailVerification.deleteMany({ where: { userId } });
    return true;
  });
}
