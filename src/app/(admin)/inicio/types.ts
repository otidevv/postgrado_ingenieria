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

export type ActivityItem = {
  id: string;
  icon: IconName;
  tone: "blue" | "amber" | "green" | "neutral";
  title: string;
  sub: string;
  at: string; // ISO
};

export type QuickAction = {
  label: string;
  desc: string;
  href: string;
  icon: IconName;
};

export type DashboardData = {
  firstName: string;
  greeting: string;
  dateLabel: string;
  users: UserStats | null;
  roles: { total: number; distribution: RoleDist[] } | null;
  incidents: IncidentStats | null;
  activity: ActivityItem[];
  quickActions: QuickAction[];
};
