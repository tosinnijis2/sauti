"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { loginSchema, registrationSchema } from "@/lib/validation";

export function AuthForm({ mode, action, error, children }: {
  mode: "login" | "register";
  action: (form: FormData) => Promise<void>;
  error?: string;
  children: ReactNode;
}) {
  const [validationError, setValidationError] = useState("");
  const message = validationError || error;
  return <form action={action} noValidate className="mt-8 grid gap-4" onSubmit={event => {
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const parsed = (mode === "register" ? registrationSchema : loginSchema).safeParse(values);
    setValidationError("");
    if (!parsed.success) {
      event.preventDefault();
      setValidationError(parsed.error.issues.map(issue => issue.message).join(" "));
    }
  }}>
    {children}
    {message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p>}
  </form>;
}

export function AuthSubmit({ login }: { login: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} className="mt-2 rounded-xl bg-[#20141d] px-4 py-3 font-bold text-white transition hover:bg-[#342330] disabled:opacity-60">
    {pending ? (login ? "Signing in..." : "Creating account...") : (login ? "Sign in" : "Create account")}
  </button>;
}
