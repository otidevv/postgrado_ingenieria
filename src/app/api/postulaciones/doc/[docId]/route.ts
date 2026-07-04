import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { readStoredFile } from "@/lib/applications-storage";

// Descarga protegida de un documento de postulación. Los archivos viven fuera
// de /public; solo quien tenga applications.read puede leerlos.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> },
) {
  const me = await getCurrentUser();
  if (!me || !me.permissions.has("applications.read")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { docId } = await params;
  const doc = await prisma.applicationDocument.findUnique({
    where: { id: docId },
  });
  if (!doc) return new Response("Documento no encontrado", { status: 404 });

  const buf = await readStoredFile(doc.storedPath).catch(() => null);
  if (!buf) return new Response("Archivo no disponible", { status: 404 });

  const safeName = doc.fileName.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Content-Length": String(doc.sizeBytes),
      "Cache-Control": "private, no-store",
    },
  });
}
