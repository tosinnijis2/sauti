import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { SignJWT } from "jose";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { cleanupProductPhoto } = require("../src/lib/cloudinary.ts");
const sharp = require("sharp");
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8"));
const users = [];
const images = [];
const privateValues = [process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].filter(Boolean);
function noCredentials(text) { assert.ok(privateValues.every(value => !text.includes(value)), "Response/build must not contain Cloudinary credentials"); }
function scan(dir) { for (const file of readdirSync(dir, { withFileTypes: true })) { const target = path.join(dir, file.name); if (file.isDirectory()) scan(target); else if (/\.(js|map|json)$/.test(file.name)) noCredentials(readFileSync(target, "utf8")); } }
async function account() {
  const user = await prisma.user.create({ data: { name: "Upload HTTP test", email: `upload-http-${randomUUID()}@example.invalid`, passwordHash: "disabled-test-account" } });
  users.push(user);
  const jwt = await new SignJWT({ version: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return { user, cookie: `sauti_session=${jwt}` };
}
async function upload(cookie, file, productId, origin = base) {
  const body = new FormData();
  body.set("photo", file);
  if (productId) body.set("productId", productId);
  const response = await fetch(base + "/api/uploads/product", { method: "POST", headers: { Origin: origin, Cookie: cookie }, body });
  const text = await response.text();
  noCredentials(text);
  return { status: response.status, data: JSON.parse(text) };
}
try {
  const seller = await account();
  const other = await account();
  const photo = new File([await sharp({ create: { width: 32, height: 24, channels: 3, background: "#80aa91" } }).jpeg().toBuffer()], "test.jpg", { type: "image/jpeg" });
  assert.equal((await upload("", photo)).status, 401);
  assert.equal((await upload(seller.cookie, photo, null, "https://untrusted.invalid")).status, 403);
  assert.equal((await upload(seller.cookie, new File(["gif"], "wrong.gif", { type: "image/gif" }))).status, 400);
  assert.equal((await upload(seller.cookie, new File(["fake"], "fake.jpg", { type: "image/jpeg" }))).status, 400);
  assert.equal((await upload(seller.cookie, new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" }))).status, 400);
  const listing = await prisma.product.create({ data: { ownerId: seller.user.id, item: "HTTP ownership fixture", description: "Upload ownership test", category: "Other", price: 1, location: "Nairobi" } });
  assert.equal((await upload(other.cookie, photo, listing.id)).status, 404);
  const result = await upload(seller.cookie, photo);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  images.push({ ownerId: seller.user.id, imagePublicId: result.data.imagePublicId });
  const body = new FormData();
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === "createListingAction");
  body.set("$ACTION_ID_" + entry[0], "");
  for (const [key, value] of Object.entries({ item: "HTTP uploaded photo", category: "Other", price: "10", quantity: "1", unit: "ITEM", description: "Temporary upload HTTP fixture", country: "KE", location: "Nairobi", photoMode: "replace", uploadReceipt: result.data.receipt })) body.set(key, value);
  const created = await fetch(base + "/listings/new", { method: "POST", headers: { Origin: base, Cookie: seller.cookie }, body, redirect: "manual" });
  assert.equal(created.headers.get("location"), "/listings?created=1");
  const saved = await prisma.product.findFirstOrThrow({ where: { ownerId: seller.user.id, imagePublicId: result.data.imagePublicId } });
  assert.equal(saved.imageUrl, result.data.imageUrl);
  const html = await (await fetch(base + `/market/${saved.id}`)).text();
  assert.ok(html.includes("HTTP uploaded photo"));
  noCredentials(html);
  scan(fileURLToPath(new URL("../.next/static", import.meta.url)));
  console.log("PASS LIVE HTTP: unauthenticated/cross-origin/cross-owner rejection, MIME/content/size limits, real Cloudinary upload, receipt-backed persistence, public rendering and credential-free browser bundles/responses.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  for (const image of images) await cleanupProductPhoto(image);
  await prisma.$disconnect();
  Module._load = load;
}
