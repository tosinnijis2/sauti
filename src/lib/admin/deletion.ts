import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cleanupUnreferencedPhoto } from "@/lib/listing-image-cleanup";

export const deletionSchema = z.object({
  type: z.enum(["users", "listings", "messages"]),
  id: z.string().min(1).max(100),
  reason: z.string().trim().min(10, "Enter a reason of at least 10 characters.").max(500),
  confirmation: z.literal("DELETE", { error: "Type DELETE to confirm." }),
});
export class DeletionError extends Error {}

export async function deleteAdminRecord(adminId: string, input: z.infer<typeof deletionSchema>) {
  const data = deletionSchema.parse(input);
  const images = await prisma.$transaction(async tx => {
    let images: { ownerId: string; imagePublicId: string | null }[] = [];
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${adminId} FOR UPDATE`;
    const admin = await tx.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (admin?.role !== "ADMIN") throw new DeletionError("Administrator access is required.");
    if (data.type === "users") {
      if (data.id === adminId) throw new DeletionError("You cannot delete your own account.");
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${data.id} FOR UPDATE`;
      const target = await tx.user.findUnique({ where: { id: data.id }, select: { role: true } });
      if (!target) throw new DeletionError("This user no longer exists.");
      if (target.role === "ADMIN") throw new DeletionError("Administrator accounts cannot be deleted here.");
      images = await tx.product.findMany({ where: { ownerId: data.id }, select: { ownerId: true, imagePublicId: true } });
      await tx.user.delete({ where: { id: data.id } });
    } else if (data.type === "listings") {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${data.id} FOR UPDATE`;
      images = await tx.product.findMany({ where: { id: data.id }, select: { ownerId: true, imagePublicId: true } });
      const result = await tx.product.deleteMany({ where: { id: data.id } });
      if (!result.count) throw new DeletionError("This listing no longer exists.");
    } else {
      const result = await tx.message.deleteMany({ where: { id: data.id, OR: [{ country: { not: null } }, { reports: { some: {} } }] } });
      if (!result.count) throw new DeletionError("Message not found or not eligible for moderation.");
    }
    await tx.auditLog.create({ data: { adminId, action: "DELETE", targetType: data.type, targetId: data.id, reason: data.reason } });
    return images;
  });
  for (const image of images) await cleanupUnreferencedPhoto(image);
}
