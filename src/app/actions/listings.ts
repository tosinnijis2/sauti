"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteOwnedListing, ListingError, saveListing, changeListingStatus } from "@/lib/listings";
import { ImageUploadError } from "@/lib/cloudinary";

function invalidate(userId: string, productId?: string) {
  revalidatePath("/");
  revalidatePath("/listings");
  revalidatePath("/market");
  revalidatePath("/market/insights");
  revalidatePath("/saved");
  revalidatePath("/dashboard");
  revalidatePath(`/sellers/${userId}`);
  if (productId) {
    revalidatePath(`/market/${productId}`);
    revalidatePath(`/listings/${productId}/edit`);
  }
}

async function save(form: FormData, productId?: string) {
  const user = await requireUser();
  let error = "";
  try { await saveListing(user.id, form, productId); }
  catch (cause) {
    error = cause instanceof ListingError || cause instanceof ImageUploadError ? cause.message : "We could not save your listing. Please try again.";
  }
  if (error) {
    if (form.get("inlineErrors") === "1") return { error };
    redirect(`${productId ? `/listings/${encodeURIComponent(productId)}/edit` : "/listings/new"}?error=${encodeURIComponent(error)}`);
  }
  invalidate(user.id, productId);
  if (form.get("inlineErrors") === "1") return { redirectTo: `/listings?${productId ? "updated" : "created"}=1` };
  redirect(`/listings?${productId ? "updated" : "created"}=1`);
}

export async function createListingAction(form: FormData) { return save(form); }
export async function updateListingAction(productId: string, form: FormData) { return save(form, productId); }

export async function updateListingStatusAction(form: FormData) {
  const user = await requireUser();
  const productId = String(form.get("productId") ?? "");
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(productId)) return { error: "Choose a valid listing." };
  try { await changeListingStatus(user.id, productId, form.get("status")); }
  catch (cause) { return { error: cause instanceof ListingError ? cause.message : "Could not update the listing status. Please try again." }; }
  invalidate(user.id, productId);
}

export async function deleteListingAction(productId: string) {
  const user = await requireUser();
  let error = "";
  try { await deleteOwnedListing(user.id, productId); }
  catch (cause) { error = cause instanceof ListingError ? cause.message : "We could not delete this listing. Please try again."; }
  if (error) redirect(`/listings?error=${encodeURIComponent(error)}`);
  invalidate(user.id, productId);
  redirect("/listings?deleted=1");
}
