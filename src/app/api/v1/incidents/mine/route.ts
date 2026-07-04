import { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "../../_lib/guard";
import { serializeIncident } from "../../_lib/incident-serializer";
import { fail, ok } from "../../_lib/response";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 30;

const STATUSES: readonly string[] = [
  "open",
  "triaged",
  "in_progress",
  "resolved",
  "rejected",
  "closed",
];

// GET /api/v1/incidents/mine?status=open&limit=30&cursor=…
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const me = auth.user;

  const url = new URL(request.url);

  // Validate status against the enum; an invalid value would make Prisma throw.
  const rawStatus = url.searchParams.get("status");
  if (rawStatus !== null && !STATUSES.includes(rawStatus)) {
    return fail("Estado no válido.", 400);
  }
  const status = rawStatus as $Enums.IncidentStatus | null;

  // Defensive limit coercion: reject NaN/negative/zero, floor, cap.
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const cursor = url.searchParams.get("cursor"); // incident id

  const where = {
    reporterId: me.id,
    ...(status ? { status } : {}),
  };

  try {
    const items = await prisma.incident.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        category: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        attachments: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return ok({
      incidents: page.map((i) => serializeIncident(i)),
      nextCursor,
    });
  } catch (e) {
    console.error("GET /api/v1/incidents/mine", e);
    return fail("No se pudieron cargar los incidentes.", 500);
  }
}
