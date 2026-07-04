import { prisma } from "@/lib/prisma";
import { requirePermission, userHas } from "@/lib/auth/server";
import { IncidentsClient } from "./IncidentsClient";
import type {
  CategoryOption,
  IncidentRow,
  IncidentSeverityKey,
  IncidentStatusKey,
  Person,
} from "./types";

export const metadata = { title: "Incidentes · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePermission("incidents.read");

  const [incidents, categories, assignees] = await Promise.all([
    prisma.incident.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        category: { select: { name: true } },
        reporter: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.incidentCategory.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, key: true, name: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const rows: IncidentRow[] = incidents.map((i) => ({
    id: i.id,
    code: i.code,
    title: i.title,
    status: i.status as IncidentStatusKey,
    severity: i.severity as IncidentSeverityKey,
    categoryName: i.category?.name ?? null,
    reporterName: i.reporter?.name ?? null,
    assignee: i.assignedTo ? { id: i.assignedTo.id, name: i.assignedTo.name } : null,
    createdAt: i.createdAt.toISOString(),
  }));

  const categoryOptions: CategoryOption[] = categories;
  const assigneeOptions: Person[] = assignees;

  return (
    <IncidentsClient
      rows={rows}
      categories={categoryOptions}
      assignees={assigneeOptions}
      perms={{
        canWrite: userHas(me, "incidents.write"),
        canDelete: userHas(me, "incidents.delete"),
      }}
    />
  );
}
