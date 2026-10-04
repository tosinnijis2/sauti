"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registrationSchema } from "@/lib/validation";
import { safeAuthReturn } from "@/lib/auth-return";
import { requestEmailVerification } from "@/lib/email-verification";
import { cleanupAvatarPhoto, ImageUploadError, uploadAvatarPhoto } from "@/lib/cloudinary";
import { consumeRateLimit } from "@/lib/rate-limit";
import { tokenDigest } from "@/lib/recovery";

function firstValidationError(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

function authError(path: "/login" | "/register", message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData) {
  const parsed = registrationSchema.safeParse({
    country: formData.get("country"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    location: formData.get("location"),
  });

  if (!parsed.success) {
    authError("/register", firstValidationError(parsed.error));
  }

  const { name, email, phone, password, location } = parsed.data;
  if (!await consumeRateLimit("registration", tokenDigest(email), 5, 60 * 60_000)) authError("/register", "Too many account attempts. Please wait and try again.");
  const photo = formData.get("profilePhoto");
  if (photo !== null && (!(photo instanceof File) || (photo.size > 0 && !photo.type))) authError("/register", "Choose a valid profile photo.");

  let registrationError = "";
  let uploaded: { imageUrl: string; imagePublicId: string } | null = null;
  const userId = randomUUID();
  try {
    const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const phoneOwner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (emailOwner) registrationError = "An account with that email already exists. Please sign in or reset your password.";
    else if (phoneOwner) registrationError = "An account with that phone number already exists.";
    else {
      if (photo instanceof File && photo.size > 0) uploaded = await uploadAvatarPhoto(photo, userId);
      const user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        location,
        country: parsed.data.country,
        ...(uploaded ?? {}),
      },
        select: { id: true },
      });
      try { await requestEmailVerification(user.id); } catch { /* Registration remains valid if delivery is unavailable. */ }
    }
  } catch (error) {
    if (uploaded) await cleanupAvatarPhoto({ ownerId: userId, imagePublicId: uploaded.imagePublicId });
    if (!(error instanceof ImageUploadError)) console.error("Registration failed", error);
    registrationError = error instanceof ImageUploadError ? error.message : "We could not create your account. Please try again.";
  }
  if (registrationError) authError("/register", registrationError);

  redirect(`/login?registered=1&email=${encodeURIComponent(email)}`);
}

export async function loginAction(formData: FormData) {
  const returnTo = safeAuthReturn(formData.get("next"));
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(firstValidationError(parsed.error))}&next=${encodeURIComponent(returnTo)}`);
  }

  let loginError = "";
  try {
    if (!await consumeRateLimit("login", tokenDigest(parsed.data.email), 10, 15 * 60_000)) authError("/login", "Too many sign-in attempts. Please wait and try again.");
    const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

    if (!user || !await bcrypt.compare(parsed.data.password, user.passwordHash)) {
      loginError = "Invalid email or password.";
    } else {
      await createSession(user.id);
    }
  } catch (error) {
    console.error("Sign in failed", error);
    loginError = "Sign in is temporarily unavailable. Please try again.";
  }
  if (loginError) redirect(`/login?error=${encodeURIComponent(loginError)}&email=${encodeURIComponent(parsed.data.email)}&next=${encodeURIComponent(returnTo)}`);
  redirect(returnTo);
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
