"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSavedSearch, deleteSavedSearch, normalizeSavedSearch, renameSavedSearch, savedSearchUrl, SavedSearchError, setSavedSearchEnabled } from "@/lib/saved-searches";

const idPattern = /^[a-zA-Z0-9-]{1,100}$/;

export async function createSavedSearchAction(form: FormData) {
  const user = await requireUser();
  const raw = Object.fromEntries(form);
  const criteria = normalizeSavedSearch(raw);
  const returnUrl = savedSearchUrl(criteria);
  let destination = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}saved=1`;
  try { await createSavedSearch(user.id, raw); }
  catch (error) {
    const message = error instanceof SavedSearchError ? error.message : "We couldn't save this search.";
    destination = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}saveError=${encodeURIComponent(message)}`;
  }
  revalidatePath("/market");
  revalidatePath("/saved-searches");
  redirect(destination);
}

export async function renameSavedSearchAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!idPattern.test(id)) return;
  await renameSavedSearch(user.id, id, String(form.get("name") ?? ""));
  revalidatePath("/saved-searches");
}

export async function setSavedSearchEnabledAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!idPattern.test(id)) return;
  await setSavedSearchEnabled(user.id, id, form.get("enabled") === "true");
  revalidatePath("/market");
  revalidatePath("/saved-searches");
}

export async function deleteSavedSearchAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!idPattern.test(id)) return;
  await deleteSavedSearch(user.id, id);
  revalidatePath("/market");
  revalidatePath("/saved-searches");
  revalidatePath("/notifications");
}
