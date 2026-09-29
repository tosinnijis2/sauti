import type { DealStatus } from "@prisma/client";
import { createDealAction, dealAction } from "@/app/actions/deals";
import { dealStatusLabel } from "@/lib/deals";

type Deal = { id: string; status: DealStatus; buyerId: string; sellerId: string; conversationId: string };

export function DealControls({ conversationId, viewerId, sellerId, blocked, productActive, deal }: { conversationId: string; viewerId: string; sellerId: string; blocked: boolean; productActive: boolean; deal: Deal | null }) {
  if (!deal) return viewerId === sellerId && productActive && !blocked ? <form action={createDealAction}><input type="hidden" name="conversationId" value={conversationId} /><button className="rounded-lg bg-[#20141d] px-4 py-3 text-sm font-bold text-white">Start deal</button></form> : null;
  const active = ["PENDING", "BUYER_CONFIRMED", "SELLER_CONFIRMED"].includes(deal.status);
  const alreadyConfirmed = (viewerId === deal.buyerId && deal.status === "BUYER_CONFIRMED") || (viewerId === deal.sellerId && deal.status === "SELLER_CONFIRMED");
  return <section aria-label="Deal status" className="rounded-lg border border-[#eadfdf] bg-white p-4"><p className="text-xs font-bold uppercase text-[#47715f]">Deal</p><p className="mt-2 font-semibold">{dealStatusLabel(deal.status, viewerId, deal.buyerId, deal.sellerId)}</p>{active && <form action={dealAction} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="dealId" value={deal.id} /><input type="hidden" name="conversationId" value={conversationId} />{!alreadyConfirmed && <button name="action" value="confirm" className="rounded-lg bg-[#20141d] px-3 py-2 text-sm font-bold text-white">Confirm deal</button>}<button name="action" value="cancel" className="rounded-lg border border-[#d9cccc] px-3 py-2 text-sm font-bold">Cancel</button><input name="reason" maxLength={200} placeholder="Dispute reason (optional)" className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d9cccc] px-3 text-sm" /><button name="action" value="dispute" className="rounded-lg border border-[#9d334b] px-3 py-2 text-sm font-bold text-[#9d334b]">Dispute</button></form>}</section>;
}
