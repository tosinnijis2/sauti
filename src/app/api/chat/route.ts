import { getCurrentUser } from "@/lib/auth";
import { ChatError, sendChat, visibleMessages } from "@/lib/chat";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const q = request.nextUrl.searchParams;
  try {
    const messages = await visibleMessages(user.id, { conversationId: q.get("conversationId") || undefined, country: q.get("country") || undefined }, q.get("before") || undefined);
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Conversation not found." }, { status: 404 }); }
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const data = await request.json();
    if (!data || typeof data.body !== "string" || (data.conversationId !== undefined && typeof data.conversationId !== "string") || (data.country !== undefined && typeof data.country !== "string")) throw new ChatError("Invalid message.");
    await sendChat(user.id, { conversationId: data.conversationId, country: data.country }, data.body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (!(e instanceof ChatError)) console.error("Chat send failed", e);
    return NextResponse.json({ error: e instanceof ChatError ? e.message : "Could not send message." }, { status: e instanceof ChatError ? 400 : 500 });
  }
}
