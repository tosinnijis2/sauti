import { AuthCard } from "@/components/auth-card";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (user) redirect("/dashboard");

  return <AuthCard mode="register" error={params.error} />;
}
