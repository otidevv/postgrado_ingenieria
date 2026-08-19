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
