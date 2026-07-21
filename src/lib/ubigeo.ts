// Traducción de código de ubigeo RENIEC (6 dígitos) a nombres de
// departamento / provincia / distrito, usando el catálogo oficial.
// El JSON se empaqueta con la ruta del API, así no dependemos de leer
// archivos del disco en tiempo de ejecución.
import raw from "./ubigeo-data.json";

const TABLE = raw as Record<string, string>;

// Palabras que se mantienen en minúscula dentro de un nombre propio.
const MINOR = new Set(["de", "del", "la", "las", "los", "y", "e"]);

/** "PUERTO MALDONADO" → "Puerto Maldonado" (respetando conectores). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && MINOR.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

export type Ubigeo = {
  ubigeo: string;
  region: string;
  province: string;
  district: string;
};

/**
 * Busca un código de ubigeo y devuelve sus nombres, o null si no existe.
 * Normaliza la entrada a 6 dígitos (rellena con ceros / recorta).
 */
export function lookupUbigeo(code: unknown): Ubigeo | null {
  const digits = String(code ?? "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  const key = digits.padStart(6, "0").slice(-6);
  const value = TABLE[key];
  if (!value) return null;
  const [region = "", province = "", district = ""] = value
    .split("/")
    .map((p) => titleCase(p.trim()));
  return { ubigeo: key, region, province, district };
}
