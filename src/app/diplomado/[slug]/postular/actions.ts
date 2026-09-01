"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/applications-storage";
import {
  ACCEPTED_MIME,
  APPLY_PAYMENT_SLOTS,
  DOC_TYPES,
  DOCUMENT_SLOTS,
  MAX_FILE_BYTES,
  PAYMENT_SLOTS,
  fmtBytes,
  isEmail,
  validateDocNumber,
  type FieldErrors,
  type PaymentKind,
  type SubmitState,
  type VoucherLookup,
  type VoucherMap,
  type VoucherSubmitState,
  normalizeReceipt,
  parsePeDate,
} from "@/lib/applications";

const DOC_TYPE_VALUES = DOC_TYPES.map((d) => d.value) as string[];

/** Genera un código único POST-AAAA-NNNNN, reintentando ante colisión. */
async function createWithUniqueCode(
  data: Omit<Prisma.DiplomaApplicationCreateInput, "code">,
): Promise<{ id: string; code: string }> {
  const year = new Date().getFullYear();
  const base = await prisma.diplomaApplication.count();
  for (let attempt = 0; attempt < 6; attempt++) {
    const n = base + 1 + attempt;
    const code = `POST-${year}-${String(n).padStart(5, "0")}`;
    try {
      const created = await prisma.diplomaApplication.create({
        data: { ...data, code },
        select: { id: true, code: true },
      });
      return created;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        Array.isArray(e.meta?.target) &&
        (e.meta.target as string[]).includes("code")
      ) {
        continue; // colisión de código: reintenta con el siguiente
      }
      throw e;
    }
  }
  throw new Error("No se pudo generar un código de postulación único.");
}

export async function submitApplication(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const s = (name: string) => String(formData.get(name) ?? "").trim();
  const opt = (name: string) => {
    const v = s(name);
    return v.length ? v : null;
  };

  const slug = s("slug");
  const diploma = await prisma.diploma.findFirst({
    where: { slug, status: "published" },
    select: { id: true, title: true },
  });
  if (!diploma) {
    return {
      status: "error",
      modal: true,
      message: "El diplomado no está disponible para postulación.",
    };
  }

  const fieldErrors: FieldErrors = {};

  // ── Identidad ──
  const docType = s("docType");
  if (!DOC_TYPE_VALUES.includes(docType))
    fieldErrors.docType = "Selecciona un tipo de documento.";
  const docNumber = s("docNumber");
  const docErr = validateDocNumber(docType, docNumber);
  if (docErr) fieldErrors.docNumber = docErr;

  const firstName = s("firstName");
  if (!firstName) fieldErrors.firstName = "Ingresa tus nombres.";
  const lastName = s("lastName");
  if (!lastName) fieldErrors.lastName = "Ingresa tus apellidos.";

  // ── Contacto ──
  const email = s("email");
  if (!email) fieldErrors.email = "Ingresa tu correo electrónico.";
  else if (!isEmail(email)) fieldErrors.email = "El correo no es válido.";
  const phone = s("phone");
  if (!phone) fieldErrors.phone = "Ingresa un teléfono o celular.";

  // ── Consentimiento ──
  if (!formData.get("consent"))
    fieldErrors.consent =
      "Debes aceptar el tratamiento de tus datos para continuar.";

  // ── Archivos ──
  const filesToSave: { kind: string; label: string; file: File }[] = [];
  for (const slot of DOCUMENT_SLOTS) {
    const f = formData.get(slot.kind);
    const file = f instanceof File && f.size > 0 ? f : null;
    if (!file) continue; // documentos opcionales por ahora (se regulará más adelante)
    if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
      fieldErrors[slot.kind] = "Formato no permitido (usa PDF, JPG, PNG o WEBP).";
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      fieldErrors[slot.kind] = `El archivo supera el máximo de ${fmtBytes(
        MAX_FILE_BYTES,
      )}.`;
      continue;
    }
    filesToSave.push({ kind: slot.kind, label: slot.label, file });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Revisa los campos marcados y vuelve a intentarlo.",
      fieldErrors,
    };
  }

  // ── Duplicado (mismo documento + diplomado) ──
  // No se bloquea: se lleva al postulante directo al paso de vouchers.
  const existing = await prisma.diplomaApplication.findUnique({
    where: { diplomaId_docNumber: { diplomaId: diploma.id, docNumber } },
    select: { code: true },
  });
  if (existing) {
    return { status: "duplicate", code: existing.code, docNumber };
  }

  // ── Crear postulación ──
  const birthRaw = opt("birthDate");
  let created: { id: string; code: string };
  try {
    created = await createWithUniqueCode({
      diploma: { connect: { id: diploma.id } },
      docType: docType as Prisma.DiplomaApplicationCreateInput["docType"],
      docNumber,
      firstName,
      lastName,
      birthDate: birthRaw ? new Date(birthRaw) : null,
      gender: opt("gender"),
      email,
      phone,
      address: opt("address"),
      region: opt("region"),
      province: opt("province"),
      district: opt("district"),
      academicDegree: opt("academicDegree"),
      profession: opt("profession"),
      university: opt("university"),
      employer: opt("employer"),
      position: opt("position"),
      modality: opt("modality"),
      motivation: opt("motivation"),
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      // Carrera: alguien registró el mismo documento entre la verificación
      // y el create. Se resuelve igual que el duplicado normal.
      const dup = await prisma.diplomaApplication.findUnique({
        where: { diplomaId_docNumber: { diplomaId: diploma.id, docNumber } },
        select: { code: true },
      });
      if (dup) {
        return { status: "duplicate", code: dup.code, docNumber };
      }
      return {
        status: "error",
        modal: true,
        message:
          "Ya existe una postulación con este documento para este diplomado.",
        fieldErrors: { docNumber: "Este documento ya postuló a este diplomado." },
      };
    }
    console.error("submitApplication: error creando postulación", e);
    return {
      status: "error",
      modal: true,
      message: "Ocurrió un error al registrar tu postulación. Inténtalo de nuevo.",
    };
  }

  // ── Guardar archivos en disco + registrar en BD ──
  try {
    for (const item of filesToSave) {
      const { storedPath, sizeBytes } = await saveUploadedFile(
        created.id,
        item.kind,
        item.file,
      );
      await prisma.applicationDocument.create({
        data: {
          applicationId: created.id,
          kind: item.kind,
          label: item.label,
          fileName: item.file.name,
          storedPath,
          mimeType: item.file.type,
          sizeBytes,
        },
      });
    }
  } catch (e) {
    // Rollback: si falla el guardado de archivos, elimina la postulación.
    console.error("submitApplication: error guardando archivos", e);
    await prisma.diplomaApplication
      .delete({ where: { id: created.id } })
      .catch(() => undefined);
    return {
      status: "error",
      modal: true,
      message: "No se pudieron guardar los documentos. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/postulaciones");
  return { status: "success", code: created.code, docNumber };
}

/* ════════════════════════════════════════════════════════════════
   Vouchers de pago (matrícula y mensualidad)
   El postulante los sube después de registrarse, identificándose solo
   con su número de documento. Se guardan como ApplicationDocument con
   kind "pago_matricula" / "pago_mensualidad"; volver a subir reemplaza.
   ════════════════════════════════════════════════════════════════ */

function emptyUploaded(): VoucherMap {
  return { pago_matricula: null, pago_mensualidad: null };
}

/** Carga los vouchers de una postulación como mapa por tipo. */
async function voucherMapFor(applicationId: string): Promise<VoucherMap> {
  const docs = await prisma.applicationDocument.findMany({
    where: { applicationId, kind: { in: PAYMENT_SLOTS.map((p) => p.kind) } },
    select: { kind: true, receiptNumber: true, paidAt: true },
  });
  const map = emptyUploaded();
  for (const d of docs) {
    map[d.kind as PaymentKind] = {
      receiptNumber: d.receiptNumber,
      paidAt: d.paidAt ? d.paidAt.toISOString() : null,
    };
  }
  return map;
}


/** Busca la postulación por diplomado + documento y dice qué vouchers tiene. */
export async function lookupVouchers(
  slug: string,
  docNumber: string,
): Promise<VoucherLookup> {
  const doc = docNumber.trim();
  if (!slug || doc.length < 6 || doc.length > 20) return { found: false };

  const app = await prisma.diplomaApplication.findFirst({
    where: { docNumber: doc, diploma: { slug } },
    select: {
      id: true,
      code: true,
      firstName: true,
      diploma: { select: { title: true } },
    },
  });
  if (!app) return { found: false };

  return {
    found: true,
    code: app.code,
    // Solo el primer nombre: es una consulta pública sin autenticación.
    firstName: app.firstName.split(/\s+/)[0] ?? "",
    diplomaTitle: app.diploma.title,
    uploaded: await voucherMapFor(app.id),
  };
}

export async function submitVouchers(
  _prev: VoucherSubmitState,
  formData: FormData,
): Promise<VoucherSubmitState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const docNumber = String(formData.get("docNumber") ?? "").trim();
  const fieldErrors: FieldErrors = {};

  if (docNumber.length < 6 || docNumber.length > 20) {
    fieldErrors.docNumber = "Ingresa tu número de documento.";
  }

  const files: {
    kind: PaymentKind;
    label: string;
    file: File;
    receiptNumber: string;
    paidAt: Date;
  }[] = [];
  const today = new Date();
  // Solo se aceptan los vouchers que se piden al postular (matrícula);
  // la mensualidad se regulariza después desde el panel de admin.
  for (const slot of APPLY_PAYMENT_SLOTS) {
    const f = formData.get(slot.kind);
    const file = f instanceof File && f.size > 0 ? f : null;
    if (!file) continue;
    let ok = true;
    if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
      fieldErrors[slot.kind] = "Formato no permitido (usa PDF, JPG, PNG o WEBP).";
      ok = false;
    } else if (file.size > MAX_FILE_BYTES) {
      fieldErrors[slot.kind] = `El archivo supera el máximo de ${fmtBytes(MAX_FILE_BYTES)}.`;
      ok = false;
    }
    // Número de recibo y fecha de pago: obligatorios junto con el archivo.
    const receiptRaw = String(formData.get(`${slot.kind}_receipt`) ?? "");
    const receiptNumber = normalizeReceipt(receiptRaw);
    if (!receiptNumber) {
      fieldErrors[`${slot.kind}_receipt`] = receiptRaw.trim()
        ? "Usa el formato 002 - 00060299 (3 dígitos, guion, 8 dígitos)."
        : "Ingresa el número de recibo.";
      ok = false;
    }
    const paidRaw = String(formData.get(`${slot.kind}_paidAt`) ?? "");
    const paidAt = parsePeDate(paidRaw);
    if (!paidAt) {
      fieldErrors[`${slot.kind}_paidAt`] = paidRaw.trim()
        ? "Fecha no válida. Usa el formato dd/mm/aaaa."
        : "Ingresa la fecha de pago.";
      ok = false;
    } else if (paidAt.getTime() > today.getTime() + 86_400_000) {
      fieldErrors[`${slot.kind}_paidAt`] = "La fecha de pago no puede ser futura.";
      ok = false;
    }
    if (!ok || !receiptNumber || !paidAt) continue;
    files.push({
      kind: slot.kind,
      label: `${slot.label} (código ${slot.code})`,
      file,
      receiptNumber,
      paidAt,
    });
  }
  if (files.length === 0 && Object.keys(fieldErrors).length === 0) {
    fieldErrors.files = "Adjunta tu voucher de matrícula.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Revisa los campos marcados y vuelve a intentarlo.",
      fieldErrors,
    };
  }

  const app = await prisma.diplomaApplication.findFirst({
    where: { docNumber, diploma: { slug } },
    select: { id: true, code: true },
  });
  if (!app) {
    return {
      status: "error",
      message:
        "No encontramos una postulación con ese documento para este diplomado. Verifica el número o registra tu postulación primero.",
      fieldErrors: { docNumber: "No hay postulación con este documento." },
    };
  }

  try {
    for (const item of files) {
      const { storedPath, sizeBytes } = await saveUploadedFile(
        app.id,
        item.kind,
        item.file,
      );
      // Reemplaza el voucher anterior del mismo tipo (si lo hubiera).
      await prisma.$transaction([
        prisma.applicationDocument.deleteMany({
          where: { applicationId: app.id, kind: item.kind },
        }),
        prisma.applicationDocument.create({
          data: {
            applicationId: app.id,
            kind: item.kind,
            label: item.label,
            fileName: item.file.name,
            storedPath,
            mimeType: item.file.type,
            sizeBytes,
            receiptNumber: item.receiptNumber,
            paidAt: item.paidAt,
          },
        }),
      ]);
    }
  } catch (e) {
    console.error("submitVouchers: error guardando vouchers", e);
    return {
      status: "error",
      message: "No se pudieron guardar los vouchers. Inténtalo de nuevo.",
    };
  }

  const uploaded = await voucherMapFor(app.id);

  revalidatePath("/postulaciones");
  revalidatePath(`/postulaciones/${app.id}`);
  return { status: "success", code: app.code, uploaded };
}
