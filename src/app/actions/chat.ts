"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadConversation, startConversation, ChatError } from "@/lib/chat";

export async function contactSeller(form: FormData) {
  const user = await requireUser();
  let id = "";
  let error = "";
  try { id = (await startConversation(String(form.get("productId") ?? ""), user.id)).id; }
  catch (e) { error = e instanceof ChatError ? e.message : "Could not start conversation."; }
  if (error) redirect("/messages?error=" + encodeURIComponent(error));
  redirect("/messages/" + id);
}

export async function blockUser(form: FormData) {
  const user = await requireUser();
  const blockedId = String(form.get("userId") ?? "");
  if (blockedId === user.id || !await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } })) return;
  if (form.get("unblock") === "1") await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedId } });
  else await prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: user.id, blockedId } }, create: { blockerId: user.id, blockedId }, update: {} });
  revalidatePath("/messages", "layout");
}

export async function reportMessage(form: FormData) {
  const user = await requireUser();
  const messageId = String(form.get("messageId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (reason.length < 3 || reason.length > 500) return;
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.authorId === user.id || (message.conversationId && !await canReadConversation(message.conversationId, user.id))) return;
  await prisma.messageReport.upsert({ where: { messageId_reporterId: { messageId, reporterId: user.id } }, create: { messageId, reporterId: user.id, reason }, update: { reason, resolved: false } });
  redirect("/messages?reported=1");
}

export async function moderateReport(form: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/messages");
  const id = String(form.get("reportId") ?? "");
  const report = await prisma.messageReport.findUnique({ where: { id } });
  if (!report) return;
  await prisma.$transaction(async tx => {
    if (form.get("hide") === "1") await tx.message.update({ where: { id: report.messageId }, data: { hidden: true } });
    await tx.messageReport.update({ where: { id }, data: { resolved: true } });
  });
  revalidatePath("/messages/moderation");
}
