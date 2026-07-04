import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type SearchItem = {
  id: string;
  title: string;
  sub: string;
  href: string;
  icon: string;
};
type SearchGroup = { key: string; label: string; items: SearchItem[] };

// GET /api/admin/search?q=… — global search across the modules the caller can read.
export async function GET(request: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "No autenticado." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ groups: [] });

  const groups: SearchGroup[] = [];
  const enc = encodeURIComponent(q);

  if (me.permissions.has("users.read")) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    if (users.length)
      groups.push({
        key: "users",
        label: "Usuarios",
        items: users.map((u) => ({
          id: u.id,
          title: u.name,
          sub: u.email,
          href: `/usuarios?q=${enc}`,
          icon: "user",
        })),
      });
  }

  if (me.permissions.has("roles.read")) {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { key: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { name: "asc" },
      select: { id: true, name: true, key: true },
    });
    if (roles.length)
      groups.push({
        key: "roles",
        label: "Roles",
        items: roles.map((r) => ({
          id: r.id,
          title: r.name,
          sub: r.key,
          href: `/roles?q=${enc}`,
          icon: "shield",
        })),
      });
  }

  if (me.permissions.has("incidents.read")) {
    const incidents = await prisma.incident.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, title: true },
    });
    if (incidents.length)
      groups.push({
        key: "incidents",
        label: "Incidentes",
        items: incidents.map((i) => ({
          id: i.id,
          title: i.title,
          sub: i.code,
          href: `/incidentes`,
          icon: "alert",
        })),
      });
  }

  return Response.json({ groups });
}
