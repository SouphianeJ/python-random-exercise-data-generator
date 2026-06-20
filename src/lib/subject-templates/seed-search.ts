import { generateDataset } from "../generator";
import type { ParamValues, SeedPreview, SubjectTemplate } from "./types";

export interface SeedSearchOptions {
  from?: number;
  to?: number;
  /** Nombre maximum de candidats retournés. */
  limit?: number;
}

/**
 * Balaye une plage de seeds pour un gabarit donné, évalue chaque tirage et
 * retourne les meilleurs candidats (triés par score décroissant). C'est
 * l'automatisation de la recherche manuelle de « bons » seeds.
 */
export function searchSeeds(
  template: SubjectTemplate,
  baseParams: ParamValues,
  options: SeedSearchOptions = {},
): SeedPreview[] {
  const from = Math.max(1, options.from ?? 1);
  const to = Math.max(from, options.to ?? from + 49);
  const limit = Math.max(1, options.limit ?? 5);

  const candidates: SeedPreview[] = [];
  for (let seed = from; seed <= to; seed += 1) {
    const params: ParamValues = { ...baseParams, seed };
    let evaluation = null;
    try {
      const dataset = generateDataset(template.buildConfig(params));
      evaluation = template.evaluate(dataset, params);
    } catch {
      evaluation = null;
    }
    if (evaluation) {
      candidates.push({ seed, score: evaluation.score, summary: evaluation.summary });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}
