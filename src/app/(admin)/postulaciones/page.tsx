import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { PostulacionesView } from "./PostulacionesView";
import type { ApplicationRow } from "./types";

export const metadata = { title: "Postulaciones · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePermission("applications.read");

  const apps = await prisma.diplomaApplication.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      diploma: { select: { title: true } },
      _count: { select: { documents: true } },
    },
  });

  const rows: ApplicationRow[] = apps.map((a) => ({
    id: a.id,
    code: a.code,
    fullName: `${a.firstName} ${a.lastName}`,
    docType: a.docType,
    docNumber: a.docNumber,
    email: a.email,
    phone: a.phone,
    diplomaTitle: a.diploma.title,
    status: a.status,
    docCount: a._count.documents,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <PostulacionesView
      rows={rows}
      perms={{ canWrite: me.permissions.has("applications.write") }}
    />
  );
}
