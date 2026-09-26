import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, service: "sauti", version: "2.0" });
}
