"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import type { ActionResult, GeneralInput, ListsInput, MetricsInput } from "./types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function authorizeWrite(): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }
  return { ok: true };
}

function revalidateDiploma(slug: string) {
  revalidatePath("/diplomados");
  revalidatePath(`/diplomados`, "layout");
  revalidatePath("/");
  revalidatePath(`/diplomado/${slug}`);
}

function reqStr(v: unknown, field: string, label: string, errs: Record<string, string>, max = 5000): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length === 0) errs[field] = `${label} es obligatorio.`;
  else if (s.length > max) errs[field] = `Máximo ${max} caracteres.`;
  return s;
}

function nonNegInt(v: unknown, field: string, errs: Record<string, string>, max = 100000): number {
  const n = typeof v === "number" ? v : NaN;
  if (!Number.isInteger(n) || n < 0 || n > max) {
    errs[field] = "Debe ser un número entero no negativo.";
    return 0;
  }
  return n;
}

/* ─────────────────────────── updateDiplomaGeneral ─────────────────────────── */

export async function updateDiplomaGeneral(
  id: string,
  input: GeneralInput,
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const errs: Record<string, string> = {};
  const title = reqStr(input.title, "title", "El título", errs, 200);
  const summary = reqStr(input.summary, "summary", "El resumen", errs, 600);
  const description = reqStr(input.description, "description", "La descripción", errs);
  const objective = reqStr(input.objective, "objective", "El objetivo", errs);
  const faculty = reqStr(input.faculty, "faculty", "La facultad", errs, 160);
  const modality = reqStr(input.modality, "modality", "La modalidad", errs, 120);
  const schedule = reqStr(input.schedule, "schedule", "El horario", errs, 120);
  const slug = (input.slug ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug) || slug.length > 40) {
    errs.slug = "Solo minúsculas, números y guiones.";
  }
  const code = (input.code ?? "").trim().toUpperCase();
  if (code.length < 2 || code.length > 12) errs.code = "Código de 2 a 12 caracteres.";
  const order = nonNegInt(input.order, "order", errs, 999);
  if (Object.keys(errs).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors: errs };
  }

  try {
    const updated = await prisma.diploma.update({
      where: { id },
      data: {
        title,
        slug,
        code,
        subtitle: (input.subtitle ?? "").trim() || null,
        faculty,
        summary,
        description,
        objective,
        modality,
        schedule,
        admissionLabel: (input.admissionLabel ?? "").trim() || null,
        featured: input.featured === true,
        order,
      },
      select: { slug: true },
    });
    revalidateDiploma(updated.slug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ese slug o código ya existe.", fieldErrors: { slug: "Debe ser único." } };
    }
    console.error("updateDiplomaGeneral", e);
    return { ok: false, error: "No se pudo guardar los datos generales." };
  }
}

/* ─────────────────────────── updateDiplomaMetrics ─────────────────────────── */

export async function updateDiplomaMetrics(
  id: string,
  input: MetricsInput,
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const errs: Record<string, string> = {};
  const data = {
    totalHours: nonNegInt(input.totalHours, "totalHours", errs),
    credits: nonNegInt(input.credits, "credits", errs, 500),
    weeksPerModule: nonNegInt(input.weeksPerModule, "weeksPerModule", errs, 52),
    minEnrollment: nonNegInt(input.minEnrollment, "minEnrollment", errs, 10000),
    enrollmentFee: nonNegInt(input.enrollmentFee, "enrollmentFee", errs),
    moduleFee: nonNegInt(input.moduleFee, "moduleFee", errs),
    certificationFee: nonNegInt(input.certificationFee, "certificationFee", errs),
  };
  if (Object.keys(errs).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors: errs };
  }

  const updated = await prisma.diploma
    .update({ where: { id }, data, select: { slug: true } })
    .catch(() => null);
  if (!updated) return { ok: false, error: "Diplomado no encontrado." };
  revalidateDiploma(updated.slug);
  return { ok: true };
}

/* ──────────────────────────── updateDiplomaLists ──────────────────────────── */

function cleanList(v: unknown, max = 30): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 500)
    .slice(0, max);
}

export async function updateDiplomaLists(
  id: string,
  input: ListsInput,
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const updated = await prisma.diploma
    .update({
      where: { id },
      data: {
        objectives: cleanList(input.objectives),
        requirements: cleanList(input.requirements),
        graduateProfile: cleanList(input.graduateProfile),
      },
      select: { slug: true },
    })
    .catch(() => null);
  if (!updated) return { ok: false, error: "Diplomado no encontrado." };
  revalidateDiploma(updated.slug);
  return { ok: true };
}
