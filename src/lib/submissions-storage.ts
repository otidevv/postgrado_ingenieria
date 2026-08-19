import "server-only";

import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

// Las entregas de los alumnos se guardan FUERA de /public (no se sirven
// directamente). Se descargan por /api/entregas/[id], que autoriza al
// alumno dueño, al docente del módulo o a un admin.
const STORAGE_ROOT = resolve(process.cwd(), "storage", "entregas");

export const SUBMISSION_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUBMISSION_MIMES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
};

/**
 * Valida y guarda el archivo de una entrega bajo
 * storage/entregas/<assessmentId>/. Devuelve la ruta relativa y el tamaño.
 * Lanza Error con mensaje en español si el archivo no es válido.
 */
export async function saveSubmissionFile(
  assessmentId: string,
  enrollmentId: string,
  file: File,
): Promise<{ storedPath: string; sizeBytes: number }> {
  const ext = SUBMISSION_MIMES[file.type];
  if (!ext) {
    throw new Error("Formato no permitido. Sube un PDF, Word (doc/docx) o ZIP.");
  }
  if (file.size > SUBMISSION_MAX_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB.");
  }

  const dir = join(STORAGE_ROOT, assessmentId);
  await mkdir(dir, { recursive: true });

  const stored = `${enrollmentId}-${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > SUBMISSION_MAX_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB.");
  }
  await writeFile(join(dir, stored), buf);

  return { storedPath: `${assessmentId}/${stored}`, sizeBytes: buf.length };
}

/** Borra el archivo de una entrega; silencioso si ya no existe. */
export async function deleteSubmissionFile(storedPath: string): Promise<void> {
  const abs = resolveSafe(storedPath);
  await unlink(abs).catch(() => undefined);
}

/** Lee un archivo almacenado, bloqueando path traversal. */
export async function readSubmissionFile(storedPath: string): Promise<Buffer> {
  return readFile(resolveSafe(storedPath));
}

function resolveSafe(storedPath: string): string {
  const abs = resolve(STORAGE_ROOT, storedPath);
  if (abs !== STORAGE_ROOT && !abs.startsWith(STORAGE_ROOT + sep)) {
    throw new Error("Ruta de archivo inválida.");
  }
  return abs;
}
