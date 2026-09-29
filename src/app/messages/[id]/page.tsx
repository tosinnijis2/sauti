import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChatPanel } from "@/components/chat-panel";
import { requireUser } from "@/lib/auth";
import { canReadConversation, isBlocked } from "@/lib/chat";
import { countryName } from "@/lib/countries";
import { prisma } from "@/lib/prisma";
import { DealControls } from "@/components/deal-controls";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await canReadConversation(id, user.id);
  if (!c) notFound();
  const [blocked, deal] = await Promise.all([isBlocked(c.buyerId, c.sellerId), prisma.deal.findUnique({ where: { conversationId: id } })]);
  return <AppShell><Link href="/messages" className="underline">All conversations</Link><h1 className="mt-6 break-words text-3xl font-bold">{c.productName}</h1><p className="mt-2">{c.buyerId === user.id ? c.seller.name : c.buyer.name} · {countryName(c.product?.country)}</p>{!c.product && <p className="mt-3">This listing is no longer available.</p>}{blocked && <p role="status" className="mt-3">Messaging is blocked between these accounts.</p>}<div className="my-5"><DealControls conversationId={id} viewerId={user.id} sellerId={c.sellerId} blocked={blocked} productActive={c.product?.status === "ACTIVE"} deal={deal} /></div><ChatPanel key={id} userId={user.id} conversationId={id} /></AppShell>;
}
