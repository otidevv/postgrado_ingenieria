"use server";

import { revalidatePath } from "next/cache";
import { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/server";
import type { PermissionKey } from "@/lib/auth/permissions";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  type ActionResult,
  type IncidentDetail,
  type IncidentSeverityKey,
  type IncidentStatusKey,
  type TimelineItem,
} from "./types";

const COMMENT_MIN = 1;
const COMMENT_MAX = 4000;
const NOTE_MAX = 500;

class Denied extends Error {}

async function authorize(perm: PermissionKey): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Denied("No autenticado.");
  if (!user.permissions.has(perm)) {
    throw new Denied("No tienes permisos para esta acción.");
  }
  return user;
}

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

function refresh() {
  revalidatePath("/incidentes");
  revalidatePath("/inicio");
}

function isStatus(v: unknown): v is IncidentStatusKey {
  return (
    typeof v === "string" &&
    (INCIDENT_STATUSES as readonly string[]).includes(v)
  );
}
function isSeverity(v: unknown): v is IncidentSeverityKey {
  return (
    typeof v === "string" &&
    (INCIDENT_SEVERITIES as readonly string[]).includes(v)
  );
}

/* ───────────────────────────── getIncidentDetail ───────────────────────────── */

export async function getIncidentDetail(
  code: string,
): Promise<ActionResult<IncidentDetail>> {
  try {
    const me = await authorize("incidents.read");

    const incident = await prisma.incident.findUnique({
      where: { code },
      include: {
        category: { select: { name: true } },
        reporter: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
        statusLog: {
          orderBy: { createdAt: "asc" },
          include: { byUser: { select: { name: true } } },
        },
      },
    });
    if (!incident) return fail("Incidente no encontrado.");

    // Internal comments are admin-only. Gate on write (incidents.read is the
    // entry precondition, so it would always be true and leak to viewers).
    const canInternal = me.permissions.has("incidents.write");
    const timeline: TimelineItem[] = [
      ...incident.comments
        .filter((c) => canInternal || !c.internal)
        .map(
          (c): TimelineItem => ({
            kind: "comment",
            id: c.id,
            body: c.body,
            internal: c.internal,
            author: c.author?.name ?? null,
            at: c.createdAt.toISOString(),
          }),
        ),
      ...incident.statusLog.map(
        (s): TimelineItem => ({
          kind: "status",
          id: s.id,
          from: s.fromStatus as IncidentStatusKey,
          to: s.toStatus as IncidentStatusKey,
          by: s.byUser?.name ?? null,
          note: s.note,
          at: s.createdAt.toISOString(),
        }),
      ),
    ].sort((a, b) => (a.at < b.at ? -1 : 1));

    return ok<IncidentDetail>({
      id: incident.id,
      code: incident.code,
      title: incident.title,
      description: incident.description,
      status: incident.status as IncidentStatusKey,
      severity: incident.severity as IncidentSeverityKey,
      categoryName: incident.category?.name ?? null,
      locationText: incident.locationText,
      lat: incident.lat,
      lng: incident.lng,
      reporter: incident.reporter,
      assignee: incident.assignedTo,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      timeline,
    });
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("getIncidentDetail", e);
    return fail("No se pudo cargar el incidente.");
  }
}

/* ───────────────────────────────── changeStatus ───────────────────────────────── */

export async function changeStatus(
  id: string,
  toStatus: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const me = await authorize("incidents.write");
    if (!isStatus(toStatus)) return fail("Estado no válido.");

    const current = await prisma.incident.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) return fail("Incidente no encontrado.");

    const from = current.status as IncidentStatusKey;
    if (from === toStatus) return ok();

    const trimmedNote =
      typeof note === "string" && note.trim()
        ? note.trim().slice(0, NOTE_MAX)
        : null;

    await prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id },
        data: {
          status: toStatus as $Enums.IncidentStatus,
          // null (not undefined) so reopening clears a stale resolution time.
          resolvedAt: toStatus === "resolved" ? new Date() : null,
        },
      });
      await tx.incidentStatusLog.create({
        data: {
          incidentId: id,
          fromStatus: from as $Enums.IncidentStatus,
          toStatus: toStatus as $Enums.IncidentStatus,
          byUserId: me.id,
          note: trimmedNote,
        },
      });
    });

    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("changeStatus", e);
    return fail("No se pudo cambiar el estado.");
  }
}

/* ───────────────────────────────── assignIncident ───────────────────────────────── */

export async function assignIncident(
  id: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  try {
    await authorize("incidents.write");

    if (assigneeId) {
      const user = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { active: true },
      });
      if (!user) return fail("El usuario asignado no existe.");
      if (!user.active) return fail("No puedes asignar a un usuario suspendido.");
    }

    await prisma.incident.update({
      where: { id },
      data: { assignedToId: assigneeId },
    });
    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("assignIncident", e);
    return fail("No se pudo asignar el incidente.");
  }
}

/* ───────────────────────────────── setSeverity ───────────────────────────────── */

export async function setSeverity(
  id: string,
  severity: string,
): Promise<ActionResult> {
  try {
    await authorize("incidents.write");
    if (!isSeverity(severity)) return fail("Severidad no válida.");

    await prisma.incident.update({
      where: { id },
      data: { severity: severity as $Enums.IncidentSeverity },
    });
    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("setSeverity", e);
    return fail("No se pudo cambiar la severidad.");
  }
}

/* ───────────────────────────────── addComment ───────────────────────────────── */

export async function addComment(
  id: string,
  body: string,
  internal: boolean,
): Promise<ActionResult> {
  try {
    const me = await authorize("incidents.write");
    const text = (body ?? "").trim();
    if (text.length < COMMENT_MIN) return fail("El comentario está vacío.");
    if (text.length > COMMENT_MAX) return fail("Comentario demasiado largo.");

    const exists = await prisma.incident.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return fail("Incidente no encontrado.");

    await prisma.incidentComment.create({
      data: {
        incidentId: id,
        authorId: me.id,
        body: text,
        internal: Boolean(internal),
      },
    });
    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("addComment", e);
    return fail("No se pudo agregar el comentario.");
  }
}

/* ───────────────────────────────── deleteIncident ───────────────────────────────── */

export async function deleteIncident(id: string): Promise<ActionResult> {
  try {
    await authorize("incidents.delete");
    await prisma.incident.delete({ where: { id } });
    refresh();
    return ok();
  } catch (e) {
    if (e instanceof Denied) return fail(e.message);
    console.error("deleteIncident", e);
    return fail("No se pudo eliminar el incidente.");
  }
}
