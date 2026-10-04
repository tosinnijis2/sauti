export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertProductionEnvironment } = await import("./lib/env");
  assertProductionEnvironment();
}
