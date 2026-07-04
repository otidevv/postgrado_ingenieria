import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

// Réplica de saveUploadedFile/readStoredFile (no se puede importar el módulo
// server-only fuera del bundler de Next). La lógica es idéntica.
const STORAGE_ROOT = resolve(process.cwd(), "storage", "postulaciones");
async function saveUploadedFile(appId: string, kind: string, file: File) {
  const dir = join(STORAGE_ROOT, appId);
  await mkdir(dir, { recursive: true });
  const stored = `${kind}-${randomUUID()}.pdf`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, stored), buf);
  return { storedPath: `${appId}/${stored}`, sizeBytes: buf.length };
}
async function readStoredFile(storedPath: string) {
  return readFile(resolve(STORAGE_ROOT, storedPath));
}

// Prueba end-to-end de la capa de postulaciones SIN navegador:
// crea una postulación, guarda un archivo, lo relee, corre la query del admin
// y limpia todo. No deja datos residuales.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no definido");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const diploma = await prisma.diploma.findFirst({
    where: { status: "published" },
    select: { id: true, title: true },
  });
  if (!diploma) throw new Error("No hay diplomado publicado para la prueba");
  console.log(`→ Diplomado: ${diploma.title}`);

  // 1. Crear postulación
  const app = await prisma.diplomaApplication.create({
    data: {
      code: `TEST-${Date.now()}`,
      diploma: { connect: { id: diploma.id } },
      docType: "DNI",
      docNumber: `TST${Date.now().toString().slice(-8)}`,
      firstName: "Prueba",
      lastName: "Verificación",
      email: "prueba@test.local",
      phone: "999999999",
      academicDegree: "Bachiller",
    },
    select: { id: true, code: true },
  });
  console.log(`✓ Postulación creada: ${app.code} (${app.id})`);

  // 2. Guardar un archivo (usa el mismo código que el Server Action)
  const fakePdf = new File([Buffer.from("%PDF-1.4 test\n")], "dni.pdf", {
    type: "application/pdf",
  });
  const saved = await saveUploadedFile(app.id, "identidad", fakePdf);
  const doc = await prisma.applicationDocument.create({
    data: {
      applicationId: app.id,
      kind: "identidad",
      label: "Documento de identidad",
      fileName: "dni.pdf",
      storedPath: saved.storedPath,
      mimeType: "application/pdf",
      sizeBytes: saved.sizeBytes,
    },
  });
  console.log(`✓ Documento guardado: ${saved.storedPath} (${saved.sizeBytes} B)`);

  // 3. Releer el archivo
  const buf = await readStoredFile(doc.storedPath);
  console.log(`✓ Archivo releído: ${buf.length} B, contenido="${buf.toString().trim()}"`);

  // 4. Query del listado admin (misma forma que la página)
  const rows = await prisma.diplomaApplication.findMany({
    where: { id: app.id },
    include: {
      diploma: { select: { title: true } },
      _count: { select: { documents: true } },
    },
  });
  console.log(
    `✓ Query admin OK: ${rows[0].firstName} ${rows[0].lastName} · ${rows[0]._count.documents} doc(s) · ${rows[0].diploma.title}`,
  );

  // 5. Limpieza (cascade borra el documento; borra la carpeta de storage)
  await prisma.diplomaApplication.delete({ where: { id: app.id } });
  await rm(resolve(process.cwd(), "storage", "postulaciones", app.id), {
    recursive: true,
    force: true,
  });
  console.log("✓ Limpieza completa (sin datos residuales)");

  await prisma.$disconnect();
  console.log("\n✅ VERIFICACIÓN END-TO-END EXITOSA");
}

main().catch((e) => {
  console.error("❌ FALLO:", e);
  process.exit(1);
});
