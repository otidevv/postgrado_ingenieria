export type DiplomaStatus = "draft" | "published" | "closed";

export type DiplomaRow = {
  id: string;
  slug: string;
  code: string;
  title: string;
  subtitle: string | null;
  status: DiplomaStatus;
  featured: boolean;
  moduleCount: number;
  totalHours: number;
  credits: number;
  updatedAt: string;
  applicationCount: number;
};

export type DiplomaPerms = {
  canWrite: boolean;
};

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
