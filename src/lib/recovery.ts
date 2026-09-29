import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueReset(email: string) {
  const token = randomBytes(32).toString("hex");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const recent = await tx.passwordReset.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
    if (recent) return null;
    await tx.passwordReset.deleteMany({ where: { userId: user.id } });
    await tx.passwordReset.create({ data: { userId: user.id, tokenHash: tokenDigest(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
    return token;
  });
}

export async function redeemReset(token: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const hash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async tx => {
    const reset = await tx.passwordReset.findUnique({ where: { tokenHash: tokenDigest(token) } });
    if (!reset) return false;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reset.userId} FOR UPDATE`;
    const claimed = await tx.passwordReset.deleteMany({ where: { tokenHash: reset.tokenHash, expiresAt: { gt: new Date() } } });
    if (!claimed.count) return false;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: hash, sessionVersion: { increment: 1 } } });
    await tx.passwordReset.deleteMany({ where: { userId: reset.userId } });
    return true;
  });
}
