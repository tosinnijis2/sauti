"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createPriceWatch, deletePriceWatch, PriceWatchError, setPriceWatchEnabled } from "@/lib/price-watches";
import { prisma } from "@/lib/prisma";
import { NotificationPreferenceError, setEmailPriceAlertPreference } from "@/lib/notification-preferences";

const idPattern = /^[a-zA-Z0-9-]{1,100}$/;
export async function createPriceWatchAction(form: FormData) {
  const user = await requireUser();
  try { await createPriceWatch(user.id, Object.fromEntries(form)); }
  catch (cause) {
    const params = new URLSearchParams({
      commodity: String(form.get("commodity") ?? ""), variety: String(form.get("variety") ?? ""), grade: String(form.get("grade") ?? ""),
      unit: String(form.get("normalizedUnit") ?? "KG"), country: String(form.get("country") ?? ""), location: String(form.get("location") ?? ""), range: "all",
      error: cause instanceof PriceWatchError ? cause.message : "We couldn't create this price watch.",
    });
    redirect(`/market/insights?${params}`);
  }
  revalidatePath("/price-watches");
  redirect("/price-watches?created=1");
}

export async function setPriceWatchEnabledAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!idPattern.test(id)) return;
  await setPriceWatchEnabled(user.id, id, form.get("enabled") === "true");
  revalidatePath("/price-watches");
}

export async function deletePriceWatchAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!idPattern.test(id)) return;
  await deletePriceWatch(user.id, id);
  revalidatePath("/price-watches");
  revalidatePath("/notifications");
}

export async function updatePriceAlertPreferenceAction(form: FormData) {
  const user = await requireUser();
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, inAppPriceAlerts: form.get("enabled") === "true" }, update: { inAppPriceAlerts: form.get("enabled") === "true" } });
  revalidatePath("/price-watches");
}

export async function updateEmailPriceAlertPreferenceAction(form: FormData) {
  const user = await requireUser();
  const enabled = form.get("enabled") === "true";
  try { await setEmailPriceAlertPreference(user.id, enabled); }
  catch (error) { if (error instanceof NotificationPreferenceError) redirect("/price-watches?email=verify"); throw error; }
  revalidatePath("/price-watches");
}
