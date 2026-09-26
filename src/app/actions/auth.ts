"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registrationSchema } from "@/lib/validation";

function firstValidationError(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

function authError(path: "/login" | "/register", message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData) {
  const parsed = registrationSchema.safeParse({
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

  const [emailOwner, phoneOwner] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { phone } }),
  ]);

  if (emailOwner) authError("/register", "An account with that email already exists.");
  if (phoneOwner) authError("/register", "An account with that phone number already exists.");

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        location,
      },
      select: { id: true },
    });
  } catch (error) {
    console.error("Registration failed", error);
    authError("/register", "We could not create your account. Please try again.");
  }

  redirect(`/login?registered=1&email=${encodeURIComponent(email)}`);
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    authError("/login", firstValidationError(parsed.error));
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  if (!user) authError("/login", "Invalid email or password.");

  const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!validPassword) authError("/login", "Invalid email or password.");

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
