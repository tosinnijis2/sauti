import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

process.loadEnvFile();
const require = createRequire(import.meta.url);
const load = Module._load;
Module._load = function (name, parent, isMain) { return name === "server-only" ? {} : load.call(this, name, parent, isMain); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { prisma } = require("../src/lib/prisma.ts");
const { runPriceWatchEvaluation } = require("../src/lib/price-watch-runs.ts");

try {
  const result = await runPriceWatchEvaluation({ source: "MANUAL" });
  console.log(result.acquired ? "Price watch evaluation complete." : "Price watch evaluation skipped: another run holds the database lease.");
  console.log(`runId: ${result.runId}`);
  console.log(`status: ${result.status}`);
  if (result.summary) for (const key of ["scanned", "evaluated", "insufficient", "triggered", "suppressed", "errors"]) console.log(`${key}: ${result.summary[key]}`);
  if (["FAILED", "PARTIAL"].includes(result.status)) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  Module._load = load;
}
