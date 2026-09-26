import { AuthCard } from "@/components/auth-card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    registered?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;

  const success =
    params.registered === "1"
      ? "Registration completed successfully. Please log in with your email and password."
      : undefined;

  return (
    <AuthCard
      mode="login"
      error={params.error}
      success={success}
      defaultEmail={params.email}
    />
  );
}