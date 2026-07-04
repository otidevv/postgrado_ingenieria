import "server-only";

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { MIME_EXT } from "./applications";

// Los documentos de las postulaciones contienen datos personales, así que se
// guardan FUERA de /public (no se sirven directamente). El panel admin los
// descarga por una ruta protegida que lee de aquí.
const STORAGE_ROOT = resolve(process.cwd(), "storage", "postulaciones");

/** Extensión segura derivada del MIME (no confía en el nombre del cliente). */
function extForMime(mime: string): string {
  return MIME_EXT[mime] ?? ".bin";
}

/**
 * Guarda un archivo subido bajo storage/postulaciones/<appId>/ y devuelve la
 * ruta relativa (para persistir en BD) y el tamaño en bytes.
 */
export async function saveUploadedFile(
  applicationId: string,
  kind: string,
  file: File,
): Promise<{ storedPath: string; sizeBytes: number }> {
  const dir = join(STORAGE_ROOT, applicationId);
  await mkdir(dir, { recursive: true });

  const stored = `${kind}-${randomUUID()}${extForMime(file.type)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, stored), buf);

  return { storedPath: `${applicationId}/${stored}`, sizeBytes: buf.length };
}

/** Lee un archivo almacenado, bloqueando cualquier intento de path traversal. */
export async function readStoredFile(storedPath: string): Promise<Buffer> {
  const abs = resolve(STORAGE_ROOT, storedPath);
  if (abs !== STORAGE_ROOT && !abs.startsWith(STORAGE_ROOT + sep)) {
    throw new Error("Ruta de archivo inválida");
  }
  return readFile(abs);
}
