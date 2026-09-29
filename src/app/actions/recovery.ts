"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { issueReset, redeemReset, tokenDigest } from "@/lib/recovery";
import { prisma } from "@/lib/prisma";
import { deleteSession } from "@/lib/auth";
import { emailIsConfigured, sendEmail } from "@/lib/email";

export async function requestReset(form: FormData) {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get("email"));
  if (!email.success) redirect("/forgot-password?error=Enter+a+valid+email+address.");
  const { APP_URL } = process.env;
  if (!emailIsConfigured() || !APP_URL) redirect("/forgot-password?error=Password+recovery+email+is+currently+unavailable.");
  let token: string | null = null;
  try {
    const origin = new URL(APP_URL);
    if (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("Invalid email origin");
    token = await issueReset(email.data);
    if (token) {
      const link = new URL("/reset-password", origin);
      link.searchParams.set("token", token);
      await sendEmail({ to: email.data, subject: "Reset your Sauti password", text: "Reset your password using this single-use link (expires in 30 minutes):\n" + link.toString() + "\nIf you did not request this, ignore this email." });
    }
  } catch {
    if (token) await prisma.passwordReset.deleteMany({ where: { tokenHash: tokenDigest(token) } });
    console.error("Password recovery email delivery failed");
  }
  // Keep the response identical for existing and unknown addresses.
  redirect("/forgot-password?sent=1");
}

export async function resetPassword(form: FormData) {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72 || password !== confirm) {
    redirect("/reset-password?token=" + encodeURIComponent(token) + "&error=Use+matching+passwords+of+8+characters+or+more+(maximum+72+bytes).");
  }
  const success = await redeemReset(token, password);
  if (!success) redirect("/reset-password?error=This+reset+link+has+expired+or+already+been+used.");
  await deleteSession();
  redirect("/login?reset=1");
}
