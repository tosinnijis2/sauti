import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { SignJWT } from "jose";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "server-only") return {};
  if (name.startsWith("@/")) name = fileURLToPath(new URL("../src/" + name.slice(2) + ".ts", import.meta.url));
  return originalLoad.call(this, name, parent, isMain);
};
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { prisma } = require("../src/lib/prisma.ts");
const { uploadProductPhoto, verifyUploadReceipt, cleanupProductPhoto } = require("../src/lib/cloudinary.ts");
const { saveListing, deleteOwnedListing } = require("../src/lib/listings.ts");
const { deleteAdminRecord } = require("../src/lib/admin/deletion.ts");
const { imageFileError, isAllowedImageUrl, MAX_IMAGE_BYTES } = require("../src/lib/images.ts");
const sharp = require("sharp");
const live = process.env.LIVE_UPLOAD_TEST === "1";
const originalFetch = globalThis.fetch;
const assets = new Map();
const deleted = [];
let failCleanup = false;
const uploadedIds = [];
const users = [];
const warn = console.warn;
let cleanupWarnings = 0;
console.warn = (...args) => { if (String(args[0]).includes("cleanup")) cleanupWarnings++; else warn(...args); };

if (!live) globalThis.fetch = async (url, options) => {
  if (url.includes("/resources/image/upload/")) {
    const id = decodeURIComponent(url.split("/resources/image/upload/")[1]);
    return assets.has(id) ? Response.json(assets.get(id)) : Response.json({}, { status: 404 });
  }
  const body = options.body;
  const params = Object.fromEntries([...body.entries()].filter(([key]) => !["file", "api_key", "signature"].includes(key)));
  const expected = createHash("sha256").update(Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&") + process.env.CLOUDINARY_API_SECRET).digest("hex");
  assert.ok(body.get("signature") === expected, "Cloudinary request must be signed correctly");
  assert.ok(body.get("api_key") === process.env.CLOUDINARY_API_KEY);
  const id = body.get("public_id");
  if (url.endsWith("/destroy")) {
    if (failCleanup) throw new Error("Simulated provider failure");
    deleted.push(id);
    assets.delete(id);
    return Response.json({ result: "ok" });
  }
  assert.equal(body.get("overwrite"), "false");
  assert.equal(body.get("allowed_formats"), "jpg,png,webp");
  const file = body.get("file");
  const format = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const result = { secure_url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1/${id}.${format}`, public_id: id, resource_type: "image", type: "upload", format, bytes: file.size };
  assets.set(id, result);
  return Response.json(result);
};

const form = (extra = {}) => {
  const value = new FormData();
  Object.entries({ item: "Upload test product", category: "Other", price: "10", quantity: "1", unit: "ITEM", description: "Temporary upload regression fixture", location: "Nairobi", country: "KE", ...extra }).forEach(([key, entry]) => value.set(key, entry));
  return value;
};
async function upload(file, owner, target) {
  const result = await uploadProductPhoto(file, owner, target);
  uploadedIds.push({ ownerId: owner, imagePublicId: result.imagePublicId });
  assert.ok(!JSON.stringify(result).includes(process.env.CLOUDINARY_API_SECRET));
  assert.ok(!JSON.stringify(result).includes(process.env.CLOUDINARY_API_KEY));
  return result;
}
try {
  for (const role of ["USER", "USER", "ADMIN"]) users.push(await prisma.user.create({ data: { name: "Upload regression fixture", email: `upload-${randomUUID()}@example.invalid`, passwordHash: "disabled-test-account", role } }));
  const [seller, stranger, admin] = users;
  const files = [];
  for (const [format, type] of [["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#e97b82" } }).toFormat(format).toBuffer();
    files.push(new File([bytes], `fixture.${format}`, { type }));
  }
  assert.ok(imageFileError({ type: "image/gif", size: 12 }));
  assert.ok(imageFileError({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 }));
  assert.equal(imageFileError({ type: "image/jpeg", size: MAX_IMAGE_BYTES }), null);
  await assert.rejects(uploadProductPhoto(new File(["not a jpeg"], "fake.jpg", { type: "image/jpeg" }), seller.id));
  await assert.rejects(uploadProductPhoto(new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", { type: "image/png" }), seller.id));
  await assert.rejects(saveListing(seller.id, form({ imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg", imagePublicId: "someone-elses-image" })));

  const first = await upload(files[0], seller.id);
  await assert.rejects(verifyUploadReceipt(first.receipt, stranger.id));
  await assert.rejects(verifyUploadReceipt(first.receipt + "tampered", seller.id));
  const parsed = await verifyUploadReceipt(first.receipt, seller.id);
  const expired = await new SignJWT(parsed).setProtectedHeader({ alg: "HS256" }).setAudience("sauti-product-upload").setSubject(seller.id).setExpirationTime(1).sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await assert.rejects(verifyUploadReceipt(expired, seller.id));
  await saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: first.receipt }));
  let listing = await prisma.product.findUniqueOrThrow({ where: { id: parsed.productId } });
  assert.equal(listing.imageUrl, first.imageUrl);
  assert.equal(listing.imagePublicId, first.imagePublicId);
  await assert.rejects(saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: first.receipt })), "Receipt cannot create a second listing");
  await saveListing(seller.id, form(), listing.id);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: listing.id } })).imagePublicId, first.imagePublicId);
  await assert.rejects(saveListing(stranger.id, form({ photoMode: "remove" }), listing.id));
  await assert.rejects(deleteOwnedListing(stranger.id, listing.id));
  const second = await upload(files[1], seller.id, await prisma.product.findUniqueOrThrow({ where: { id: listing.id } }));
  await assert.rejects(saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: second.receipt, price: "-1" }), listing.id));
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: listing.id } })).imagePublicId, first.imagePublicId);
  if (!live) assert.ok(!deleted.includes(first.imagePublicId));
  await saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: second.receipt }), listing.id);
  listing = await prisma.product.findUniqueOrThrow({ where: { id: listing.id } });
  assert.equal(listing.imagePublicId, second.imagePublicId);
  assert.equal(listing.imageUrl, second.imageUrl);
  if (!live) assert.ok(deleted.includes(first.imagePublicId));
  await assert.rejects(saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: second.receipt }), listing.id), "Stale receipt cannot be replayed");
  await saveListing(seller.id, form({ photoMode: "remove" }), listing.id);
  listing = await prisma.product.findUniqueOrThrow({ where: { id: listing.id } });
  assert.equal(listing.imageUrl, null);
  assert.equal(listing.imagePublicId, null);
  if (!live) assert.ok(deleted.includes(second.imagePublicId));
  const third = await upload(files[2], seller.id, listing);
  await saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: third.receipt }), listing.id);
  if (!live) failCleanup = true;
  await deleteOwnedListing(seller.id, listing.id);
  assert.equal(await prisma.product.findUnique({ where: { id: listing.id } }), null);
  if (!live) { assert.equal(cleanupWarnings, 1); failCleanup = false; await cleanupProductPhoto({ ownerId: seller.id, imagePublicId: third.imagePublicId }); }
  await assert.rejects(saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: first.receipt })), "Deleted create receipt cannot resurrect a missing asset");
  for (const oldUrl of ["https://res.cloudinary.com/demo/image/upload/sample.jpg", "https://images.unsplash.com/photo-123", null]) {
    const old = await prisma.product.create({ data: { item: "Legacy photo", category: "Other", price: 1, description: "Legacy fixture", location: "Nairobi", ownerId: seller.id, imageUrl: oldUrl } });
    await saveListing(seller.id, form(), old.id);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: old.id } })).imageUrl, oldUrl);
    if (oldUrl) assert.ok(isAllowedImageUrl(oldUrl));
    await deleteOwnedListing(seller.id, old.id);
  }
  for (const type of ["listings", "users"]) {
    const asset = await upload(files[0], seller.id);
    const data = await verifyUploadReceipt(asset.receipt, seller.id);
    await saveListing(seller.id, form({ photoMode: "replace", uploadReceipt: asset.receipt }));
    await deleteAdminRecord(admin.id, { type, id: type === "users" ? seller.id : data.productId, reason: "Upload regression cleanup test", confirmation: "DELETE" });
    if (!live) assert.ok(deleted.includes(asset.imagePublicId));
  }
  if (live) assert.equal(cleanupWarnings, 0, "Live image cleanup must succeed");
  console.log(`PASS ${live ? "LIVE CLOUDINARY" : "MOCK PROVIDER"}: JPEG/PNG/WebP, size/content validation, private credentials, signed receipts, create/preserve/replace/remove/delete, stale replay, cross-user authorization, admin cleanup and legacy compatibility.`);
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  failCleanup = false;
  for (const image of uploadedIds) await cleanupProductPhoto(image);
  await prisma.$disconnect();
  globalThis.fetch = originalFetch;
  Module._load = originalLoad;
  console.warn = warn;
}
