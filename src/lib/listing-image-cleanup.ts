import "server-only";
import { prisma } from "./prisma";
import { cleanupProductPhoto } from "./cloudinary";

export async function cleanupUnreferencedPhoto(image: { ownerId: string; imagePublicId: string | null }) {
  if (!image.imagePublicId) return;
  try {
    const referenced = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${image.ownerId} FOR UPDATE`;
      return tx.product.count({ where: { imagePublicId: image.imagePublicId } });
    }, { timeout: 100000 });
    if (!referenced) await cleanupProductPhoto(image);
  } catch { console.warn("Product image cleanup needs retry:", image.imagePublicId); }
}
