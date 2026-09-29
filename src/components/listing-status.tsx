import { STATUS_LABELS, type Status } from "@/lib/units";

export function ListingStatusBadge({ status }: { status: Status }) {
  const colors = { ACTIVE: "bg-[#e6f1e9] text-[#24583c]", RESERVED: "bg-[#fff0cf] text-[#755300]", SOLD: "bg-[#fbe5eb] text-[#872d48]", INACTIVE: "bg-[#efebed] text-[#60535c]" };
  return <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${colors[status]}`}>{STATUS_LABELS[status]}</span>;
}
