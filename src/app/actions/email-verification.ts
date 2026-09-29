"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestEmailVerification, verifyEmailToken } from "@/lib/email-verification";

export async function sendEmailVerificationAction() {
  const user = await requireUser();
  const result = await requestEmailVerification(user.id);
  const notice = result === "sent" ? "verification-sent" : result === "rate-limited" ? "verification-rate-limited" : result === "already-verified" ? "verified" : "verification-unavailable";
  redirect(`/profile?notice=${notice}`);
}

export async function confirmEmailVerificationAction(formData: FormData) {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const verified = await verifyEmailToken(user.id, token);
  if (!verified) redirect("/profile?notice=verification-invalid");
  revalidatePath("/profile");
  revalidatePath("/price-watches");
  redirect("/profile?notice=verified");
}
