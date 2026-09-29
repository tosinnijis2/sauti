"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";

const idPattern = /^[a-zA-Z0-9-]{1,100}$/;
export async function markNotificationReadAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!idPattern.test(id)) return;
  await markNotificationRead(user.id, id);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
}
