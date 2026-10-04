import type { DealStatus, ListingUnit } from "@prisma/client";
import { formatAgreedPrice } from "@/lib/deal-pricing";
import { quantityLabel } from "@/lib/units";

type TimelineDeal = { status: DealStatus; quantity: { toString(): string } | null; unit: ListingUnit | null; agreedPrice: { toString(): string } | null; currency: string | null; createdAt: Date; buyerConfirmedAt: Date | null; sellerConfirmedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null; disputedAt: Date | null };

function eventDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function DealTimeline({ deal }: { deal: TimelineDeal }) {
  const terms = deal.quantity && deal.unit ? quantityLabel(deal.quantity, deal.unit) : "Quantity not recorded";
  const price = deal.agreedPrice && deal.currency ? formatAgreedPrice(deal.agreedPrice, deal.currency) : "price not recorded";
  const events = [
    { label: `Deal proposed: ${terms} · ${price} agreed`, at: deal.createdAt },
    ...(deal.buyerConfirmedAt ? [{ label: "Buyer confirmed", at: deal.buyerConfirmedAt }] : []),
    ...(deal.sellerConfirmedAt ? [{ label: "Seller confirmed", at: deal.sellerConfirmedAt }] : []),
    ...(deal.completedAt ? [{ label: "Deal completed", at: deal.completedAt }] : []),
    ...(deal.cancelledAt ? [{ label: "Deal cancelled", at: deal.cancelledAt }] : []),
    ...(deal.disputedAt ? [{ label: "Deal disputed", at: deal.disputedAt }] : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return <section aria-label="Deal timeline" className="border-y border-[#eadfdf] py-4"><p className="text-xs font-bold uppercase text-[#47715f]">Deal timeline</p><ol className="mt-3 grid gap-3">{events.map((event, index) => <li key={`${event.label}-${index}`} className="flex items-start justify-between gap-4 text-sm"><span className="font-semibold">{event.label}</span><time className="shrink-0 text-xs text-[#6f626b]" dateTime={event.at.toISOString()}>{eventDate(event.at)}</time></li>)}</ol></section>;
}
