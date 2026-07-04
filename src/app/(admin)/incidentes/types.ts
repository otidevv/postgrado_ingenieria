export const INCIDENT_STATUSES = [
  "open",
  "triaged",
  "in_progress",
  "resolved",
  "rejected",
  "closed",
] as const;
export type IncidentStatusKey = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type IncidentSeverityKey = (typeof INCIDENT_SEVERITIES)[number];

export const STATUS_LABEL: Record<IncidentStatusKey, string> = {
  open: "Abierto",
  triaged: "Clasificado",
  in_progress: "En progreso",
  resolved: "Resuelto",
  rejected: "Rechazado",
  closed: "Cerrado",
};

/** CSS var token suffix for `--st-<token>-bg/fg`. */
export const STATUS_TOKEN: Record<IncidentStatusKey, string> = {
  open: "open",
  triaged: "triaged",
  in_progress: "progress",
  resolved: "resolved",
  rejected: "rejected",
  closed: "closed",
};

export const SEVERITY_LABEL: Record<IncidentSeverityKey, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

export const SEVERITY_COLOR: Record<IncidentSeverityKey, string> = {
  low: "var(--sev-low)",
  medium: "var(--sev-medium)",
  high: "var(--sev-high)",
  critical: "var(--sev-critical)",
};

export type Person = { id: string; name: string; email: string };

export type IncidentRow = {
  id: string;
  code: string;
  title: string;
  status: IncidentStatusKey;
  severity: IncidentSeverityKey;
  categoryName: string | null;
  reporterName: string | null;
  assignee: { id: string; name: string } | null;
  createdAt: string;
};

export type CategoryOption = { id: string; key: string; name: string };

export type TimelineItem =
  | {
      kind: "comment";
      id: string;
      body: string;
      internal: boolean;
      author: string | null;
      at: string;
    }
  | {
      kind: "status";
      id: string;
      from: IncidentStatusKey;
      to: IncidentStatusKey;
      by: string | null;
      note: string | null;
      at: string;
    };

export type IncidentDetail = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: IncidentStatusKey;
  severity: IncidentSeverityKey;
  categoryName: string | null;
  locationText: string | null;
  lat: number | null;
  lng: number | null;
  reporter: Person | null;
  assignee: Person | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  timeline: TimelineItem[];
};

export type PermFlags = {
  canWrite: boolean;
  canDelete: boolean;
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
