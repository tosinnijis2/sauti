import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { newAnonymousViewerId, recordListingView } from "@/lib/listing-analytics";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const user = await getCurrentUser();
  const response = NextResponse.json({ ok: true });
  let anonymousId = _.headers.get("cookie")?.match(/(?:^|; )sauti_viewer=([^;]+)/)?.[1];
  if (!anonymousId) { anonymousId = newAnonymousViewerId(); response.cookies.set("sauti_viewer", anonymousId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" }); }
  await recordListingView(id, user?.id ?? null, anonymousId);
  return response;
}
