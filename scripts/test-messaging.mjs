import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import bcrypt from "bcryptjs";

process.loadEnvFile();
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => {
  const result = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};
const { prisma } = require("../src/lib/prisma.ts");
const { startConversation, sendChat, visibleMessages } = require("../src/lib/chat.ts");
const { issueReset, redeemReset, tokenDigest } = require("../src/lib/recovery.ts");
const ids = [];
try {
  for (const name of ["Seller", "Buyer", "Outsider"]) {
    const user = await prisma.user.create({ data: { name, email: `test-${randomUUID()}@example.invalid`, passwordHash: "test-only", country: "KE" } });
    ids.push(user.id);
  }
  const [seller, buyer, outsider] = ids;
  const product = await prisma.product.create({ data: { item: "Test produce", category: "Produce", price: 12, location: "Nairobi", country: "KE", description: "Integration test", ownerId: seller } });
  const conversation = await startConversation(product.id, buyer);
  assert.equal((await startConversation(product.id, buyer)).id, conversation.id);
  await assert.rejects(startConversation(product.id, seller));
  await assert.rejects(visibleMessages(outsider, { conversationId: conversation.id }));
  await assert.rejects(sendChat(outsider, { conversationId: conversation.id }, "Unauthorized"));
  await sendChat(buyer, { conversationId: conversation.id }, "Is this available?");
  assert.equal((await visibleMessages(seller, { conversationId: conversation.id })).length, 1);
  await assert.rejects(sendChat(buyer, { country: "KE" }, "Too soon"));
  await sendChat(seller, { country: "KE" }, "Country room test");
  assert.ok((await visibleMessages(buyer, { country: "KE" })).some(m => m.authorId === seller));
  assert.ok(!(await visibleMessages(buyer, { country: "UG" })).some(m => m.authorId === seller));
  await prisma.userBlock.create({ data: { blockerId: seller, blockedId: buyer } });
  await assert.rejects(sendChat(buyer, { conversationId: conversation.id }, "Blocked"));
  assert.equal((await visibleMessages(seller, { conversationId: conversation.id })).length, 1, "blocking preserves authorized private conversation history");
  await prisma.product.delete({ where: { id: product.id } });
  assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).productId, null);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: buyer } });
  const token = await issueReset(user.email);
  assert.ok(token);
  assert.equal(await issueReset(user.email), null);
  assert.equal((await prisma.passwordReset.findUniqueOrThrow({ where: { tokenHash: tokenDigest(token) } })).userId, buyer);
  const results = await Promise.all([redeemReset(token, "New-password-123"), redeemReset(token, "New-password-123")]);
  assert.equal(results.filter(Boolean).length, 1);
  const changed = await prisma.user.findUniqueOrThrow({ where: { id: buyer } });
  assert.equal(changed.sessionVersion, 1);
  assert.ok(await bcrypt.compare("New-password-123", changed.passwordHash));
  assert.equal(await redeemReset(token, "New-password-123"), false);
  const expired = await issueReset(user.email);
  await prisma.passwordReset.update({ where: { tokenHash: tokenDigest(expired) }, data: { expiresAt: new Date(0) } });
  assert.equal(await redeemReset(expired, "New-password-123"), false);
  console.log("PASS: private membership, deduplication, country isolation, cooldown, blocking, deleted listings, reset expiry, concurrent single-use redemption, password hashing and session invalidation.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}
