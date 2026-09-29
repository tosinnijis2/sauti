import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Read the role from the database on every request, never from a client claim.
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}
