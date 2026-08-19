"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import type { ActionResult, GeneralInput, ListsInput, MetricsInput, ModuleInput } from "./types";

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

/* ────────────────────────────── módulos ────────────────────────────── */

export async function saveModule(
  diplomaId: string,
  input: ModuleInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const errs: Record<string, string> = {};
  const code = (input.code ?? "").trim().toUpperCase();
  if (code.length < 2 || code.length > 20) errs.code = "Código de 2 a 20 caracteres.";
  const name = reqStr(input.name, "name", "El nombre", errs, 160);
  const summary = reqStr(input.summary, "summary", "La sumilla", errs, 2000);
  const syncHours = nonNegInt(input.syncHours, "syncHours", errs, 1000);
  const asyncHours = nonNegInt(input.asyncHours, "asyncHours", errs, 1000);
  const credits = nonNegInt(input.credits, "credits", errs, 100);
  if (Object.keys(errs).length > 0) {
    return { ok: false, error: "Revisa los campos del módulo.", fieldErrors: errs };
  }

  const diploma = await prisma.diploma.findUnique({
    where: { id: diplomaId },
    select: { slug: true, _count: { select: { modules: true } } },
  });
  if (!diploma) return { ok: false, error: "Diplomado no encontrado." };

  if (input.teacherId) {
    const teacher = await prisma.teacherProfile.findUnique({ where: { id: input.teacherId } });
    if (!teacher) return { ok: false, error: "El docente seleccionado no existe." };
  }

  const topics = Array.isArray(input.topics)
    ? input.topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 300)
        .slice(0, 30)
    : [];

  const data = {
    code,
    name,
    summary,
    syncHours,
    asyncHours,
    totalHours: syncHours + asyncHours,
    credits,
    topics,
    teacherId: input.teacherId || null,
  };

  try {
    let id: string;
    if (input.id) {
      const updated = await prisma.diplomaModule.update({
        where: { id: input.id },
        data,
        select: { id: true },
      });
      id = updated.id;
    } else {
      const created = await prisma.diplomaModule.create({
        data: { ...data, diplomaId, order: diploma._count.modules + 1 },
        select: { id: true },
      });
      id = created.id;
    }
    revalidateDiploma(diploma.slug);
    return { ok: true, data: { id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un módulo con ese código en este diplomado.", fieldErrors: { code: "Código en uso." } };
    }
    console.error("saveModule", e);
    return { ok: false, error: "No se pudo guardar el módulo." };
  }
}

export async function deleteModule(moduleId: string): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: { diplomaId: true, order: true, diploma: { select: { slug: true } } },
  });
  if (!mod) return { ok: false, error: "Módulo no encontrado." };

  await prisma.$transaction(async (tx) => {
    await tx.diplomaModule.delete({ where: { id: moduleId } });
    // Compacta el orden de los módulos restantes.
    await tx.diplomaModule.updateMany({
      where: { diplomaId: mod.diplomaId, order: { gt: mod.order } },
      data: { order: { decrement: 1 } },
    });
  });
  revalidateDiploma(mod.diploma.slug);
  return { ok: true };
}

export async function moveModule(
  moduleId: string,
  dir: "up" | "down",
): Promise<ActionResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;

  const mod = await prisma.diplomaModule.findUnique({
    where: { id: moduleId },
    select: { id: true, diplomaId: true, order: true, diploma: { select: { slug: true } } },
  });
  if (!mod) return { ok: false, error: "Módulo no encontrado." };

  const targetOrder = dir === "up" ? mod.order - 1 : mod.order + 1;
  const neighbor = await prisma.diplomaModule.findFirst({
    where: { diplomaId: mod.diplomaId, order: targetOrder },
    select: { id: true },
  });
  if (!neighbor) return { ok: true }; // ya está en el extremo

  await prisma.$transaction([
    prisma.diplomaModule.update({ where: { id: neighbor.id }, data: { order: mod.order } }),
    prisma.diplomaModule.update({ where: { id: mod.id }, data: { order: targetOrder } }),
  ]);
  revalidateDiploma(mod.diploma.slug);
  return { ok: true };
}
