import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export default async function AuditLogs({ searchParams }: { searchParams: Promise<{ page?: string; deleted?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const raw = Number(params.page);
  const page = Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1;
  const count = await prisma.auditLog.count();
  const logs = await prisma.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 });
  return <><h1 className="text-3xl font-bold">Audit logs</h1>{params.deleted === "1" && <p role="status" className="mt-4 text-green-800">Record deleted. The administrative action was recorded.</p>}<div className="mt-6 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr><th className="p-3">Time (UTC)</th><th>Admin ID</th><th>Action / target</th><th>Reason</th></tr></thead><tbody>{logs.map(log => <tr key={log.id} className="border-t"><td className="p-3">{log.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td>{log.adminId}</td><td className="p-3">{log.action} {log.targetType}<p className="text-xs">{log.targetId}</p></td><td className="max-w-xs break-words p-3">{log.reason}</td></tr>)}</tbody></table></div>{!logs.length && <p className="py-8">No administrative deletion actions recorded.</p>}<nav aria-label="Pagination" className="mt-6 flex gap-5">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{page * 20 < count && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></>;
}
