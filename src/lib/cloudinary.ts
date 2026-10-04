import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { IMAGE_UPLOAD_ERROR, MAX_IMAGE_BYTES, imageFileError, matchesImageContent } from "./images";
import { prisma } from "./prisma";
import { operationalError } from "./operations-log";

export class ImageUploadError extends Error {}

function config() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[\w-]+$/.test(cloud) || !key || !secret) throw new ImageUploadError("Photo uploads are currently unavailable. Please try again later.");
  return { cloud, key, secret };
}

function signature(params: Record<string, string>, secret: string) {
  const serialized = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return createHash("sha256").update(serialized + secret).digest("hex");
}

async function cloudRequest(operation: "upload" | "destroy", params: Record<string, string>, file?: File): Promise<unknown> {
  const { cloud, key, secret } = config();
  const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new FormData();
  Object.entries(signed).forEach(([key, value]) => body.set(key, value));
  body.set("api_key", key);
  body.set("signature", signature(signed, secret));
  if (file) body.set("file", file, "product-photo");
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/${operation}`, {
      method: "POST", body, signal: AbortSignal.timeout(45000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) throw new ImageUploadError(IMAGE_UPLOAD_ERROR);
    return await response.json();
  } catch {
    // Never log provider responses: they can contain request credentials.
    throw new ImageUploadError(IMAGE_UPLOAD_ERROR);
  }
}

const uploadedSchema = z.object({
  secure_url: z.string().url(), public_id: z.string(), format: z.enum(["jpg", "png", "webp"]),
  bytes: z.number().int().positive().max(MAX_IMAGE_BYTES), resource_type: z.literal("image"), type: z.literal("upload"),
});
const receiptSchema = z.object({
  productId: z.string().min(1).max(100), revision: z.string().nullable(),
  imageUrl: z.string().url(), imagePublicId: z.string().max(255),
});
export type UploadReceipt = z.infer<typeof receiptSchema>;

function receiptSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new ImageUploadError("Photo uploads are currently unavailable.");
  return new TextEncoder().encode(secret);
}

export function ownsImageId(publicId: string, userId: string) {
  return /^[a-zA-Z0-9-]+$/.test(userId) && publicId.startsWith(`sauti/products/${userId}/`) &&
    /^[a-f0-9-]{36}$/.test(publicId.slice(`sauti/products/${userId}/`.length));
}

export function ownsAvatarId(publicId: string, userId: string) {
  return /^[a-zA-Z0-9-]+$/.test(userId) && publicId.startsWith(`sauti/avatars/${userId}/`) &&
    /^[a-f0-9-]{36}$/.test(publicId.slice(`sauti/avatars/${userId}/`.length));
}

async function uploadManagedPhoto(file: File, publicId: string) {
  const error = imageFileError(file);
  if (error) throw new ImageUploadError(error);
  if (!matchesImageContent(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) throw new ImageUploadError("Choose a valid JPG, PNG, or WebP image.");
  const result = uploadedSchema.safeParse(await cloudRequest("upload", {
    public_id: publicId, overwrite: "false", allowed_formats: "jpg,png,webp",
  }, file));
  if (!result.success || result.data.public_id !== publicId) throw new ImageUploadError(IMAGE_UPLOAD_ERROR);
  const url = new URL(result.data.secure_url);
  if (url.origin !== "https://res.cloudinary.com" || !url.pathname.startsWith(`/${config().cloud}/image/upload/`) || !url.pathname.endsWith(`/${publicId}.${result.data.format}`)) {
    throw new ImageUploadError(IMAGE_UPLOAD_ERROR);
  }
  return { imageUrl: result.data.secure_url, imagePublicId: publicId };
}

export async function uploadAvatarPhoto(file: File, userId: string) {
  const publicId = `sauti/avatars/${userId}/${randomUUID()}`;
  try {
    return await uploadManagedPhoto(file, publicId);
  } catch (error) {
    await cleanupAvatarPhoto({ ownerId: userId, imagePublicId: publicId });
    throw error;
  }
}

export async function uploadProductPhoto(file: File, userId: string, target?: { id: string; updatedAt: Date }) {
  const error = imageFileError(file);
  if (error) throw new ImageUploadError(error);
  if (!matchesImageContent(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) throw new ImageUploadError("Choose a valid JPG, PNG, or WebP image.");
  // Validate signing configuration before creating an external asset.
  const secret = receiptSecret();
  const publicId = `sauti/products/${userId}/${randomUUID()}`;
  const result = uploadedSchema.safeParse(await cloudRequest("upload", {
    public_id: publicId, overwrite: "false", allowed_formats: "jpg,png,webp",
  }, file));
  if (!result.success || result.data.public_id !== publicId) {
    await cleanupProductPhoto({ ownerId: userId, imagePublicId: publicId });
    throw new ImageUploadError(IMAGE_UPLOAD_ERROR);
  }
  const url = new URL(result.data.secure_url);
  if (url.origin !== "https://res.cloudinary.com" || !url.pathname.startsWith(`/${config().cloud}/image/upload/`) || !url.pathname.endsWith(`/${publicId}.${result.data.format}`)) {
    await cleanupProductPhoto({ ownerId: userId, imagePublicId: publicId });
    throw new ImageUploadError(IMAGE_UPLOAD_ERROR);
  }
  const data: UploadReceipt = { productId: target?.id ?? randomUUID(), revision: target?.updatedAt.toISOString() ?? null, imageUrl: result.data.secure_url, imagePublicId: publicId };
  const receipt = await new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setAudience("sauti-product-upload").setSubject(userId).setIssuedAt().setExpirationTime("30m").sign(secret);
  return { receipt, imageUrl: data.imageUrl, imagePublicId: data.imagePublicId };
}

export async function verifyUploadReceipt(receipt: string, userId: string) {
  try {
    const { payload } = await jwtVerify(receipt, receiptSecret(), { algorithms: ["HS256"], audience: "sauti-product-upload", subject: userId });
    const data = receiptSchema.parse(payload);
    if (!ownsImageId(data.imagePublicId, userId)) throw new Error();
    return data;
  } catch { throw new ImageUploadError("This photo upload has expired or is invalid. Choose the photo again."); }
}

export async function assertUploadedPhoto(data: UploadReceipt) {
  const { cloud, key, secret } = config();
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload/${encodeURIComponent(data.imagePublicId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
      signal: AbortSignal.timeout(8000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const asset = uploadedSchema.parse(await response.json());
    if (asset.public_id !== data.imagePublicId || asset.secure_url !== data.imageUrl) throw new Error();
  } catch { throw new ImageUploadError("We could not verify this uploaded photo. Retry, or choose the photo again."); }
}

export async function cleanupProductPhoto(image: { ownerId: string; imagePublicId: string | null }) {
  if (!image.imagePublicId) return;
  if (!ownsImageId(image.imagePublicId, image.ownerId)) {
    console.warn("Skipped unmanaged product image cleanup.");
    return;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = z.object({ result: z.enum(["ok", "not found"]) }).safeParse(await cloudRequest("destroy", { public_id: image.imagePublicId, invalidate: "true" }));
      if (result.success) {
        await prisma.cloudAssetCleanupJob.updateMany({ where: { publicId: image.imagePublicId }, data: { status: "SUCCEEDED", completedAt: new Date(), lastErrorCode: null } });
        return;
      }
    } catch { /* Database changes are committed; retain success and retry cleanup. */ }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  await queueCleanup(image.ownerId, image.imagePublicId, "PRODUCT");
  console.warn("Product image cleanup queued for retry.");
}

export async function cleanupAvatarPhoto(image: { ownerId: string; imagePublicId: string | null }) {
  if (!image.imagePublicId) return;
  if (!ownsAvatarId(image.imagePublicId, image.ownerId)) {
    console.warn("Skipped unmanaged profile image cleanup.");
    return;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = z.object({ result: z.enum(["ok", "not found"]) }).safeParse(await cloudRequest("destroy", { public_id: image.imagePublicId, invalidate: "true" }));
      if (result.success) {
        await prisma.cloudAssetCleanupJob.updateMany({ where: { publicId: image.imagePublicId }, data: { status: "SUCCEEDED", completedAt: new Date(), lastErrorCode: null } });
        return;
      }
    } catch { /* Keep the profile update successful if provider cleanup is transient. */ }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  await queueCleanup(image.ownerId, image.imagePublicId, "AVATAR");
  console.warn("Profile image cleanup queued for retry.");
}

async function queueCleanup(ownerId: string, publicId: string, kind: "PRODUCT" | "AVATAR") {
  const managed = kind === "PRODUCT" ? ownsImageId(publicId, ownerId) : ownsAvatarId(publicId, ownerId);
  if (!managed) return;
  try {
    await prisma.cloudAssetCleanupJob.upsert({ where: { publicId }, create: { ownerId, publicId, kind }, update: { status: "PENDING", nextAttemptAt: new Date(), completedAt: null, lastErrorCode: null } });
  } catch {
    operationalError("cloud-cleanup-enqueue-failed", { ownerId, kind });
  }
}

export async function destroyManagedCloudAsset(ownerId: string, publicId: string, kind: "PRODUCT" | "AVATAR") {
  const managed = kind === "PRODUCT" ? ownsImageId(publicId, ownerId) : ownsAvatarId(publicId, ownerId);
  if (!managed) return false;
  try {
    const result = z.object({ result: z.enum(["ok", "not found"]) }).safeParse(await cloudRequest("destroy", { public_id: publicId, invalidate: "true" }));
    return result.success;
  } catch { return false; }
}
