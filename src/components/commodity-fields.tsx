"use client";
import { useState } from "react";
import { COMMODITIES, COMMODITY_LABELS, COMMODITY_VARIETIES, VARIETY_LABELS, GRADES, GRADE_LABELS, type Commodity, type Variety, type Grade } from "@/lib/commodities";

export type CommodityDefaults = { commodity?: Commodity | null; variety?: Variety | null; grade?: Grade | null };
export function CommodityFields({ defaults }: { defaults?: CommodityDefaults }) {
  const [commodity, setCommodity] = useState<Commodity | "">(defaults?.commodity ?? "");
  const field = "min-w-0 rounded-lg border border-[#eadfdf] bg-white px-3 py-3 text-sm font-normal";
  return <section className="grid min-w-0 gap-4 border-y border-[#eadfdf] py-5" aria-label="Commodity details">
    <h2 className="text-lg font-bold">Commodity details <span className="text-sm font-normal text-[#6f626b]">(optional)</span></h2>
    <label className="grid min-w-0 gap-2 text-sm font-bold">Commodity<select name="commodity" value={commodity} onChange={event => setCommodity(event.target.value as Commodity | "")} className={field}><option value="">Not specified / not applicable</option>{COMMODITIES.map(value => <option key={value} value={value}>{COMMODITY_LABELS[value]}</option>)}</select></label>
    {commodity && <div key={commodity} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="grid min-w-0 gap-2 text-sm font-bold">Variety<select name="variety" defaultValue={commodity === defaults?.commodity ? defaults.variety ?? "" : ""} className={field}><option value="">Unspecified</option>{COMMODITY_VARIETIES[commodity].map(value => <option key={value} value={value}>{VARIETY_LABELS[value]}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm font-bold">Grade (seller-provided)<select name="grade" defaultValue={commodity === defaults?.commodity ? defaults.grade ?? "" : ""} className={field}><option value="">Unspecified</option>{GRADES.map(value => <option key={value} value={value}>{GRADE_LABELS[value]}</option>)}</select></label>
    </div>}
    <p className="text-xs text-[#6f626b]">Variety and grade are seller-provided descriptions, not verified certification or official grading.</p>
  </section>;
}
