import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";

process.loadEnvFile();
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }) });
const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8"));
const emails = [];

async function action(path, name, values, cookie = "") {
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
  assert.ok(entry, `Missing action ${name}`);
  const body = new FormData(); body.set(`$ACTION_ID_${entry[0]}`, "");
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return fetch(base + path, { method: "POST", headers: { Origin: base, Cookie: cookie }, body, redirect: "manual" });
}
function details(email, extra = {}) {
  return { name: "Nia Market", email, phone: randomUUID().replaceAll("-", "").slice(0, 20), password: "Sauti-avatar-test-123", confirmPassword: "Sauti-avatar-test-123", location: "Nairobi", country: "KE", ...extra };
}
async function exists(publicId) {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image/upload/${encodeURIComponent(publicId)}`, { headers: { Authorization: `Basic ${Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64")}` } });
  return response.ok;
}

try {
  const jpeg = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#fe7a7c" } }).jpeg().toBuffer();
  const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#20141d" } }).png().toBuffer();
  const withPhoto = `profile-${randomUUID()}@example.invalid`; emails.push(withPhoto);
  const registered = await action("/register", "registerAction", details(withPhoto, { profilePhoto: new File([jpeg], "avatar.jpg", { type: "image/jpeg" }) }));
  assert.equal(registered.status, 303); assert.ok(registered.headers.get("location").startsWith("/login?registered=1"));
  let user = await prisma.user.findUniqueOrThrow({ where: { email: withPhoto } });
  assert.ok(user.imageUrl && user.imagePublicId && await exists(user.imagePublicId));

  const noPhoto = `profile-${randomUUID()}@example.invalid`; emails.push(noPhoto);
  assert.equal((await action("/register", "registerAction", details(noPhoto, { name: "Fallback Person" }))).status, 303);
  const fallback = await prisma.user.findUniqueOrThrow({ where: { email: noPhoto } }); assert.equal(fallback.imageUrl, null); assert.equal(fallback.imagePublicId, null);

  for (const [label, file] of [["invalid", new File(["not an image"], "bad.jpg", { type: "image/jpeg" })], ["oversized", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })]]) {
    const email = `profile-${randomUUID()}@example.invalid`; emails.push(email);
    const response = await action("/register", "registerAction", details(email, { profilePhoto: file }));
    assert.equal(response.status, 303, label); assert.ok(response.headers.get("location").startsWith("/register?error="), label); assert.equal(await prisma.user.findUnique({ where: { email } }), null, label);
  }

  const login = await action("/login", "loginAction", { email: withPhoto, password: "Sauti-avatar-test-123" });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const oldId = user.imagePublicId;
  const replacement = await action("/profile", "updateProfileAction", { country: user.country, name: user.name, email: user.email, phone: user.phone, location: user.location, photoMode: "replace", profilePhoto: new File([png], "replacement.png", { type: "image/png" }) }, cookie);
  assert.equal(replacement.headers.get("location"), "/profile?updated=1");
  user = await prisma.user.findUniqueOrThrow({ where: { id: user.id } }); assert.notEqual(user.imagePublicId, oldId); assert.ok(await exists(user.imagePublicId)); assert.equal(await exists(oldId), false);

  const stranger = await prisma.user.create({ data: { name: "Stranger", email: `profile-${randomUUID()}@example.invalid`, passwordHash: "disabled" } }); emails.push(stranger.email);
  const currentId = user.imagePublicId;
  await action("/profile", "updateProfileAction", { country: user.country, name: user.name, email: user.email, phone: user.phone, location: user.location, photoMode: "keep", imagePublicId: stranger.id }, cookie);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).imagePublicId, currentId, "client public IDs must be ignored");

  const pages = ["/dashboard", "/profile", `/sellers/${user.id}`];
  for (const path of pages) { const html = await (await fetch(base + path, { headers: { Cookie: cookie } })).text(); assert.ok(html.includes(user.imageUrl), `${path} should render avatar`); }
  const fallbackLogin = await action("/login", "loginAction", { email: noPhoto, password: "Sauti-avatar-test-123" });
  const fallbackHtml = await (await fetch(base + "/dashboard", { headers: { Cookie: fallbackLogin.headers.get("set-cookie").split(";")[0] } })).text(); assert.ok(fallbackHtml.includes("FP"), "existing users without photos retain initials fallback");

  await action("/profile", "updateProfileAction", { country: user.country, name: user.name, email: user.email, phone: user.phone, location: user.location, photoMode: "remove" }, cookie);
  user = await prisma.user.findUniqueOrThrow({ where: { id: user.id } }); assert.equal(user.imageUrl, null); assert.equal(user.imagePublicId, null); assert.equal(await exists(currentId), false);
  console.log("PASS PROFILE IMAGES: optional signup, validation, replacement/removal, provider cleanup, ownership, fallback initials, avatar rendering, and unchanged login behavior.");
} finally {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, imagePublicId: true } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
}
