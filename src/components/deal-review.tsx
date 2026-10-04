import type { ReviewStatus } from "@prisma/client";
import { createReviewAction } from "@/app/actions/reviews";
import { fieldClass, primaryButtonClass } from "@/components/ui";

export function DealReview({ dealId, eligible, review }: { dealId: string; eligible: boolean; review?: { status: ReviewStatus; rating: number; comment: string | null } }) {
  if (review) return <section aria-label="Your review" className="mt-4 border-t border-[#eadfdf] pt-4"><p className="text-sm font-bold">Your review · {review.status.toLowerCase()}</p><p className="mt-1 text-sm">{review.rating}/5{review.comment ? ` · ${review.comment}` : ""}</p></section>;
  if (!eligible) return null;
  return <form action={createReviewAction} className="mt-4 grid gap-3 border-t border-[#eadfdf] pt-4"><input type="hidden" name="dealId" value={dealId} /><p className="text-sm font-bold">Leave a review</p><label className="grid gap-1 text-sm font-semibold">Rating<select name="rating" required className={fieldClass}><option value="">Choose rating</option>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating}/5</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Comment <span className="font-normal text-[#6f626b]">Optional · up to 500 characters</span><textarea name="comment" maxLength={500} rows={3} className={fieldClass} /></label><button className={`${primaryButtonClass} w-fit`}>Submit for moderation</button></form>;
}
