import "server-only";
import { z } from "zod";
import { prisma } from "./prisma";

export const favoriteProductId = z.string().min(1).max(100).regex(/^[a-zA-Z0-9-]+$/);
export class FavoriteError extends Error {}

export async function setFavorite(userId: string, rawProductId: unknown, saved: boolean) {
  const parsed = favoriteProductId.safeParse(rawProductId);
  if (!parsed.success) throw new FavoriteError("Choose a valid listing.");
  const productId = parsed.data;
  return prisma.$transaction(async tx => {
    // Keep existence checks and the mutation atomic with product deletion.
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR KEY SHARE`;
    const product = await tx.product.findUnique({ where: { id: productId }, select: { ownerId: true } });
    if (!product) {
      if (!saved) return { saved: false, ownerId: null };
      throw new FavoriteError("This listing is no longer available.");
    }
    if (saved && product.ownerId === userId) throw new FavoriteError("Your own listings are already in My listings.");
    if (saved) await tx.favorite.createMany({ data: [{ userId, productId }], skipDuplicates: true });
    else await tx.favorite.deleteMany({ where: { userId, productId } });
    return { saved, ownerId: product.ownerId };
  });
}

export async function savedProductIds(userId: string | undefined, ids: string[]) {
  if (!userId || !ids.length) return new Set<string>();
  const favorites = await prisma.favorite.findMany({ where: { userId, productId: { in: ids } }, select: { productId: true } });
  return new Set(favorites.map(favorite => favorite.productId));
}
