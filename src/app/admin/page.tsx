import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
export default async function AdminPage() {
  await requireAdmin();
  redirect("/admin/dashboard");
}
