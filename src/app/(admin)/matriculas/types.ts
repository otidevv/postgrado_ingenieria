export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type EnrollmentStatus = "active" | "withdrawn" | "completed";

export type EnrollmentRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  docLabel: string; // "DNI 12345678"
  diplomaId: string;
  diplomaTitle: string;
  origin: "postulacion" | "manual";
  applicationCode: string | null; // código de la postulación de origen
  status: EnrollmentStatus;
  createdAt: string; // ISO
};

export type ManualEnrollInput = {
  name: string;
  email: string;
  password: string; // contraseña temporal elegida por el admin
  docType: "DNI" | "CE" | "PASAPORTE";
  docNumber: string;
  phone?: string;
  diplomaId: string;
};

/** Resultado de una matrícula. tempPassword solo cuando se creó cuenta nueva. */
export type EnrollOutcome = {
  enrollmentId: string;
  studentEmail: string;
  tempPassword: string | null;
};

export type EnrollPerms = { canWrite: boolean };

export type DiplomaOption = { id: string; title: string };
