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
  createdAt: string;
};

export type ApplicationPerms = { canWrite: boolean };

export type ActionResult = { ok: true } | { ok: false; error: string };
