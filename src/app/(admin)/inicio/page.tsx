import { prisma } from "@/lib/prisma";
import { requireUser, userHas } from "@/lib/auth/server";
import { DashboardView } from "./DashboardView";
import type {
  ActivityItem,
  DashboardData,
  DiplomaRow,
  QuickAction,
  SeveritySlice,
  StatusSlice,
  UpcomingSession,
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

/* Estados de postulación reutilizan los tokens de color de incidentes
   (--st-*-bg/fg) para no introducir una paleta nueva. */
const APP_STATUS_META: { key: string; label: string; token: string }[] = [
  { key: "pending", label: "Pendientes", token: "open" },
  { key: "reviewing", label: "En evaluación", token: "triaged" },
  { key: "waitlist", label: "Lista de espera", token: "closed" },
  { key: "accepted", label: "Admitidos", token: "resolved" },
  { key: "rejected", label: "No admitidos", token: "rejected" },
];

const DAY_MS = 86_400_000;

function greetingFor(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Clave YYYY-MM-DD en hora de Lima para agrupar por día. */
function limaDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function Page() {
  const me = await requireUser();

  const canUsers = userHas(me, "users.read");
  const canRoles = userHas(me, "roles.read");
  const canIncidents = userHas(me, "incidents.read");
  const canApplications = userHas(me, "applications.read");
  const canEnrollments = userHas(me, "enrollments.read");
  const canDiplomas = userHas(me, "diplomas.read");
  const canTeaching = userHas(me, "teaching.manage");

  // Local time in Lima for greeting + date, independent of server TZ.
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("es-PE", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Lima",
    }).format(now),
  );
  const rawDate = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(now);
  // Solo la inicial en mayúscula ("Jueves, 20 de agosto de 2026").
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

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
        take: 4,
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

  // ── Postulaciones ────────────────────────────────────────────────────────
  let applicationsBlock: DashboardData["applications"] = null;
  let recentApplications: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    diploma: { code: string };
  }[] = [];

  if (canApplications) {
    const since14 = new Date(now.getTime() - 14 * DAY_MS);
    const [byStatusRaw, total, recentRows] = await Promise.all([
      prisma.diplomaApplication.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.diplomaApplication.count(),
      prisma.diplomaApplication.findMany({
        where: { createdAt: { gte: since14 } },
        select: { createdAt: true },
      }),
    ]);
    const count = new Map<string, number>(
      byStatusRaw.map((r) => [String(r.status), r._count._all]),
    );

    // Serie diaria de los últimos 14 días (hora de Lima), con ceros.
    const buckets = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      buckets.set(limaDayKey(new Date(now.getTime() - i * DAY_MS)), 0);
    }
    let last7 = 0;
    let prev7 = 0;
    const cut7 = now.getTime() - 7 * DAY_MS;
    for (const r of recentRows) {
      const k = limaDayKey(r.createdAt);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      if (r.createdAt.getTime() >= cut7) last7++;
      else prev7++;
    }

    applicationsBlock = {
      total,
      pending: count.get("pending") ?? 0,
      reviewing: count.get("reviewing") ?? 0,
      accepted: count.get("accepted") ?? 0,
      rejected: count.get("rejected") ?? 0,
      waitlist: count.get("waitlist") ?? 0,
      last7,
      prev7,
      byStatus: APP_STATUS_META.map(
        (m): StatusSlice => ({
          key: m.key,
          label: m.label,
          token: m.token,
          count: count.get(m.key) ?? 0,
        }),
      ),
      daily: Array.from(buckets, ([day, c]) => ({ day, count: c })),
    };

    recentApplications = await prisma.diplomaApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        diploma: { select: { code: true } },
      },
    });
  }

  // ── Matrículas ───────────────────────────────────────────────────────────
  let enrollmentsBlock: DashboardData["enrollments"] = null;
  let recentEnrollments: {
    id: string;
    createdAt: Date;
    student: { user: { name: string } };
    diploma: { code: string };
  }[] = [];

  if (canEnrollments) {
    const [byStatusRaw, last30] = await Promise.all([
      prisma.enrollment.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.enrollment.count({
        where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      }),
    ]);
    const count = new Map<string, number>(
      byStatusRaw.map((r) => [String(r.status), r._count._all]),
    );
    enrollmentsBlock = {
      active: count.get("active") ?? 0,
      completed: count.get("completed") ?? 0,
      withdrawn: count.get("withdrawn") ?? 0,
      last30,
    };
    recentEnrollments = await prisma.enrollment.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        createdAt: true,
        student: { select: { user: { select: { name: true } } } },
        diploma: { select: { code: true } },
      },
    });
  }

  // ── Diplomados (tabla con avance de matrícula) ───────────────────────────
  let diplomasBlock: DashboardData["diplomas"] = null;
  if (canDiplomas) {
    const rows = await prisma.diploma.findMany({
      orderBy: [{ status: "asc" }, { order: "asc" }, { title: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        admissionLabel: true,
        minEnrollment: true,
        _count: { select: { modules: true, applications: true } },
        enrollments: { where: { status: "active" }, select: { id: true } },
        applications: { where: { status: "pending" }, select: { id: true } },
      },
    });
    const mapped: DiplomaRow[] = rows.map((d) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      status: d.status,
      admissionLabel: d.admissionLabel,
      minEnrollment: d.minEnrollment,
      enrolled: d.enrollments.length,
      pendingApplications: canApplications ? d.applications.length : 0,
      totalApplications: canApplications ? d._count.applications : 0,
      moduleCount: d._count.modules,
    }));
    // Publicados primero; dentro de cada grupo, los que más atención piden.
    const rank = { published: 0, draft: 1, closed: 2 } as const;
    mapped.sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        b.pendingApplications - a.pendingApplications ||
        a.title.localeCompare(b.title, "es"),
    );
    diplomasBlock = {
      published: mapped.filter((d) => d.status === "published").length,
      draft: mapped.filter((d) => d.status === "draft").length,
      closed: mapped.filter((d) => d.status === "closed").length,
      rows: mapped,
    };
  }

  // ── Próximas sesiones de clase (7 días) ──────────────────────────────────
  let sessions: UpcomingSession[] = [];
  if (canDiplomas || canTeaching) {
    const rows = await prisma.moduleSession.findMany({
      where: {
        date: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
        // Los docentes sin permiso global solo ven sus propias sesiones.
        ...(canDiplomas
          ? {}
          : { module: { teacher: { userId: me.id } } }),
      },
      orderBy: { date: "asc" },
      take: 6,
      select: {
        id: true,
        date: true,
        topic: true,
        module: {
          select: {
            name: true,
            diploma: { select: { code: true, title: true } },
            teacher: { select: { user: { select: { name: true } } } },
          },
        },
      },
    });
    sessions = rows.map((s) => ({
      id: s.id,
      at: s.date.toISOString(),
      topic: s.topic,
      moduleName: s.module.name,
      diplomaCode: s.module.diploma.code,
      diplomaTitle: s.module.diploma.title,
      teacher: s.module.teacher?.user.name ?? null,
    }));
  }

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
        take: 4,
        select: { id: true, code: true, title: true, createdAt: true },
      }),
      prisma.incidentStatusLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
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
    ...recentApplications.map(
      (a): ActivityItem => ({
        id: `a-${a.id}`,
        icon: "inbox",
        tone: "blue",
        title: `${a.firstName} ${a.lastName}`,
        sub: `Postuló a ${a.diploma.code} · ${a.code}`,
        at: a.createdAt.toISOString(),
        href: "/postulaciones",
      }),
    ),
    ...recentEnrollments.map(
      (e): ActivityItem => ({
        id: `e-${e.id}`,
        icon: "award",
        tone: "green",
        title: e.student.user.name,
        sub: `Matriculado en ${e.diploma.code}`,
        at: e.createdAt.toISOString(),
        href: "/matriculas",
      }),
    ),
    ...recentUsers.map(
      (u): ActivityItem => ({
        id: `u-${u.id}`,
        icon: "user",
        tone: "violet",
        title: u.name,
        sub: "Nuevo usuario",
        at: u.createdAt.toISOString(),
        href: "/usuarios",
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
        href: "/incidentes",
      }),
    ),
    ...recentStatus.map(
      (s): ActivityItem => ({
        id: `s-${s.id}`,
        icon: "check",
        tone: "neutral",
        title: s.incident.code,
        sub: `${statusLabel(s.fromStatus)} → ${statusLabel(s.toStatus)}`,
        at: s.createdAt.toISOString(),
        href: "/incidentes",
      }),
    ),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  // ── Quick actions (permission-gated) ─────────────────────────────────────
  const quickActions: QuickAction[] = [];
  if (canApplications)
    quickActions.push({
      label: "Revisar postulaciones",
      desc: "Evalúa expedientes y admite",
      href: "/postulaciones",
      icon: "inbox",
      badge: applicationsBlock?.pending || undefined,
    });
  if (userHas(me, "enrollments.write"))
    quickActions.push({
      label: "Registrar matrícula",
      desc: "Alta manual o desde una postulación",
      href: "/matriculas",
      icon: "award",
    });
  if (userHas(me, "diplomas.write"))
    quickActions.push({
      label: "Editar diplomados",
      desc: "Módulos, costos y publicación",
      href: "/diplomados",
      icon: "cloud",
    });
  if (canTeaching)
    quickActions.push({
      label: "Mi docencia",
      desc: "Sesiones, asistencia y notas",
      href: "/docencia",
      icon: "rules",
    });
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

  // ── Resumen de una línea ─────────────────────────────────────────────────
  const bits: string[] = [];
  if (applicationsBlock)
    bits.push(
      plural(
        applicationsBlock.pending,
        "postulación pendiente",
        "postulaciones pendientes",
      ),
    );
  if (sessions.length)
    bits.push(
      plural(sessions.length, "sesión esta semana", "sesiones esta semana"),
    );
  if (incidentsBlock && incidentsBlock.open > 0)
    bits.push(
      plural(incidentsBlock.open, "incidente abierto", "incidentes abiertos"),
    );
  const summary = bits.length
    ? `Tienes ${bits.join(", ")}.`
    : "Todo al día. No hay tareas pendientes por ahora.";

  const data: DashboardData = {
    firstName: me.name.split(/\s+/)[0] ?? me.name,
    greeting: greetingFor(hour),
    dateLabel,
    summary,
    users: usersBlock,
    roles: rolesBlock,
    incidents: incidentsBlock,
    applications: applicationsBlock,
    enrollments: enrollmentsBlock,
    diplomas: diplomasBlock,
    sessions,
    activity,
    quickActions: quickActions.slice(0, 5),
  };

  return <DashboardView data={data} nowMs={now.getTime()} />;
}
