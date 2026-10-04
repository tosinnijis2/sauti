"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validation";
import { cleanupAvatarPhoto, ImageUploadError, uploadAvatarPhoto } from "@/lib/cloudinary";

function profileError(message: string): never {
  redirect(`/profile?error=${encodeURIComponent(message)}`);
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    country: formData.get("country"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    location: formData.get("location"),
  });

  if (!parsed.success) {
    profileError(parsed.error.issues[0]?.message ?? "Please check your profile details.");
  }

  const [emailOwner, phoneOwner] = await Promise.all([
    prisma.user.findFirst({
      where: { email: parsed.data.email, id: { not: user.id } },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { phone: parsed.data.phone, id: { not: user.id } },
      select: { id: true },
    }),
  ]);

  if (emailOwner) profileError("Another account already uses that email address.");
  if (phoneOwner) profileError("Another account already uses that phone number.");

  const photoMode = formData.get("photoMode");
  if (photoMode !== "keep" && photoMode !== "replace" && photoMode !== "remove") profileError("Choose a valid profile photo action.");
  const file = formData.get("profilePhoto");
  if (photoMode === "replace" && (!(file instanceof File) || file.size === 0)) profileError("Choose a profile photo to upload.");
  const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { imagePublicId: true } });
  let uploaded: { imageUrl: string; imagePublicId: string } | null = null;
  try {
    if (photoMode === "replace" && file instanceof File) uploaded = await uploadAvatarPhoto(file, user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { ...parsed.data, ...(uploaded ?? (photoMode === "remove" ? { imageUrl: null, imagePublicId: null } : {})), ...(parsed.data.email !== user.email ? { emailVerifiedAt: null, emailVerifications: { deleteMany: {} }, notificationPreference: { upsert: { create: { emailPriceAlerts: false }, update: { emailPriceAlerts: false } } } } : {}) },
    });
  } catch (error) {
    if (uploaded) await cleanupAvatarPhoto({ ownerId: user.id, imagePublicId: uploaded.imagePublicId });
    if (!(error instanceof ImageUploadError)) console.error("Profile update failed", error);
    profileError(error instanceof ImageUploadError ? error.message : "We could not update your profile. Please try again.");
  }

  if (photoMode !== "keep" && current.imagePublicId !== uploaded?.imagePublicId) {
    await cleanupAvatarPhoto({ ownerId: user.id, imagePublicId: current.imagePublicId });
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath(`/sellers/${user.id}`);
  redirect("/profile?updated=1");
}
