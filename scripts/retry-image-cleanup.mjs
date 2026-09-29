import { createRequire, Module } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { cleanupProductPhoto, ownsImageId } = require("../src/lib/cloudinary.ts");
const [ownerId, imagePublicId] = process.argv.slice(2);
try {
  if (!ownerId || !imagePublicId || !ownsImageId(imagePublicId, ownerId)) throw new Error("Provide the owner ID and its exact Sauti product image public ID from the cleanup log.");
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId} FOR UPDATE`;
    if (await tx.product.count({ where: { imagePublicId } })) throw new Error("Image is still referenced by a listing. No cleanup attempted.");
    await cleanupProductPhoto({ ownerId, imagePublicId });
  }, { timeout: 100000 });
  console.log("Cleanup attempted; any failure requiring another retry is logged above.");
} finally { await prisma.$disconnect(); Module._load = load; }
