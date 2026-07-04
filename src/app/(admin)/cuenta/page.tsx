import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/server";
import { AccountView } from "./AccountView";
import type { AccountData, AccountSession } from "./types";

export const metadata = { title: "Mi cuenta · UNAMAD Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireUser();

  const [profile, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: me.id },
      select: { createdAt: true, lastLoginAt: true },
    }),
    prisma.session.findMany({
      where: { userId: me.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clientType: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
  ]);

  const sessionRows: AccountSession[] = sessions.map((s) => ({
    id: s.id,
    current: s.id === me.sessionId,
    clientType: String(s.clientType),
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }));

  const data: AccountData = {
    name: me.name,
    email: me.email,
    roles: me.roles.map((r) => r.name),
    createdAt: (profile?.createdAt ?? new Date()).toISOString(),
    lastLoginAt: profile?.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
    sessions: sessionRows,
  };

  return <AccountView data={data} />;
}
