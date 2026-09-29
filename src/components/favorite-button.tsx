"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, LoaderCircle } from "lucide-react";
import { removeFavorite, saveFavorite } from "@/app/actions/favorites";
import { favoriteSignInPath } from "@/lib/auth-return";

export function FavoriteButton({ productId, productName, saved, signedIn, compact = false }: {
  productId: string; productName: string; saved: boolean; signedIn: boolean; compact?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const router = useRouter();
  const className = `inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border bg-white text-sm font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47715f] disabled:opacity-60 ${compact ? "size-11" : "px-4"} ${optimistic ? "border-[#ebabb3] text-[#9d334b]" : "border-[#ded5da] text-[#20141d] hover:bg-[#fff0ef]"}`;
  if (!signedIn) return <Link href={favoriteSignInPath(productId)} aria-label={`Sign in to save ${productName}`} title="Sign in to save listings" className={className}><Heart size={19} aria-hidden="true" />{!compact && "Save"}</Link>;
  return <div className={compact ? "relative" : "max-w-full"}>
    <button type="button" aria-label={`${optimistic ? "Remove saved listing" : "Save listing"}: ${productName}`} aria-pressed={optimistic} aria-busy={pending} title={optimistic ? "Remove from saved listings" : "Save listing"} disabled={pending} className={className} onClick={() => {
      if (inFlight.current) return;
      inFlight.current = true;
      setError("");
      const desired = !optimistic;
      startTransition(async () => {
        setOptimistic(desired);
        try {
          const form = new FormData();
          form.set("productId", productId);
          const result = await (desired ? saveFavorite : removeFavorite)(form);
          if (result.error) setError(result.error);
          else if (result.login) router.push(result.login);
        } catch { setError(desired ? "We couldn't save this listing. Please try again." : "We couldn't remove this saved listing. Please try again."); }
        finally { inFlight.current = false; }
      });
    }}>{pending ? <LoaderCircle size={19} className="motion-safe:animate-spin" aria-hidden="true" /> : <Heart size={19} fill={optimistic ? "currentColor" : "none"} aria-hidden="true" />}{!compact && (optimistic ? "Saved" : "Save")}</button>
    {error && <p role="alert" className={compact ? "absolute right-0 top-12 z-10 w-52 rounded-lg border border-red-200 bg-white p-3 text-xs text-red-700 shadow-md" : "mt-2 max-w-xs text-sm text-red-700"}>{error}</p>}
  </div>;
}
