"use client";

import Image from "next/image";
import { Camera, Replace, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { imageFileError, matchesImageContent, isAllowedImageUrl } from "@/lib/images";
import { Avatar } from "./avatar";

export function ProfilePhotoField({ name, imageUrl, inputName = "profilePhoto" }: {
  name: string; imageUrl?: string | null; inputName?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"keep" | "replace" | "remove">("keep");
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function choose(file?: File) {
    if (!file) return;
    const issue = imageFileError(file);
    if (issue || !matchesImageContent(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) {
      setError(issue || "Choose a valid JPG, PNG, or WebP image."); return;
    }
    setError(""); setPreview(URL.createObjectURL(file)); setMode("replace");
  }

  const hasPhoto = Boolean(preview || (mode === "keep" && imageUrl && isAllowedImageUrl(imageUrl)));
  const button = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d9cccc] bg-white px-4 text-sm font-semibold text-[#20141d] hover:border-[#fe7a7c]";
  return <section className="grid gap-4" aria-label="Profile photo">
    <div className="flex flex-wrap items-center gap-5">
      {preview ? <span className="relative size-28 shrink-0 overflow-hidden rounded-full ring-4 ring-[#ffe0df]"><Image src={preview} alt="Selected profile photo preview" fill unoptimized className="object-cover" /></span> : <Avatar name={name || "Sauti member"} imageUrl={mode === "remove" ? null : imageUrl} size="xl" className="ring-4 ring-[#ffe0df]" />}
      <div className="grid gap-2"><p className="text-sm font-bold">Profile photo <span className="font-normal text-[#6f626b]">(optional)</span></p><p className="text-xs text-[#6f626b]">JPG, PNG, or WebP. Maximum 5 MB.</p><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => input.current?.click()}>{hasPhoto ? <Replace size={17} /> : <Camera size={17} />}{hasPhoto ? "Replace Photo" : "Choose Photo"}</button>{hasPhoto && <button type="button" className={button} onClick={() => { setPreview(null); setMode("remove"); setError(""); if (input.current) input.current.value = ""; }}><Trash2 size={17} />Remove Photo</button>}</div></div>
    </div>
    <input type="hidden" name="photoMode" value={mode} />
    <input ref={input} name={inputName} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => void choose(event.target.files?.[0])} />
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
  </section>;
}
