import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { DocentesView } from "./DocentesView";
import type { TeacherRow } from "./types";
import "../usuarios/users.css";

export const metadata = { title: "Docentes · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requirePermission("users.read");

  const profiles = await prisma.teacherProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, active: true } },
      _count: { select: { modules: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const rows: TeacherRow[] = profiles.map((t) => ({
    id: t.id,
    userId: t.user.id,
    name: t.user.name,
    email: t.user.email,
    academicDegree: t.academicDegree,
    specialty: t.specialty,
    bio: t.bio,
    photoUrl: t.photoUrl,
    orcid: t.orcid,
    active: t.user.active,
    moduleCount: t._count.modules,
  }));

  return (
    <DocentesView
      rows={rows}
      perms={{ canWrite: me.permissions.has("users.write") }}
    />
  );
}
