import "server-only";
import { prisma } from "./prisma";
import { productSchema, editProductSchema, listingStatusSchema } from "./validation";
import { assertUploadedPhoto, verifyUploadReceipt } from "./cloudinary";
import { cleanupUnreferencedPhoto } from "./listing-image-cleanup";
import { capturePriceSnapshot } from "./price-snapshots";

export class ListingError extends Error {}

export async function saveListing(userId: string, form: FormData, productId?: string) {
  const parsed = (productId ? editProductSchema : productSchema).safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new ListingError(parsed.error.issues[0]?.message ?? "Please check the product information.");
  const data = { ...parsed.data, quantity: parsed.data.quantity || null, unit: parsed.data.unit || null,
    commodity: parsed.data.commodity || null, variety: parsed.data.variety || null, grade: parsed.data.grade || null,
    packageQuantity: parsed.data.packageQuantity || null, packageUnit: parsed.data.packageUnit || null };
  if (form.get("imageUrl") || form.get("imagePublicId")) throw new ListingError("Choose a photo using the upload control.");
  const mode = form.get("photoMode") ?? "keep";
  if (!["keep", "replace", "remove"].includes(String(mode))) throw new ListingError("Invalid photo selection.");
  const receipt = mode === "replace" ? await verifyUploadReceipt(String(form.get("uploadReceipt") ?? ""), userId) : null;
  if (receipt && ((productId && receipt.productId !== productId) || (!productId && receipt.revision !== null))) throw new ListingError("This upload belongs to a different listing.");
  const oldImage = await prisma.$transaction(async tx => {
    // Serialize this owner's changes with administrative user deletion.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (!productId) {
      if (receipt) await assertUploadedPhoto(receipt);
      const product = await tx.product.create({ data: { ...data, ownerId: userId, ...(receipt ? { id: receipt.productId, imageUrl: receipt.imageUrl, imagePublicId: receipt.imagePublicId } : {}) } });
      await capturePriceSnapshot(tx, product, { reason: "CREATE", operation: "listing-create" });
      return null;
    }
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    const current = await tx.product.findFirst({ where: { id: productId, ownerId: userId } });
    if (!current) throw new ListingError("That listing could not be found.");
    if (current.quantity !== null && !parsed.data.quantity) throw new ListingError("Keep the quantity and unit on this standardized listing.");
    if (receipt && receipt.revision !== current.updatedAt.toISOString()) throw new ListingError("This listing changed while uploading. Reload it before replacing the photo.");
    if (receipt) await assertUploadedPhoto(receipt);
    const image = mode === "remove" ? { imageUrl: null, imagePublicId: null } : receipt ? { imageUrl: receipt.imageUrl, imagePublicId: receipt.imagePublicId } : {};
    const product = await tx.product.update({ where: { id: current.id }, data: { ...data, ...image } });
    const reactivated = current.status !== "ACTIVE" && product.status === "ACTIVE";
    await capturePriceSnapshot(tx, product, { force: reactivated, reason: reactivated ? "REACTIVATED" : "CHANGE", operation: "listing-edit" });
    return mode !== "keep" && current.imagePublicId !== receipt?.imagePublicId ? current : null;
  }, { timeout: 15000 });
  // Cleanup only after the new database state has committed successfully.
  if (oldImage) await cleanupUnreferencedPhoto(oldImage);
}

export async function changeListingStatus(userId: string, productId: string, value: unknown) {
  const parsed = listingStatusSchema.safeParse(value);
  if (!parsed.success) throw new ListingError("Choose a valid listing status.");
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    const current = await tx.product.findFirst({ where: { id: productId, ownerId: userId } });
    if (!current) throw new ListingError("That listing could not be found.");
    const product = await tx.product.update({ where: { id: current.id }, data: { status: parsed.data } });
    const reactivated = current.status !== "ACTIVE" && product.status === "ACTIVE";
    await capturePriceSnapshot(tx, product, { force: reactivated, reason: reactivated ? "REACTIVATED" : "CHANGE", operation: "listing-status" });
  });
}

export async function deleteOwnedListing(userId: string, productId: string) {
  const deleted = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    const current = await tx.product.findFirst({ where: { id: productId, ownerId: userId } });
    if (!current) throw new ListingError("That listing could not be found.");
    await tx.product.delete({ where: { id: current.id } });
    return current;
  });
  await cleanupUnreferencedPhoto(deleted);
}
