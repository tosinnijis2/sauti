"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createDeal, transitionDeal } from "@/lib/deals";
const idPattern = /^[a-zA-Z0-9-]{1,100}$/;
export async function createDealAction(form: FormData) { const user = await requireUser(); const conversationId = String(form.get("conversationId") ?? ""); if (!idPattern.test(conversationId)) return; try { await createDeal(conversationId, user.id); } catch { } revalidatePath("/deals"); revalidatePath(`/messages/${conversationId}`); redirect(`/messages/${conversationId}`); }
export async function dealAction(form: FormData) { const user = await requireUser(); const dealId = String(form.get("dealId") ?? ""); const conversationId = String(form.get("conversationId") ?? ""); const action = String(form.get("action") ?? ""); if (!idPattern.test(dealId) || !["confirm", "cancel", "dispute"].includes(action)) return; try { await transitionDeal(dealId, user.id, action as "confirm" | "cancel" | "dispute", String(form.get("reason") ?? "")); } catch { } revalidatePath("/deals"); if (idPattern.test(conversationId)) revalidatePath(`/messages/${conversationId}`); }
