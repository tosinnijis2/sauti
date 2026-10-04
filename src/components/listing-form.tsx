"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { CountrySelect } from "./country-select";
import { PRODUCT_CATEGORIES, productSchema, editProductSchema } from "@/lib/validation";
import { UNIT_VALUES, UNIT_RULES, PACKAGE_UNITS, CONTENT_UNITS, STATUS_VALUES, STATUS_LABELS, type Unit, type Status } from "@/lib/units";
import { CommodityFields, type CommodityDefaults } from "./commodity-fields";
import { IMAGE_UPLOAD_ERROR } from "@/lib/images";
import { ListingImageField, type PhotoSelection } from "./listing-image-field";
import { fieldClass, primaryButtonClass, secondaryButtonClass, Alert } from "./ui";

type ListingDefaults = CommodityDefaults & {
  imageUrl?: string | null;
  country?: string | null;
  item: string;
  category: string;
  location: string;
  price: string;
  quantity?: string | null;
  originalQuantity?: string | null;
  remainingQuantity?: string | null;
  soldQuantity?: string | null;
  unit?: Unit | null;
  status?: Status;
  packageQuantity?: string | null;
  packageUnit?: Unit | null;
  description: string;
};

type ListingFormProps = {
  action: (formData: FormData) => Promise<{ error?: string; redirectTo?: string } | void>;
  productId?: string;
  submitLabel: string;
  defaults?: ListingDefaults;
};

export function ListingForm({ action, submitLabel, defaults, productId }: ListingFormProps) {
  const router = useRouter();
  const [unit, setUnit] = useState<Unit | "">(defaults?.unit ?? "");
  const [photo, setPhoto] = useState<PhotoSelection>({ mode: "keep", file: null, preview: null });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const receipt = useRef<string | null>(null);

  async function submit(form: FormData) {
    if (inFlight.current) return;
    const parsed = (productId ? editProductSchema : productSchema).safeParse(Object.fromEntries(form));
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (photo.file && !receipt.current) {
        setStatus("Uploading photo...");
        setProgress(0);
        const upload = new FormData();
        upload.set("photo", photo.file);
        if (productId) upload.set("productId", productId);
        receipt.current = await new Promise<string>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", "/api/uploads/product");
          request.timeout = 65000;
          request.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
          request.onerror = request.ontimeout = () => reject(new Error(IMAGE_UPLOAD_ERROR));
          request.onload = () => {
            try {
              const data: unknown = JSON.parse(request.responseText);
              if (typeof data !== "object" || !data) throw new Error();
              if (request.status >= 200 && request.status < 300 && "receipt" in data && typeof data.receipt === "string") resolve(data.receipt);
              else reject(new Error("error" in data && typeof data.error === "string" ? data.error : IMAGE_UPLOAD_ERROR));
            } catch { reject(new Error(IMAGE_UPLOAD_ERROR)); }
          };
          request.send(upload);
        });
      }
      form.set("photoMode", photo.mode);
      if (receipt.current) form.set("uploadReceipt", receipt.current);
      form.set("inlineErrors", "1");
      setStatus("Saving listing...");
      const result = await action(form);
      if (result?.error) setError(result.error);
      else if (result?.redirectTo) { router.push(result.redirectTo); router.refresh(); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your listing. Please try again.");
    } finally { inFlight.current = false; setBusy(false); setStatus(""); }
  }
  return (
    <form onSubmit={event => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }} aria-busy={busy} className="mt-8 max-w-2xl border-y border-[#eadfdf] py-7">
      <fieldset disabled={busy} className="grid min-w-0 gap-5">
      <section aria-labelledby="listing-basics" className="grid min-w-0 gap-5">
      <header><h2 id="listing-basics" className="text-xl font-bold">Listing basics</h2><p className="mt-1 text-sm text-[#6f626b]">Help buyers identify exactly what you are offering.</p></header>
      <ListingImageField defaultValue={defaults?.imageUrl} value={photo} disabled={busy} onChange={selection => { receipt.current = null; setPhoto(selection); setError(""); }} />
      <label className="grid gap-2 text-sm font-bold text-[#20141d]">
        Product name
        <input name="item" type="text" className={fieldClass} defaultValue={defaults?.item} maxLength={120} required />
      </label>

      <label className="grid gap-2 text-sm font-bold text-[#20141d]">
        Category
        <select name="category" className={fieldClass} defaultValue={defaults?.category ?? ""} required>
          <option value="" disabled>Select category</option>
          {PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>

      <CommodityFields defaults={defaults} />
      </section>

      <section aria-labelledby="listing-availability" className="grid min-w-0 gap-5 border-t border-[#eadfdf] pt-6">
      <header><h2 id="listing-availability" className="text-xl font-bold">Availability</h2><p className="mt-1 text-sm text-[#6f626b]">Set where the item is available and the total quantity buyers can discuss.</p></header>
      <CountrySelect value={defaults?.country} />
      <label className="grid gap-2 text-sm font-bold text-[#20141d]">
        Location
        <input name="location" type="text" className={fieldClass} defaultValue={defaults?.location} maxLength={120} required />
      </label>

      {productId && !defaults?.quantity && <p className="text-sm text-[#6f626b]">Quantity and unit are missing on this older listing. Comparable price insights require both and a structured commodity.</p>}
      {productId && defaults?.unit && defaults.originalQuantity && defaults.remainingQuantity && <p className="rounded-lg bg-[#edf1ef] p-3 text-sm text-[#31564a]"><strong>Inventory:</strong> {defaults.originalQuantity} {UNIT_RULES[defaults.unit].label} listed · {defaults.soldQuantity ?? "0"} sold · {defaults.remainingQuantity} available. Enter total inventory below; it cannot be lower than completed sales.</p>}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-bold">{productId ? "Total inventory" : "Quantity"}<input name="quantity" type="number" min="0.001" max="999999999.999" step="0.001" className={fieldClass + " min-w-0"} defaultValue={defaults?.quantity ?? ""} required={!productId || Boolean(defaults?.quantity)} /></label>
        <label className="grid min-w-0 gap-2 text-sm font-bold">Unit<select name="unit" className={fieldClass + " min-w-0"} value={unit} onChange={event => setUnit(event.target.value as Unit | "")} required={!productId || Boolean(defaults?.quantity)}><option value="">Select unit</option>{UNIT_VALUES.map(unit => <option key={unit} value={unit}>{UNIT_RULES[unit].label}</option>)}</select></label>
      </div>
      {unit && PACKAGE_UNITS.includes(unit) && <section key={unit} className="grid min-w-0 gap-4 border-y border-[#eadfdf] py-5" aria-label="Package contents"><h2 className="text-lg font-bold">Contents per {UNIT_RULES[unit].label} <span className="text-sm font-normal text-[#6f626b]">(optional)</span></h2><div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="grid min-w-0 gap-2 text-sm font-bold">Quantity per package<input name="packageQuantity" type="number" min="0.001" step="0.001" max="999999999.999" defaultValue={unit === defaults?.unit ? defaults.packageQuantity ?? "" : ""} className={fieldClass + " min-w-0"} /></label><label className="grid min-w-0 gap-2 text-sm font-bold">Contents unit<select name="packageUnit" defaultValue={unit === defaults?.unit ? defaults.packageUnit ?? "" : ""} className={fieldClass + " min-w-0"}><option value="">Unspecified</option>{CONTENT_UNITS.map(value => <option key={value} value={value}>{UNIT_RULES[value].label}</option>)}</select></label></div><p className="text-xs text-[#6f626b]">Contents apply to each {UNIT_RULES[unit].label}. No package weight is assumed when unspecified.</p></section>}
      </section>

      <section aria-labelledby="listing-terms" className="grid min-w-0 gap-5 border-t border-[#eadfdf] pt-6">
      <header><h2 id="listing-terms" className="text-xl font-bold">Asking price and details</h2><p className="mt-1 text-sm text-[#6f626b]">The asking price applies to the full quantity above. A later deal may use a different agreed price.</p></header>
      <label className="grid gap-2 text-sm font-bold text-[#20141d]">
        Total price for this quantity (USD)
        <input name="price" type="number" step="0.01" min="0.01" max="9999999999.99" className={fieldClass} defaultValue={defaults?.price} required />
      </label>

      {productId && <label className="grid gap-2 text-sm font-bold">Listing status<select name="status" defaultValue={defaults?.status ?? "ACTIVE"} className={fieldClass}>{STATUS_VALUES.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>}

      <label className="grid gap-2 text-sm font-bold text-[#20141d]">
        Description
        <textarea name="description" rows={5} className={fieldClass} defaultValue={defaults?.description} maxLength={2000} required />
      </label>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButtonClass}>
          {submitLabel}
        </button>
        {!busy && <Link href="/listings" className={secondaryButtonClass}>
          Cancel
        </Link>}
      </div>
      </fieldset>
      <div role="status" aria-live="polite" className="mt-4 text-sm">{status && <span className="flex items-center gap-2"><LoaderCircle size={18} className="motion-safe:animate-spin" />{status}</span>}{status === "Uploading photo..." && <progress className="mt-2 w-full" aria-label="Photo transfer progress" value={progress} max={100} />}</div>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
    </form>
  );
}
