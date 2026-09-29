"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validation";

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

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { ...parsed.data, ...(parsed.data.email !== user.email ? { emailVerifiedAt: null, emailVerifications: { deleteMany: {} }, notificationPreference: { upsert: { create: { emailPriceAlerts: false }, update: { emailPriceAlerts: false } } } } : {}) },
    });
  } catch (error) {
    console.error("Profile update failed", error);
    profileError("We could not update your profile. Please try again.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/profile?updated=1");
}
