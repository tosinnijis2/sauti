import "server-only";
import { prisma } from "./prisma";
import { cleanupProductPhoto } from "./cloudinary";

export async function cleanupUnreferencedPhoto(image: { ownerId: string; imagePublicId: string | null }) {
  if (!image.imagePublicId) return;
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${image.ownerId} FOR UPDATE`;
      if (await tx.product.count({ where: { imagePublicId: image.imagePublicId } })) return;
      // Serialize attachment and cleanup: a valid receipt cannot race a deletion.
      await cleanupProductPhoto(image);
    }, { timeout: 100000 });
  } catch { console.warn("Product image cleanup needs retry:", image.imagePublicId); }
}
