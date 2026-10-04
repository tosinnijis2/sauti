"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { loginSchema, registrationSchema } from "@/lib/validation";
import { Alert, primaryButtonClass } from "@/components/ui";

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
    {message && <Alert>{message}</Alert>}
  </form>;
}

export function AuthSubmit({ login }: { login: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} className={`${primaryButtonClass} mt-2 w-full`}>
    {pending ? (login ? "Signing in..." : "Creating account...") : (login ? "Sign in" : "Create account")}
  </button>;
}
