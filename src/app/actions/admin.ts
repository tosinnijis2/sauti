"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteAdminRecord, deletionSchema, DeletionError } from "@/lib/admin/deletion";

export async function adminDeleteAction(form: FormData) {
  const admin = await requireAdmin();
  const parsed = deletionSchema.safeParse(Object.fromEntries(form));
  let error = parsed.success ? "" : parsed.error.issues[0].message;
  if (parsed.success) {
    try { await deleteAdminRecord(admin.id, parsed.data); }
    catch (cause) { error = cause instanceof DeletionError ? cause.message : "Deletion failed. Please try again."; }
  }
  if (error) redirect("/admin/delete?" + new URLSearchParams({ type: String(form.get("type") ?? ""), id: String(form.get("id") ?? ""), error }));
  revalidatePath("/admin", "layout");
  revalidatePath("/market");
  revalidatePath("/");
  revalidatePath("/market/insights");
  revalidatePath("/saved");
  revalidatePath("/dashboard");
  revalidatePath("/listings");
  revalidatePath("/messages", "layout");
  redirect("/admin/audit-logs?deleted=1");
}
