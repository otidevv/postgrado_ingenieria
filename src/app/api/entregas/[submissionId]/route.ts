import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { readSubmissionFile } from "@/lib/submissions-storage";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ submissionId: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { submissionId } = await ctx.params;
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      fileName: true,
      storedPath: true,
      mimeType: true,
      enrollment: { select: { student: { select: { userId: true } } } },
      assessment: {
        select: {
          module: { select: { teacher: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!sub || !sub.storedPath) {
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  const isOwner = sub.enrollment.student.userId === me.id;
  const isTeacher = sub.assessment.module.teacher?.userId === me.id;
  const isAdmin = me.permissions.has("enrollments.read");
  if (!isOwner && !isTeacher && !isAdmin) {
    // Mismo 404 que "no existe": no revelar a un usuario sin acceso que la
    // entrega existe (evita un oráculo de existencia).
    return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  }

  try {
    const buf = await readSubmissionFile(sub.storedPath);
    const fileName = sub.fileName ?? "entrega";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": sub.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="entrega"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }
}
