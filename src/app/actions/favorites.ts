"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { FavoriteError, favoriteProductId, setFavorite } from "@/lib/favorites";
import { favoriteSignInPath } from "@/lib/auth-return";

async function change(form: FormData, saved: boolean) {
  const parsed = favoriteProductId.safeParse(form.get("productId"));
  if (!parsed.success) return { error: "Choose a valid listing." };
  const user = await getCurrentUser();
  if (!user) return { login: favoriteSignInPath(parsed.data) };
  try {
    const result = await setFavorite(user.id, parsed.data, saved);
    revalidatePath("/saved");
    revalidatePath("/dashboard");
    revalidatePath("/market");
    revalidatePath(`/market/${parsed.data}`);
    if (result.ownerId) revalidatePath(`/sellers/${result.ownerId}`);
    return { saved: result.saved };
  } catch (cause) {
    return { error: cause instanceof FavoriteError ? cause.message : saved ? "We couldn't save this listing. Please try again." : "We couldn't remove this saved listing. Please try again." };
  }
}

export async function saveFavorite(form: FormData) { return change(form, true); }
export async function removeFavorite(form: FormData) { return change(form, false); }
