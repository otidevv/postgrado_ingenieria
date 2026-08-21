// Constantes, tipos y validación de las postulaciones a diplomados.
// Este módulo es "isomórfico": no importa nada de Node ni de Prisma para que
// pueda usarse tanto en el formulario cliente como en el Server Action.

export const DOC_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "CE", label: "Carné de extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["value"];

export const ACADEMIC_DEGREES = [
  "Egresado(a)",
  "Bachiller",
  "Título profesional",
  "Segunda especialidad",
  "Maestría",
  "Doctorado",
] as const;

export const GENDERS = [
  { value: "F", label: "Femenino" },
  { value: "M", label: "Masculino" },
  { value: "X", label: "Prefiero no indicar" },
] as const;

// Estados de una postulación (para el panel admin)
export const APPLICATION_STATUS = [
  { value: "pending", label: "Pendiente", badge: "badge--neutral" },
  { value: "reviewing", label: "En evaluación", badge: "badge--amber" },
  { value: "accepted", label: "Admitido", badge: "badge--green" },
  { value: "waitlist", label: "Lista de espera", badge: "badge--amber" },
  { value: "rejected", label: "No admitido", badge: "badge--red" },
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number]["value"];

// ─────────── Documentos que se suben ───────────
export type DocSlot = {
  kind: string;
  label: string;
  required: boolean;
  hint: string;
};

export const DOCUMENT_SLOTS: DocSlot[] = [
  {
    kind: "identidad",
    label: "Documento de identidad",
    required: true,
    hint: "DNI, carné de extranjería o pasaporte (PDF o imagen).",
  },
  {
    kind: "grado",
    label: "Grado o título académico",
    required: true,
    hint: "Bachiller, título profesional o constancia de egreso.",
  },
  {
    kind: "cv",
    label: "Currículum vitae",
    required: false,
    hint: "CV documentado en PDF (opcional pero recomendado).",
  },
  {
    kind: "pago",
    label: "Comprobante de pago de inscripción",
    required: false,
    hint: "Voucher o constancia de depósito, si ya realizaste el pago.",
  },
];

// ─────────── Pagos (vouchers) ───────────
// Códigos de pago que el postulante usa en el banco/caja. Son los mismos para
// todos los diplomados; si en el futuro varían por programa, mover a la BD.
export const PAYMENT_SLOTS = [
  {
    kind: "pago_matricula",
    label: "Voucher de matrícula",
    code: "494",
    hint: "Comprobante del pago de matrícula (código 494).",
  },
  {
    kind: "pago_mensualidad",
    label: "Voucher de mensualidad",
    code: "610",
    hint: "Comprobante del pago de la primera mensualidad (código 610).",
  },
] as const;
export type PaymentKind = (typeof PAYMENT_SLOTS)[number]["kind"];
export const PAYMENT_KINDS = PAYMENT_SLOTS.map((p) => p.kind) as PaymentKind[];

/** Estado de vouchers de una postulación (consulta pública por documento). */
export type VoucherLookup =
  | { found: false }
  | {
      found: true;
      code: string;
      firstName: string;
      diplomaTitle: string;
      uploaded: Record<PaymentKind, boolean>;
    };

export type VoucherSubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: FieldErrors }
  | { status: "success"; code: string; uploaded: Record<PaymentKind, boolean> };

export const INITIAL_VOUCHER_STATE: VoucherSubmitState = { status: "idle" };

// ─────────── Reglas de archivo ───────────
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB por archivo
export const ACCEPTED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp";

export const MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// ─────────── Validación de campos ───────────
export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Valida el número de documento según su tipo. Devuelve error o null. */
export function validateDocNumber(
  docType: string,
  value: string,
): string | null {
  const v = value.trim();
  if (!v) return "Ingresa tu número de documento.";
  if (docType === "DNI") {
    if (!/^\d{8}$/.test(v)) return "El DNI debe tener 8 dígitos.";
  } else if (docType === "CE") {
    if (!/^[a-zA-Z0-9]{9,12}$/.test(v))
      return "El carné de extranjería debe tener entre 9 y 12 caracteres.";
  } else if (docType === "PASAPORTE") {
    if (!/^[a-zA-Z0-9]{6,12}$/.test(v))
      return "El pasaporte debe tener entre 6 y 12 caracteres.";
  }
  return null;
}

export type FieldErrors = Record<string, string>;

// Estado del Server Action (para useActionState)
export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: FieldErrors; modal?: boolean }
  | { status: "success"; code: string; docNumber: string };

export const INITIAL_SUBMIT_STATE: SubmitState = { status: "idle" };

/** Formatea bytes en KB/MB legibles. */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
