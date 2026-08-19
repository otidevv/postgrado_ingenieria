"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult, DiplomaStatus } from "./types";

const VALID: DiplomaStatus[] = ["draft", "published", "closed"];

/** Cambia el estado (visibilidad pública) de un diplomado. Requiere diplomas.write. */
export async function setDiplomaStatus(
  id: string,
  status: DiplomaStatus,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }
  if (!VALID.includes(status)) {
    return { ok: false, error: "Estado inválido." };
  }

  const updated = await prisma.diploma
    .update({ where: { id }, data: { status }, select: { slug: true } })
    .catch(() => null);

  if (!updated) return { ok: false, error: "No se pudo actualizar el diplomado." };

  // Refresca el panel y las vistas públicas afectadas.
  revalidatePath("/diplomados");
  revalidatePath("/");
  revalidatePath(`/diplomado/${updated.slug}`);
  return { ok: true };
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Crea un diplomado en borrador con los datos mínimos. Requiere diplomas.write. */
export async function createDiploma(input: {
  title: string;
  slug: string;
  code: string;
}): Promise<ActionResult<{ id: string }>> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }

  const title = (input.title ?? "").trim();
  const slug = (input.slug ?? "").trim().toLowerCase();
  const code = (input.code ?? "").trim().toUpperCase();

  const fieldErrors: Record<string, string> = {};
  if (title.length < 3) fieldErrors.title = "El título es obligatorio.";
  if (!SLUG_RE.test(slug) || slug.length > 40)
    fieldErrors.slug = "Solo minúsculas, números y guiones (p. ej. gestion-publica).";
  if (code.length < 2 || code.length > 12)
    fieldErrors.code = "Código de 2 a 12 caracteres (p. ej. DGP).";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  try {
    const created = await prisma.diploma.create({
      data: {
        title,
        slug,
        code,
        subtitle: "Diplomado de Posgrado",
        faculty: "Facultad de Ingeniería · Unidad de Posgrado",
        summary: "",
        description: "",
        objective: "",
        status: "draft",
        modality: "Por definir",
        schedule: "Por definir",
        totalHours: 0,
        credits: 0,
        enrollmentFee: 0,
        moduleFee: 0,
        certificationFee: 0,
      },
      select: { id: true },
    });
    revalidatePath("/diplomados");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "Ese slug o código ya existe.",
        fieldErrors: { slug: "Debe ser único." },
      };
    }
    console.error("createDiploma", e);
    return { ok: false, error: "No se pudo crear el diplomado." };
  }
}

/** Elimina un diplomado SIN postulaciones. Requiere diplomas.write. */
export async function deleteDiploma(id: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("diplomas.write")) {
    return { ok: false, error: "No tienes permiso para gestionar diplomados." };
  }
  const target = await prisma.diploma.findUnique({
    where: { id },
    select: { slug: true, _count: { select: { applications: true } } },
  });
  if (!target) return { ok: false, error: "Diplomado no encontrado." };
  if (target._count.applications > 0) {
    return {
      ok: false,
      error:
        "Este diplomado tiene postulaciones registradas; ciérralo u ocúltalo en lugar de eliminarlo.",
    };
  }
  const deleted = await prisma.diploma.deleteMany({
    where: { id, applications: { none: {} } },
  });
  if (deleted.count === 0) {
    return {
      ok: false,
      error:
        "Este diplomado tiene postulaciones registradas; ciérralo u ocúltalo en lugar de eliminarlo.",
    };
  }
  revalidatePath("/diplomados");
  revalidatePath("/");
  revalidatePath(`/diplomado/${target.slug}`);
  return { ok: true };
}
