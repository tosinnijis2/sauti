import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { priceWatchRunHealth } from "@/lib/admin/price-watch-runs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const operations = await priceWatchRunHealth();

    return NextResponse.json({
      ok: true,
      service: "sauti",
      version: "2.0",
      ready: !operations.stale && operations.cleanupFailures === 0,
    });
  } catch {
    console.error("[sauti:health-check-failed]", JSON.stringify({ timestamp: new Date().toISOString() }));

    return NextResponse.json(
      { ok: false, ready: false, service: "sauti", version: "2.0" },
      { status: 503 }
    );
  }
}
