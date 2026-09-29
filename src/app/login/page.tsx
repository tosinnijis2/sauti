import { AuthCard } from "@/components/auth-card";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { safeAuthReturn } from "@/lib/auth-return";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    registered?: string;
    email?: string;
    reset?: string;
    next?: string;
    notice?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (user) redirect(safeAuthReturn(params.next));

  const success =
    params.registered === "1"
      ? "Registration completed successfully. Please log in with your email and password."
      : params.reset === "1" ? "Password updated. Please sign in with your new password." : undefined;

  return (
    <AuthCard
      mode="login"
      error={params.error}
      success={success}
      defaultEmail={params.email}
      returnTo={safeAuthReturn(params.next)}
      notice={params.notice === "save" ? "Sign in to save listings." : undefined}
    />
  );
}
