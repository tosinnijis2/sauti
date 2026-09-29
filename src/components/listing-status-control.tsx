"use client";
import { useId, useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { updateListingStatusAction } from "@/app/actions/listings";
import { STATUS_VALUES, STATUS_LABELS, type Status } from "@/lib/units";

export function ListingStatusControl({ productId, status }: { productId: string; status: Status }) {
  const selectId = useId();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="mt-4" action={form => { setError(""); startTransition(async () => { try { const result = await updateListingStatusAction(form); if (result?.error) setError(result.error); } catch { setError("Could not update the listing status. Please try again."); } }); }}>
    <input type="hidden" name="productId" value={productId} />
    <label htmlFor={selectId} className="text-xs font-semibold">Listing status</label><div className="mt-2 flex gap-2"><select id={selectId} name="status" defaultValue={status} key={status} disabled={pending} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#ded5da] bg-white px-2 text-sm">{STATUS_VALUES.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select><button disabled={pending} title="Update listing status" aria-label="Update listing status" className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#ded5da] hover:bg-[#fff0ef] disabled:opacity-50">{pending ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />}</button></div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </form>;
}
