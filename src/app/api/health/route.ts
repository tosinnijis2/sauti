import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "sauti",
      version: "2.0",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed", error);

    return NextResponse.json(
      { ok: false, service: "sauti", version: "2.0", database: "unavailable" },
      { status: 503 }
    );
  }
}
