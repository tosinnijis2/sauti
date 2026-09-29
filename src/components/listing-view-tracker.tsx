"use client";
import { useEffect } from "react";
export function ListingViewTracker({ productId }: { productId: string }) { useEffect(() => { void fetch(`/api/listings/${productId}/view`, { method: "POST", credentials: "same-origin" }); }, [productId]); return null; }
