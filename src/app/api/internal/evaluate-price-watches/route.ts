import { timingSafeEqual } from "node:crypto";
import { runPriceWatchEvaluation } from "@/lib/price-watch-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) return Response.json({ error: "Scheduler endpoint is not configured." }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const result = await runPriceWatchEvaluation({ source: "SCHEDULED" });
  return Response.json({ runId: result.runId, status: result.status, acquired: result.acquired, summary: result.summary }, { status: result.status === "FAILED" ? 500 : 200 });
}
