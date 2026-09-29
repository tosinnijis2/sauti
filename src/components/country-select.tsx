import { countries } from "@/lib/countries";
export function CountrySelect({ value, defaultValue, optional = false }: { value?: string | null; defaultValue?: string; optional?: boolean }) {
  return <label className="grid min-w-0 gap-2 text-sm font-bold">Country
    <select name="country" defaultValue={value ?? defaultValue ?? ""} required={!optional} className="min-w-0 rounded-lg border border-[#d9cccc] bg-white px-4 py-3 font-normal">
      <option value="">{optional ? "All countries" : "Select country"}</option>
      {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
    </select>
  </label>;
}
