import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";
import { SignJWT } from "jose";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { dashboardData } = require("../src/lib/dashboard.ts");
const users = [];
const base = process.env.TEST_APP_URL || "http://localhost:3101";
async function user(name, country = "KE") {
  const value = await prisma.user.create({ data: { name, email: `dashboard-${randomUUID()}@example.invalid`, country, passwordHash: "disabled-test-account" } });
  users.push(value);
  return value;
}
async function html(user) {
  const token = await new SignJWT({ version: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return (await fetch(base + "/dashboard", { headers: { Cookie: `sauti_session=${token}` } })).text();
}
try {
  const established = await user("Established Tester");
  const seller = await user("Blocked Seller");
  const favoriteOnly = await user("Collector Tester");
  const freshUser = await user("New Tester", null);
  const marker = randomUUID();
  const product = ownerId => ({ ownerId, item: `Dashboard fixture ${randomUUID()}`, category: "Other", price: 12, description: "Temporary dashboard fixture", location: "Nairobi", country: "KE" });
  await prisma.product.createMany({ data: Array.from({ length: 4 }, () => product(established.id)) });
  await prisma.product.createMany({ data: Array.from({ length: 4 }, () => product(seller.id)) });
  const stock = await prisma.product.findMany({ where: { ownerId: seller.id } });
  await prisma.favorite.createMany({ data: stock.map(p => ({ userId: established.id, productId: p.id })) });
  await prisma.favorite.create({ data: { userId: favoriteOnly.id, productId: stock[0].id } });
  const conversation = await prisma.conversation.create({ data: { buyerId: established.id, sellerId: seller.id, productId: stock[0].id, productName: stock[0].item } });
  const privateConversation = await prisma.conversation.create({ data: { buyerId: favoriteOnly.id, sellerId: seller.id, productId: stock[1].id, productName: "Private conversation " + marker } });
  await prisma.message.createMany({ data: [
    { authorId: established.id, conversationId: conversation.id, body: "Visible message " + marker, createdAt: new Date(Date.now() - 1000) },
    { authorId: seller.id, conversationId: conversation.id, body: "Blocked message " + marker },
    { authorId: established.id, conversationId: conversation.id, body: "Hidden message " + marker, hidden: true },
    { authorId: seller.id, country: "KE", body: "Blocked room " + marker },
    { authorId: favoriteOnly.id, country: "KE", body: "Visible room " + marker },
    { authorId: favoriteOnly.id, country: "KE", body: "Hidden room " + marker, hidden: true },
    { authorId: favoriteOnly.id, country: "UG", body: "Other country " + marker },
    { authorId: favoriteOnly.id, country: "KE", conversationId: privateConversation.id, body: "Private body " + marker },
  ] });
  await prisma.userBlock.create({ data: { blockerId: established.id, blockedId: seller.id } });
  const data = await dashboardData(established.id, "KE");
  assert.equal(data.listingCount, 4);
  assert.equal(data.savedCount, 4);
  assert.equal(data.conversationCount, 1);
  assert.equal(data.listings.length, 3);
  assert.equal(data.favorites.length, 3);
  assert.equal(data.fresh.length, 3);
  assert.ok(data.listings.every(p => p.ownerId === established.id));
  assert.ok(data.fresh.every(p => p.ownerId !== established.id));
  assert.ok(data.fresh.every(p => data.saved.has(p.id)));
  assert.equal(data.conversations.length, 1);
  assert.equal(data.conversations[0].messages[0].body, "Visible message " + marker);
  assert.ok(data.community.some(message => message.body === "Visible room " + marker));
  const page = await html(established);
  assert.ok(page.includes("Welcome back"));
  assert.ok(page.includes("Saved for Later"));
  assert.ok(page.includes("Fresh on Sauti"));
  assert.ok(page.includes("Visible message " + marker));
  for (const prefix of ["Blocked message", "Hidden message", "Blocked room", "Hidden room", "Other country", "Private body", "Private conversation"]) assert.ok(!page.includes(prefix + " " + marker), `Do not leak ${prefix}`);
  for (const privateValue of [established.email, seller.email, "disabled-test-account"]) assert.ok(!page.includes(privateValue));
  // Remove only this fixture's conversation to verify a favorites-only account.
  await prisma.conversation.delete({ where: { id: privateConversation.id } });
  const collector = await dashboardData(favoriteOnly.id, "KE");
  assert.equal(collector.listingCount, 0);
  assert.equal(collector.savedCount, 1);
  assert.equal(collector.conversationCount, 0);
  const collectorPage = await html(favoriteOnly);
  assert.ok(collectorPage.includes("Saved for Later"));
  assert.ok(collectorPage.includes("haven&#x27;t listed anything yet") || collectorPage.includes("haven't listed anything yet"));
  const empty = await dashboardData(freshUser.id, null);
  assert.equal(empty.listingCount + empty.savedCount + empty.conversationCount, 0);
  assert.equal(empty.community.length, 0);
  const emptyPage = await html(freshUser);
  assert.ok(emptyPage.includes("Welcome to Sauti"));
  assert.ok(emptyPage.includes("Fresh on Sauti"));
  assert.ok(!emptyPage.includes('aria-label="Your activity"'));
  assert.ok(!emptyPage.includes("Unread"));
  console.log("PASS DASHBOARD: real bounded counts/selections, owned listings, favorites-only and empty accounts, fresh ownership exclusion, private conversation isolation, hidden/blocked message filtering, country isolation and no unsupported unread metrics.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
  Module._load = load;
}
