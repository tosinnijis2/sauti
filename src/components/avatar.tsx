"use client";

import Image from "next/image";
import { useState } from "react";
import { isAllowedImageUrl } from "@/lib/images";

const sizes = { sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-20 text-xl", xl: "size-28 text-3xl" } as const;
const pixels = { sm: 36, md: 44, lg: 80, xl: 112 } as const;

export function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "S";
}

export function Avatar({ name, imageUrl, size = "md", className = "" }: {
  name: string; imageUrl?: string | null; size?: keyof typeof sizes; className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const valid = imageUrl && isAllowedImageUrl(imageUrl) && failed !== imageUrl;
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#e1ece7] font-bold text-[#31564a] ring-1 ring-black/5 ${sizes[size]} ${className}`} aria-label={`${name} profile photo`}>
    {valid ? <Image src={imageUrl} alt="" fill sizes={`${pixels[size]}px`} className="object-cover" referrerPolicy="no-referrer" onError={() => setFailed(imageUrl)} /> : <span aria-hidden="true">{initials(name)}</span>}
  </span>;
}
