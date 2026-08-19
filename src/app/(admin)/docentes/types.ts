export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type TeacherRow = {
  id: string; // TeacherProfile.id
  userId: string;
  name: string;
  email: string;
  academicDegree: string;
  specialty: string | null;
  bio: string | null;
  photoUrl: string | null;
  orcid: string | null;
  active: boolean;
  moduleCount: number;
};

export type TeacherProfileInput = {
  academicDegree: string;
  specialty?: string;
  bio?: string;
  photoUrl?: string;
  orcid?: string;
};

export type TeacherInput = TeacherProfileInput & {
  name: string;
  email: string;
  password: string;
  /** true = el email ya pertenece a un usuario y se aprobó convertirlo en docente. */
  convertExisting?: boolean;
};

export type TeacherPerms = { canWrite: boolean };
