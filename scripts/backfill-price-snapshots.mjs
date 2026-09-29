import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

process.loadEnvFile();
const args = new Set(process.argv.slice(2));
if ([...args].some(value => value !== "--dry-run")) throw new Error("Supported option: --dry-run");
const dryRun = args.has("--dry-run");
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { repairCurrentPriceSnapshots } = require("../src/lib/admin/history.ts");

try {
  const summary = await repairCurrentPriceSnapshots({ dryRun });
  console.log(dryRun ? "Price snapshot repair dry run (no writes)." : "Price snapshot repair complete.");
  for (const key of ["scanned", "eligible", "alreadyCurrent", "missingSnapshot", "staleSnapshot", "created", "skipped", "errors"]) console.log(`${key}: ${summary[key]}`);
  if (summary.errors) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  Module._load = load;
}
