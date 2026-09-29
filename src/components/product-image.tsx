"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { isAllowedImageUrl } from "@/lib/images";

export function ProductImage({ src, alt, sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw", priority = false, contain = false }: {
  src?: string | null; alt: string; sizes?: string; priority?: boolean; contain?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const valid = Boolean(src && isAllowedImageUrl(src) && src !== failedUrl);
  return <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#edf1ef]">
    {valid && src ? <Image src={src} alt={alt} fill sizes={sizes} priority={priority} referrerPolicy="no-referrer" className={contain ? "object-contain" : "object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"} onError={() => setFailedUrl(src)} /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#65746e]" role="img" aria-label={`No photo available for ${alt}`}><ImageOff size={30} strokeWidth={1.5} /><span className="text-xs">{src ? "Photo unavailable" : "No photo yet"}</span></div>}
  </div>;
}
