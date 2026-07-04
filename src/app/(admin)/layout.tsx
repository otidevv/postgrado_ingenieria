import { requireUser, userHas } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";
import type { AdminNotification } from "@/components/admin/data";

const WEEK_MS = 7 * 86_400_000;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const notifications = await buildNotifications(user);

  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        roles: user.roles.map((r) => r.name),
      }}
      notifications={notifications}
    >
      {children}
    </AdminShell>
  );
}

async function buildNotifications(
  user: Awaited<ReturnType<typeof requireUser>>,
): Promise<AdminNotification[]> {
  const out: AdminNotification[] = [];

  if (userHas(user, "incidents.read")) {
    const open = await prisma.incident.findMany({
      where: { status: { in: ["open", "triaged"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, code: true, title: true, severity: true },
    });
    for (const i of open) {
      out.push({
        id: `inc-${i.id}`,
        title: i.severity === "critical" ? `Incidente crítico · ${i.code}` : `Incidente abierto · ${i.code}`,
        sub: i.title,
        icon: "alert",
        href: "/incidentes",
      });
    }
  }

  if (userHas(user, "users.read")) {
    const since = new Date(Date.now() - WEEK_MS);
    const recent = await prisma.user.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, name: true },
    });
    for (const u of recent) {
      out.push({
        id: `usr-${u.id}`,
        title: "Nuevo usuario",
        sub: u.name,
        icon: "user",
        href: "/usuarios",
      });
    }
  }

  return out.slice(0, 8);
}
