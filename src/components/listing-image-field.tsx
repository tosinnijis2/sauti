"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Replace, Trash2 } from "lucide-react";
import { imageFileError, matchesImageContent } from "@/lib/images";
import { ProductImage } from "./product-image";

export type PhotoSelection = { mode: "keep" | "replace" | "remove"; file: File | null; preview: string | null };

export function ListingImageField({ defaultValue, value, onChange, disabled }: {
  defaultValue?: string | null; value: PhotoSelection; onChange: (value: PhotoSelection) => void; disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { if (value.preview) URL.revokeObjectURL(value.preview); }, [value.preview]);

  async function choose(file?: File) {
    if (!file || disabled) return;
    const attempt = ++generation.current;
    const validation = imageFileError(file);
    if (validation) { setError(validation); return; }
    const valid = matchesImageContent(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (attempt !== generation.current) return;
    if (!valid) { setError("Choose a valid JPG, PNG, or WebP image."); return; }
    setError("");
    onChange({ mode: "replace", file, preview: URL.createObjectURL(file) });
  }

  const hasPhoto = value.mode === "replace" || (value.mode === "keep" && Boolean(defaultValue));
  const buttonClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d9cccc] bg-white px-4 text-sm font-semibold disabled:opacity-50";
  return <section aria-label="Product photo" className="grid min-w-0 gap-3">
    <h2 className="text-sm font-bold">Product photo <span className="font-normal text-[#6f626b]">(optional)</span></h2>
    <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }} className="max-w-md overflow-hidden rounded-lg border border-dashed border-[#b8c5be] bg-[#edf1ef]">
      {value.preview ? <div className="relative aspect-[4/3]"><Image src={value.preview} alt="Selected product photo preview" fill unoptimized className="object-contain" /></div> : hasPhoto ? <ProductImage src={defaultValue} alt="Current product photo" sizes="448px" /> : <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 p-5 text-center"><ImagePlus size={32} className="text-[#47715f]" /><p className="font-semibold">Upload product photo</p><p className="text-sm text-[#6f626b]">Drag and drop or choose a photo</p></div>}
    </div>
    <p id="photo-help" className="text-xs text-[#6f626b]">JPG, PNG, or WebP. Maximum 5 MB.</p>
    <label htmlFor="product-photo" className="sr-only">Choose product photo</label>
    <input ref={input} id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} disabled={disabled} aria-describedby={`photo-help${error ? " photo-error" : ""}`} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    <div className="flex flex-wrap gap-3">
      <button ref={chooseButton} type="button" disabled={disabled} className={buttonClass} onClick={() => input.current?.click()}>{hasPhoto ? <Replace size={18} /> : <ImagePlus size={18} />}{hasPhoto ? "Replace Photo" : "Choose Photo"}</button>
      {hasPhoto && <button type="button" disabled={disabled} className={buttonClass} onClick={() => { generation.current++; setError(""); onChange({ mode: "remove", file: null, preview: null }); chooseButton.current?.focus(); }}><Trash2 size={18} />Remove Photo</button>}
    </div>
    {error && <p id="photo-error" role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
