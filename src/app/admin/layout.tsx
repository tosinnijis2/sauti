import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Sauti Admin", robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const pendingReports = await prisma.messageReport.count({ where: { resolved: false } });
  return <AdminShell name={user.name} pendingReports={pendingReports}>{children}</AdminShell>;
}
