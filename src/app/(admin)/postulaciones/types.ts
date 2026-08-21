import type { ApplicationStatus } from "@/lib/applications";

export type { ApplicationStatus };

export type ApplicationRow = {
  id: string;
  code: string;
  fullName: string;
  docType: string;
  docNumber: string;
  email: string;
  phone: string;
  diplomaTitle: string;
  status: ApplicationStatus;
  docCount: number;
  /** Vouchers de pago recibidos */
  hasMatricula: boolean;
  hasMensualidad: boolean;
  /** Números de recibo (normalizados) si existen */
  receiptMatricula: string | null;
  receiptMensualidad: string | null;
  createdAt: string;
};

export type ApplicationPerms = { canWrite: boolean };

export type ActionResult = { ok: true } | { ok: false; error: string };
