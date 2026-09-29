import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

process.loadEnvFile();
const base = process.env.TEST_APP_URL || "http://localhost:3101";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 1000 }) });
const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8"));
const users = [];
const password = "Favorites-test-password-123";
async function account(name) {
  const user = await prisma.user.create({ data: { name, email: `favorite-${randomUUID()}@example.invalid`, passwordHash: await bcrypt.hash(password, 4) } });
  users.push(user);
  const token = await new SignJWT({ version: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setExpirationTime("20m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return { ...user, cookie: `sauti_session=${token}` };
}
async function action(name, values, cookie = "", origin = base, route = "/market") {
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
  assert.ok(entry, `Missing action ${name}`);
  const body = new FormData();
  body.set("$ACTION_ID_" + entry[0], "");
  Object.entries(values).forEach(([key, value]) => body.set(key, value));
  const response = await fetch(base + route, { method: "POST", headers: { Origin: origin, Cookie: cookie }, body, redirect: "manual" });
  await response.text();
  return response;
}
async function html(route, cookie) { return (await fetch(base + route, { headers: { Cookie: cookie || "" } })).text(); }
try {
  const owner = await account("Favorites seller");
  const buyer = await account("Favorites buyer");
  const other = await account("Favorites other");
  const product = await prisma.product.create({ data: { ownerId: owner.id, item: "Favorite fixture " + randomUUID(), description: "Temporary favorite test", category: "Other", price: 10, location: "Nairobi", country: "KE" } });
  const second = await prisma.product.create({ data: { ownerId: owner.id, item: "Second favorite " + randomUUID(), description: "Temporary second test", category: "Other", price: 20, location: "Nairobi", country: "KE" } });
  const savedRoute = await fetch(base + "/saved", { redirect: "manual" });
  assert.ok([200, 307].includes(savedRoute.status));
  assert.match(savedRoute.headers.get("location") || await savedRoute.text(), /next=%2Fsaved/);
  assert.ok((await html(`/market/${product.id}`)).includes("Sign in to save"));
  await action("saveFavorite", { productId: product.id });
  assert.equal(await prisma.favorite.count({ where: { productId: product.id } }), 0);
  await action("saveFavorite", { productId: product.id, userId: other.id }, buyer.cookie);
  assert.equal(await prisma.favorite.count({ where: { userId: buyer.id, productId: product.id } }), 1);
  assert.equal(await prisma.favorite.count({ where: { userId: other.id } }), 0);
  await Promise.all(Array.from({ length: 5 }, () => action("saveFavorite", { productId: product.id }, buyer.cookie)));
  assert.equal(await prisma.favorite.count({ where: { userId: buyer.id, productId: product.id } }), 1);
  await action("removeFavorite", { productId: product.id, userId: buyer.id }, other.cookie);
  assert.equal(await prisma.favorite.count({ where: { userId: buyer.id, productId: product.id } }), 1);
  await action("saveFavorite", { productId: second.id }, other.cookie);
  const mine = await html("/saved", buyer.cookie);
  assert.ok(mine.includes(product.item));
  assert.ok(!mine.includes(second.item));
  const theirs = await html("/saved", other.cookie);
  assert.ok(theirs.includes(second.item));
  assert.ok(!theirs.includes(product.item));
  for (const route of [`/market?q=${encodeURIComponent(product.item)}`, `/market/${product.id}`, `/sellers/${owner.id}`]) {
    assert.ok((await html(route, buyer.cookie)).includes(`aria-label="Remove saved listing: ${product.item}"`), `Saved state on ${route}`);
    assert.ok((await html(route, other.cookie)).includes(`aria-label="Save listing: ${product.item}"`), `Other user's state on ${route}`);
  }
  await action("saveFavorite", { productId: product.id }, owner.cookie);
  assert.equal(await prisma.favorite.count({ where: { userId: owner.id } }), 0);
  const before = await prisma.favorite.count();
  await action("saveFavorite", { productId: randomUUID() }, buyer.cookie);
  await action("saveFavorite", { productId: "bad/id" }, buyer.cookie);
  await action("saveFavorite", { productId: second.id }, buyer.cookie, "https://untrusted.invalid");
  assert.equal(await prisma.favorite.count(), before);
  await action("removeFavorite", { productId: product.id }, buyer.cookie);
  await action("removeFavorite", { productId: product.id }, buyer.cookie);
  assert.equal(await prisma.favorite.count({ where: { userId: buyer.id } }), 0);
  assert.ok((await html("/saved", buyer.cookie)).includes("saved anything yet"));
  const login = await action("loginAction", { email: buyer.email, password, next: `/market/${product.id}` }, "", base, "/login");
  assert.equal(login.headers.get("location"), `/market/${product.id}`);
  const external = await action("loginAction", { email: buyer.email, password, next: "//evil.invalid" }, "", base, "/login");
  assert.equal(external.headers.get("location"), "/dashboard");
  await action("saveFavorite", { productId: product.id }, buyer.cookie);
  await prisma.product.delete({ where: { id: product.id } });
  assert.equal(await prisma.favorite.count({ where: { productId: product.id } }), 0);
  assert.ok(!(await html("/saved", buyer.cookie)).includes(product.item));
  await prisma.user.delete({ where: { id: other.id } });
  assert.equal(await prisma.favorite.count({ where: { userId: other.id } }), 0);
  console.log("PASS FAVORITES: persistent save/remove, concurrent duplicates, session-owned mutations, private saved pages, rendered saved state, deleted user/product cascades, unauthenticated/invalid/cross-origin requests and safe login return.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
}
