// src/lib/teaching-client.ts — utilidades puras compartidas cliente/servidor
export function weightedAverage(
  items: Array<{ weight: number; score: number | null }>,
): number | null {
  let sum = 0;
  let weights = 0;
  for (const it of items) {
    if (it.score === null) continue;
    sum += it.score * it.weight;
    weights += it.weight;
  }
  if (weights === 0) return null;
  return Math.round((sum / weights) * 100) / 100;
}

/**
 * Fecha calendario legible ("28 ago. 2026") desde un ISO date-only guardado
 * como medianoche UTC. Siempre en UTC para no desplazar el día en husos
 * negativos (Lima).
 */
export function fmtCalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
