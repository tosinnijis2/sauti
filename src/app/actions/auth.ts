"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registrationSchema } from "@/lib/validation";
import { safeAuthReturn } from "@/lib/auth-return";
import { requestEmailVerification } from "@/lib/email-verification";

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

  let registrationError = "";
  try {
    const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const phoneOwner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (emailOwner) registrationError = "An account with that email already exists. Please sign in or reset your password.";
    else if (phoneOwner) registrationError = "An account with that phone number already exists.";
    else {
      const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        location,
        country: parsed.data.country,
      },
        select: { id: true },
      });
      await requestEmailVerification(user.id);
    }
  } catch (error) {
    console.error("Registration failed", error);
    registrationError = "We could not create your account. Please try again.";
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
