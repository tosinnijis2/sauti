import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { markConversationRead, messagePage, sendChat, startConversation, unreadConversationCount } = require("../src/lib/chat.ts");
const marker = `Messaging-${randomUUID()}`;
const users = [];

try {
  for (const role of ["Seller", "Buyer", "Outsider"]) users.push(await prisma.user.create({ data: { name: `${marker} ${role}`, email: `${marker}-${role}@example.invalid`, passwordHash: "disabled", country: "KE" } }));
  const [seller, buyer, outsider] = users;
  const product = await prisma.product.create({ data: { item: `${marker} maize`, category: "Cereals", price: "30", quantity: "10", originalQuantity: "10", remainingQuantity: "10", unit: "KG", status: "ACTIVE", location: "Nairobi", country: "KE", description: marker, ownerId: seller.id } });
  const conversation = await startConversation(product.id, buyer.id);
  const requestId = randomUUID();
  const first = await sendChat(buyer.id, { conversationId: conversation.id }, "Is this still available?", requestId);
  assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).sellerUnreadCount, 1, "only recipient unread count increments");
  assert.equal(await unreadConversationCount(seller.id), 1);
  assert.equal(await unreadConversationCount(buyer.id), 0, "sender does not become unread");
  assert.equal(await prisma.notification.count({ where: { userId: buyer.id, type: "PRIVATE_MESSAGE" } }), 0, "sender receives no notification");
  assert.equal(await prisma.notification.count({ where: { userId: seller.id, conversationId: conversation.id, readAt: null } }), 1, "recipient receives one private notification");

  const duplicate = await sendChat(buyer.id, { conversationId: conversation.id }, "Is this still available?", requestId);
  assert.equal(duplicate.id, first.id, "same client request is idempotent");
  assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).sellerUnreadCount, 1, "duplicate does not increment unread state");
  await prisma.message.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 5000) } });
  const second = await sendChat(buyer.id, { conversationId: conversation.id }, "I can collect today.", randomUUID());
  assert.equal(await prisma.notification.count({ where: { userId: seller.id, conversationId: conversation.id, readAt: null } }), 1, "unread message notifications consolidate");
  assert.match((await prisma.notification.findFirstOrThrow({ where: { userId: seller.id, conversationId: conversation.id, readAt: null } })).title, /^2 new messages/);

  await assert.rejects(markConversationRead(conversation.id, outsider.id), /not found/i, "unrelated user cannot mark read");
  await markConversationRead(conversation.id, seller.id);
  const read = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
  assert.equal(read.sellerUnreadCount, 0); assert.ok(read.sellerLastReadAt); assert.equal(read.buyerUnreadCount, 0);
  assert.equal(await prisma.notification.count({ where: { userId: seller.id, conversationId: conversation.id, readAt: null } }), 0, "opening marks matching notifications read");

  await sendChat(seller.id, { conversationId: conversation.id }, "Yes, it is available.", randomUUID());
  const afterReply = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
  assert.equal(afterReply.buyerUnreadCount, 1); assert.equal(afterReply.sellerUnreadCount, 0, "read state remains participant-specific");

  const history = Array.from({ length: 105 }, (_, index) => ({ authorId: index % 2 ? buyer.id : seller.id, conversationId: conversation.id, body: `History ${String(index).padStart(3, "0")}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)) }));
  await prisma.message.createMany({ data: history });
  const page1 = await messagePage(buyer.id, { conversationId: conversation.id });
  const page2 = await messagePage(buyer.id, { conversationId: conversation.id }, page1.nextCursor);
  const page3 = await messagePage(buyer.id, { conversationId: conversation.id }, page2.nextCursor);
  assert.equal(page1.messages.length, 50); assert.equal(page2.messages.length, 50); assert.ok(page3.messages.length >= 5);
  const ids = [...page1.messages, ...page2.messages, ...page3.messages].map(message => message.id);
  assert.equal(new Set(ids).size, ids.length, "cursor pages do not overlap");
  for (const page of [page1, page2, page3]) assert.deepEqual([...page.messages].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)).map(m => m.id), page.messages.map(m => m.id), "each page is chronological");

  const olderProduct = await prisma.product.create({ data: { item: `${marker} older`, category: "Cereals", price: "20", location: "Nairobi", description: marker, ownerId: seller.id } });
  const olderConversation = await startConversation(olderProduct.id, outsider.id);
  await prisma.conversation.update({ where: { id: olderConversation.id }, data: { updatedAt: new Date(0) } });
  const ordered = await prisma.conversation.findMany({ where: { OR: [{ buyerId: seller.id }, { sellerId: seller.id }] }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] });
  assert.equal(ordered[0].id, conversation.id, "inbox ordering follows newest activity");

  await prisma.product.update({ where: { id: product.id }, data: { status: "SOLD" } });
  assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id }, include: { product: true } })).product.status, "SOLD", "sold listing retains conversation context");
  await prisma.product.update({ where: { id: product.id }, data: { status: "INACTIVE" } });
  assert.equal((await messagePage(buyer.id, { conversationId: conversation.id })).messages.length, 50, "inactive listing retains message history");

  const chatSource = readFileSync("src/components/chat-panel.tsx", "utf8");
  const inboxSource = readFileSync("src/app/messages/page.tsx", "utf8");
  const threadSource = readFileSync("src/app/messages/[id]/page.tsx", "utf8");
  assert.match(chatSource, /disabled=\{pending \|\| !body\.trim\(\)\}/, "composer disables duplicate submit");
  assert.match(chatSource, /if \(!response\.ok\) throw new Error\(result\.error\);\s*setBody\(""\);[\s\S]*?catch \(e\)/, "draft clears only after a successful response and remains on failure");
  assert.match(inboxSource, /buyerUnreadCount|sellerUnreadCount/); assert.match(inboxSource, /Active deals/); assert.match(inboxSource, /Completed deals/);
  assert.match(threadSource, /DealTimeline/); assert.match(threadSource, /remainingQuantity/); assert.match(threadSource, /This listing is no longer available/);
  assert.ok(second.id);
  console.log("PASS MESSAGING QUALITY: participant unread state, badges/counts, authorized read marking, consolidated notifications, idempotent sends, cursor pagination, inbox ordering/filter hooks, listing retention, and conversation/deal UX wiring.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect(); Module._load = load;
}
