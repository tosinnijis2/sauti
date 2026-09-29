"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin/auth";
import { createReview, moderateReview, reportReview, resolveReviewReport, ReviewError } from "@/lib/reviews";

const idPattern = /^[a-zA-Z0-9-]{1,100}$/;

export async function createReviewAction(formData: FormData) {
  const user = await requireUser();
  const dealId = String(formData.get("dealId") ?? "");
  if (!idPattern.test(dealId)) redirect("/deals?review=invalid");
  try { await createReview(dealId, user.id, formData.get("rating"), formData.get("comment")); }
  catch (error) { redirect(`/deals?review=error&message=${encodeURIComponent(error instanceof ReviewError ? error.message : "Review submission failed.")}`); }
  revalidatePath("/deals");
  redirect("/deals?review=submitted");
}

export async function moderateReviewAction(formData: FormData) {
  const admin = await requireAdmin();
  const reviewId = String(formData.get("reviewId") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!idPattern.test(reviewId) || !["publish", "hide", "remove"].includes(action)) return;
  try { await moderateReview(reviewId, admin.id, action as "publish" | "hide" | "remove", formData.get("reason"), formData.get("note")); } catch { return; }
  revalidatePath("/admin/reviews");
  revalidatePath("/sellers", "layout");
}

export async function reportReviewAction(formData: FormData) {
  const user = await requireUser();
  const reviewId = String(formData.get("reviewId") ?? "");
  if (!idPattern.test(reviewId)) return;
  try { const report = await reportReview(reviewId, user.id, formData.get("reason"), formData.get("note")); revalidatePath(`/sellers/${report.review.targetId}`); redirect(`/sellers/${report.review.targetId}?reported=1`); }
  catch (error) { if (error instanceof ReviewError) redirect("/market?error=" + encodeURIComponent(error.message)); throw error; }
}

export async function resolveReviewReportAction(formData: FormData) {
  const admin = await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!idPattern.test(reportId) || !["RESOLVED", "DISMISSED"].includes(status)) return;
  try { await resolveReviewReport(reportId, admin.id, status as "RESOLVED" | "DISMISSED"); } catch { return; }
  revalidatePath("/admin/reviews");
}
