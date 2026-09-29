import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moderateReport } from "@/app/actions/chat";

export default async function ModerationPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const reports = await prisma.messageReport.findMany({ where: { resolved: false }, include: { message: true, reporter: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 100 });
  return <AppShell><h1 className="text-3xl font-bold">Message reports</h1>{!reports.length && <p className="mt-6">No unresolved reports.</p>}{reports.map(r => <article key={r.id} className="border-b py-6"><p className="whitespace-pre-wrap break-words">{r.message.body}</p><p className="mt-3 text-sm">{r.reporter.name}: {r.reason}</p><form action={moderateReport} className="mt-4 flex gap-4"><input type="hidden" name="reportId" value={r.id} /><button name="hide" value="1" className="text-red-700 underline">Hide message</button><button name="hide" value="0" className="underline">Dismiss report</button></form></article>)}</AppShell>;
}
