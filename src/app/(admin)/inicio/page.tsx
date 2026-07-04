import { prisma } from "@/lib/prisma";
import { requireUser, userHas } from "@/lib/auth/server";
import { DashboardView } from "./DashboardView";
import type {
  ActivityItem,
  DashboardData,
  QuickAction,
  SeveritySlice,
  StatusSlice,
} from "./types";

export const metadata = { title: "Inicio · UNAMAD Admin" };
export const dynamic = "force-dynamic";

const STATUS_META: { key: string; label: string; token: string }[] = [
  { key: "open", label: "Abiertos", token: "open" },
  { key: "triaged", label: "Clasificados", token: "triaged" },
  { key: "in_progress", label: "En progreso", token: "progress" },
  { key: "resolved", label: "Resueltos", token: "resolved" },
  { key: "rejected", label: "Rechazados", token: "rejected" },
  { key: "closed", label: "Cerrados", token: "closed" },
];

const SEVERITY_META: { key: string; label: string; color: string }[] = [
  { key: "critical", label: "Crítica", color: "var(--sev-critical)" },
  { key: "high", label: "Alta", color: "var(--sev-high)" },
  { key: "medium", label: "Media", color: "var(--sev-medium)" },
  { key: "low", label: "Baja", color: "var(--sev-low)" },
];

function greetingFor(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function Page() {
  const me = await requireUser();

  const canUsers = userHas(me, "users.read");
  const canRoles = userHas(me, "roles.read");
  const canIncidents = userHas(me, "incidents.read");

  // Local time in Lima for greeting + date, independent of server TZ.
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("es-PE", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Lima",
    }).format(now),
  );
  const dateLabel = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(now);

  // ── Users ──────────────────────────────────────────────────────────────
  const usersBlock = canUsers
    ? await prisma.user
        .findMany({ select: { active: true } })
        .then((rows) => ({
          total: rows.length,
          active: rows.filter((r) => r.active).length,
          suspended: rows.filter((r) => !r.active).length,
        }))
    : null;

  const recentUsers = canUsers
    ? await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, createdAt: true },
      })
    : [];

  // ── Roles ──────────────────────────────────────────────────────────────
  const rolesBlock = canRoles
    ? await prisma.role
        .findMany({
          orderBy: [{ system: "desc" }, { name: "asc" }],
          select: { name: true, system: true, _count: { select: { users: true } } },
        })
        .then((rows) => ({
          total: rows.length,
          distribution: rows.map((r) => ({
            name: r.name,
            count: r._count.users,
            system: r.system,
          })),
        }))
    : null;

  // ── Incidents ────────────────────────────────────────────────────────────
  let incidentsBlock: DashboardData["incidents"] = null;
  let recentIncidents: {
    id: string;
    code: string;
    title: string;
    createdAt: Date;
  }[] = [];
  let recentStatus: {
    id: string;
    toStatus: string;
    fromStatus: string;
    createdAt: Date;
    incident: { code: string };
  }[] = [];

  if (canIncidents) {
    const [byStatusRaw, bySeverityRaw, total] = await Promise.all([
      prisma.incident.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.incident.groupBy({ by: ["severity"], _count: { _all: true } }),
      prisma.incident.count(),
    ]);

    const statusCount = new Map<string, number>(
      byStatusRaw.map((r) => [String(r.status), r._count._all]),
    );
    const severityCount = new Map<string, number>(
      bySeverityRaw.map((r) => [String(r.severity), r._count._all]),
    );

    const byStatus: StatusSlice[] = STATUS_META.map((m) => ({
      key: m.key,
      label: m.label,
      token: m.token,
      count: statusCount.get(m.key) ?? 0,
    }));
    const bySeverity: SeveritySlice[] = SEVERITY_META.map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      count: severityCount.get(m.key) ?? 0,
    }));

    incidentsBlock = {
      total,
      open:
        (statusCount.get("open") ?? 0) +
        (statusCount.get("triaged") ?? 0) +
        (statusCount.get("in_progress") ?? 0),
      critical: severityCount.get("critical") ?? 0,
      resolved: statusCount.get("resolved") ?? 0,
      byStatus,
      bySeverity,
    };

    [recentIncidents, recentStatus] = await Promise.all([
      prisma.incident.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, code: true, title: true, createdAt: true },
      }),
      prisma.incidentStatusLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          toStatus: true,
          fromStatus: true,
          createdAt: true,
          incident: { select: { code: true } },
        },
      }),
    ]);
  }

  // ── Activity feed (merge + sort) ─────────────────────────────────────────
  const statusLabel = (k: string) =>
    STATUS_META.find((s) => s.key === k)?.label ?? k;

  const activity: ActivityItem[] = [
    ...recentUsers.map(
      (u): ActivityItem => ({
        id: `u-${u.id}`,
        icon: "user",
        tone: "blue",
        title: u.name,
        sub: "Nuevo usuario",
        at: u.createdAt.toISOString(),
      }),
    ),
    ...recentIncidents.map(
      (i): ActivityItem => ({
        id: `i-${i.id}`,
        icon: "alert",
        tone: "amber",
        title: `${i.code} · ${i.title}`,
        sub: "Incidente reportado",
        at: i.createdAt.toISOString(),
      }),
    ),
    ...recentStatus.map(
      (s): ActivityItem => ({
        id: `s-${s.id}`,
        icon: "check",
        tone: "green",
        title: s.incident.code,
        sub: `${statusLabel(s.fromStatus)} → ${statusLabel(s.toStatus)}`,
        at: s.createdAt.toISOString(),
      }),
    ),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  // ── Quick actions (permission-gated) ─────────────────────────────────────
  const quickActions: QuickAction[] = [];
  if (userHas(me, "users.write"))
    quickActions.push({
      label: "Crear usuario",
      desc: "Da de alta una cuenta institucional",
      href: "/usuarios",
      icon: "user",
    });
  if (canRoles)
    quickActions.push({
      label: "Gestionar roles",
      desc: "Revisa permisos y miembros",
      href: "/roles",
      icon: "shield",
    });
  if (canIncidents)
    quickActions.push({
      label: "Ver incidentes",
      desc: "Bandeja de reportes y seguimiento",
      href: "/incidentes",
      icon: "alert",
    });

  const data: DashboardData = {
    firstName: me.name.split(/\s+/)[0] ?? me.name,
    greeting: greetingFor(hour),
    dateLabel,
    users: usersBlock,
    roles: rolesBlock,
    incidents: incidentsBlock,
    activity,
    quickActions,
  };

  return <DashboardView data={data} nowMs={now.getTime()} />;
}
