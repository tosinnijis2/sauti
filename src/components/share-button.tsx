"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState("");
  return <div><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d9cccc] px-4 text-sm font-semibold" onClick={async () => {
    const link = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) { await navigator.share({ title, url: link }); setStatus("Shared."); }
      else { await navigator.clipboard.writeText(link); setStatus("Link copied."); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setUrl(link); setStatus("Copy the link below.");
    }
  }}><Share2 size={17} />Share</button>{status && <p role="status" className="mt-2 text-xs text-[#6f626b]">{status}</p>}{url && <input aria-label="Listing share link" readOnly value={url} onFocus={event => event.target.select()} className="mt-2 w-full rounded border p-2 text-sm" />}</div>;
}
