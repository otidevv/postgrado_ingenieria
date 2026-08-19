export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type AttendanceStatus = "presente" | "tardanza" | "falta" | "justificada";

export type SessionRow = {
  id: string;
  date: string; // ISO
  topic: string;
  order: number;
  /** enrollmentId → estado registrado (ausente del mapa = sin registrar) */
  attendance: Record<string, AttendanceStatus>;
};

export type AssessmentKind = "tarea" | "trabajo" | "examen" | "participacion";

export type AssessmentRow = {
  id: string;
  title: string;
  description: string | null;
  kind: AssessmentKind;
  weight: number;
  dueDate: string | null; // ISO
  allowsSubmission: boolean;
};

/** Celda de nota: enrollmentId+assessmentId → score (null = sin calificar). */
export type GradeCell = { score: number | null; feedback: string | null };

export type MaterialRow = {
  id: string;
  title: string;
  url: string;
  order: number;
};

export type SubmissionInfo = {
  enrollmentId: string;
  assessmentId: string;
  fileName: string | null;
  linkUrl: string | null;
  submittedAt: string; // ISO
};
