"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin/auth";
import { closeSafetyReport, createSafetyReport, SafetyReportError } from "@/lib/safety-reports";
const idPattern = /^[a-zA-Z0-9-]{1,100}$/;
export async function createSafetyReportAction(form: FormData) {
  const user = await requireUser(); const targetType = String(form.get("targetType") ?? ""); const targetId = String(form.get("targetId") ?? "");
  const rawReturn = String(form.get("returnTo") ?? "/market"); const returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/market";
  if (!idPattern.test(targetId) || !["USER", "LISTING", "MESSAGE"].includes(targetType)) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}reportError=Invalid+report.`);
  try { await createSafetyReport(user.id, targetType as "USER" | "LISTING" | "MESSAGE", targetId, form.get("reason"), form.get("note")); }
  catch (error) { redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}reportError=${encodeURIComponent(error instanceof SafetyReportError ? error.message : "Report could not be submitted.")}`); }
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}safetyReported=1`);
}
export async function closeSafetyReportAction(form: FormData) {
  const admin = await requireAdmin(); const reportId = String(form.get("reportId") ?? ""); const status = String(form.get("status") ?? "");
  if (!idPattern.test(reportId) || !["RESOLVED", "DISMISSED"].includes(status)) return;
  try { await closeSafetyReport(reportId, admin.id, status as "RESOLVED" | "DISMISSED", form.get("moderatorNote"), form.get("deactivateListing") === "1"); } catch { return; }
  revalidatePath("/admin/reports"); revalidatePath("/market", "layout");
}
