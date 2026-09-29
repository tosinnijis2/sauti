"use client";
import Image from "next/image";
import { useState } from "react";
import { isAllowedImageUrl } from "@/lib/images";

export function SellerAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e1ece7] text-sm font-bold text-[#31564a]" aria-hidden="true">{imageUrl && isAllowedImageUrl(imageUrl) && failed !== imageUrl ? <Image src={imageUrl} alt="" fill sizes="40px" className="object-cover" referrerPolicy="no-referrer" onError={() => setFailed(imageUrl)} /> : name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>;
}
