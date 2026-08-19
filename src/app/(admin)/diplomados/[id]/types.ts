export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type DiplomaStatus = "draft" | "published" | "closed";

export type EditorDiploma = {
  id: string;
  slug: string;
  code: string;
  title: string;
  subtitle: string | null;
  faculty: string;
  summary: string;
  description: string;
  objective: string;
  status: DiplomaStatus;
  modality: string;
  schedule: string;
  admissionLabel: string | null;
  featured: boolean;
  order: number;
  totalHours: number;
  credits: number;
  weeksPerModule: number;
  minEnrollment: number;
  enrollmentFee: number;
  moduleFee: number;
  certificationFee: number;
  objectives: string[];
  requirements: string[];
  graduateProfile: string[];
};

export type EditorModule = {
  id: string;
  code: string;
  order: number;
  name: string;
  syncHours: number;
  asyncHours: number;
  totalHours: number;
  credits: number;
  summary: string;
  topics: string[];
  teacherId: string | null;
};

export type TeacherOption = {
  id: string; // TeacherProfile.id
  label: string; // "Mg. Nelly Ulloa Gallardo"
};

export type EditorPerms = { canWrite: boolean };

export type GeneralInput = {
  title: string;
  slug: string;
  code: string;
  subtitle: string;
  faculty: string;
  summary: string;
  description: string;
  objective: string;
  modality: string;
  schedule: string;
  admissionLabel: string;
  featured: boolean;
  order: number;
};

export type MetricsInput = {
  totalHours: number;
  credits: number;
  weeksPerModule: number;
  minEnrollment: number;
  enrollmentFee: number;
  moduleFee: number;
  certificationFee: number;
};
