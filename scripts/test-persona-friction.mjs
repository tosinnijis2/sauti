import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);

const { dealsAwaitingConfirmationWhere } = require("../src/lib/deals.ts");
const root = new URL("..", import.meta.url);
const source = path => readFileSync(new URL(path, root), "utf8");

const userId = "persona-user";
assert.deepEqual(dealsAwaitingConfirmationWhere(userId), {
  OR: [
    { buyerId: userId, status: { in: ["PENDING", "SELLER_CONFIRMED"] } },
    { sellerId: userId, status: { in: ["PENDING", "BUYER_CONFIRMED"] } },
  ],
});

const dealsPage = source("src/app/deals/page.tsx");
assert.match(dealsPage, /params\.focus === "waiting"/);
assert.match(dealsPage, /dealsAwaitingConfirmationWhere\(user\.id\)/);
assert.match(dealsPage, /Nothing is waiting for you/);

const conversation = source("src/app/messages/[id]/page.tsx");
assert.ok(conversation.indexOf("<ChatPanel") < conversation.indexOf("<DealControls"), "messaging should remain ahead of deal administration");
assert.match(source("src/components/chat-panel.tsx"), /sticky bottom-20/);
assert.match(source("src/components/deal-controls.tsx"), /Cancel or dispute this deal/);

const listingForm = source("src/components/listing-form.tsx");
for (const heading of ["Listing basics", "Availability", "Asking price and details"]) assert.match(listingForm, new RegExp(heading));
assert.match(listingForm, /asking price applies to the full quantity/i);

const product = source("src/app/market/[id]/page.tsx");
assert.match(product, /w-full items-center justify-center/);
assert.match(product, /sticky bottom-20[\s\S]*?\{journeyAction\}<\/div>[\s\S]*?FavoriteButton/);
assert.match(source("src/app/notifications/page.tsx"), /Browse marketplace/);

console.log("PASS PERSONA FRICTION: actionable deal filtering, messaging-first conversations, safer deal actions, clearer listing sections, mobile primary actions, and useful empty-state exits.");
