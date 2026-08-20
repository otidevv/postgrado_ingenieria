import type { IconName } from "@/components/admin/Icon";

export type UserStats = {
  total: number;
  active: number;
  suspended: number;
};

export type RoleDist = {
  name: string;
  count: number;
  system: boolean;
};

export type StatusSlice = {
  key: string;
  label: string;
  count: number;
  /** CSS var prefix, e.g. "open" → var(--st-open-bg/fg) */
  token: string;
};

export type SeveritySlice = {
  key: string;
  label: string;
  count: number;
  /** CSS var name for the fill color */
  color: string;
};

export type IncidentStats = {
  total: number;
  open: number;
  critical: number;
  resolved: number;
  byStatus: StatusSlice[];
  bySeverity: SeveritySlice[];
};

/** Postulaciones a diplomados */
export type ApplicationStats = {
  total: number;
  pending: number;
  reviewing: number;
  accepted: number;
  rejected: number;
  waitlist: number;
  /** Recibidas en los últimos 7 días */
  last7: number;
  /** Recibidas en los 7 días anteriores a esos (para la variación) */
  prev7: number;
  byStatus: StatusSlice[];
  /** Postulaciones por día, últimos 14 días (índice 0 = hace 13 días) */
  daily: { day: string; count: number }[];
};

/** Matrículas */
export type EnrollmentStats = {
  active: number;
  completed: number;
  withdrawn: number;
  last30: number;
};

/** Fila de la tabla "Diplomados" */
export type DiplomaRow = {
  id: string;
  code: string;
  title: string;
  status: "draft" | "published" | "closed";
  admissionLabel: string | null;
  minEnrollment: number;
  enrolled: number;
  pendingApplications: number;
  totalApplications: number;
  moduleCount: number;
};

export type DiplomaStats = {
  published: number;
  draft: number;
  closed: number;
  rows: DiplomaRow[];
};

/** Próxima sesión de clase */
export type UpcomingSession = {
  id: string;
  at: string; // ISO
  topic: string;
  moduleName: string;
  diplomaCode: string;
  diplomaTitle: string;
  teacher: string | null;
};

export type ActivityItem = {
  id: string;
  icon: IconName;
  tone: "blue" | "amber" | "green" | "violet" | "neutral";
  title: string;
  sub: string;
  at: string; // ISO
  href?: string;
};

export type QuickAction = {
  label: string;
  desc: string;
  href: string;
  icon: IconName;
  /** Contador opcional (p. ej. postulaciones pendientes) */
  badge?: number;
};

export type DashboardData = {
  firstName: string;
  greeting: string;
  dateLabel: string;
  /** Resumen de una línea bajo el saludo */
  summary: string;
  users: UserStats | null;
  roles: { total: number; distribution: RoleDist[] } | null;
  incidents: IncidentStats | null;
  applications: ApplicationStats | null;
  enrollments: EnrollmentStats | null;
  diplomas: DiplomaStats | null;
  sessions: UpcomingSession[];
  activity: ActivityItem[];
  quickActions: QuickAction[];
};
