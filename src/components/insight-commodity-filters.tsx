"use client";
import { useState } from "react";
import { COMMODITIES, COMMODITY_LABELS, VARIETIES, VARIETY_LABELS, GRADES, GRADE_LABELS, type Commodity, type Variety, type Grade } from "@/lib/commodities";
import type { InsightGroup } from "@/lib/insights";

export function InsightCommodityFilters({ groups, initial, fieldClass }: { groups: InsightGroup[]; initial: { commodity: Commodity | ""; variety: Variety | ""; grade: Grade | "" }; fieldClass: string }) {
  const [commodity, setCommodity] = useState(initial.commodity);
  const [variety, setVariety] = useState(initial.variety);
  const [grade, setGrade] = useState(initial.grade);
  const matching = groups.filter(group => group.commodity === commodity);
  return <>
    <label className="grid min-w-0 gap-2 text-sm font-bold">Commodity<select name="commodity" value={commodity} onChange={event => { setCommodity(event.target.value as Commodity | ""); setVariety(""); setGrade(""); }} className={fieldClass}><option value="">Select commodity</option>{COMMODITIES.filter(value => value === commodity || groups.some(group => group.commodity === value)).map(value => <option key={value} value={value}>{COMMODITY_LABELS[value]}</option>)}</select></label>
    <label className="grid min-w-0 gap-2 text-sm font-bold">Variety<select name="variety" disabled={!commodity} value={variety} onChange={event => setVariety(event.target.value as Variety | "")} className={fieldClass}><option value="">Unspecified only</option>{VARIETIES.filter(value => value === variety || matching.some(group => group.variety === value)).map(value => <option key={value} value={value}>{VARIETY_LABELS[value]}</option>)}</select></label>
    <label className="grid min-w-0 gap-2 text-sm font-bold">Grade (seller-provided)<select name="grade" disabled={!commodity} value={grade} onChange={event => setGrade(event.target.value as Grade | "")} className={fieldClass}><option value="">Unspecified only</option>{GRADES.filter(value => value === grade || matching.some(group => group.grade === value)).map(value => <option key={value} value={value}>{GRADE_LABELS[value]}</option>)}</select></label>
  </>;
}
