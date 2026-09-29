import "server-only";
import { prisma } from "./prisma";

export async function markNotificationRead(userId: string, id: string, now = new Date()) {
  return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: now } });
}

export async function markAllNotificationsRead(userId: string, now = new Date()) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
}

export async function unreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
