import "server-only";
import { prisma } from "./prisma";

export class NotificationPreferenceError extends Error {}

export async function setEmailPriceAlertPreference(userId: string, enabled: boolean) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (enabled && !user.emailVerifiedAt) throw new NotificationPreferenceError("Verify your email to receive price alerts.");
  return prisma.notificationPreference.upsert({ where: { userId }, create: { userId, emailPriceAlerts: enabled }, update: { emailPriceAlerts: enabled } });
}
