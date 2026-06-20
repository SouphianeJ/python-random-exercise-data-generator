import { generateDataset } from "./generator";
import type { GeneratedDataset } from "./generator/types";
import {
  COMPARISON_TOTAL_POINTS,
  buildComparisonCorrigeWorkbookBuffer,
  buildComparisonDataWorkbookBuffer,
  buildComparisonSubjectWorkbookBuffer,
  comparisonConfig,
  comparisonQuestions,
  compareStores,
  computeComparisonAnswerKey,
} from "./subject-templates/comparison";

/**
 * Compatibilité : « deux magasins Premium » est désormais le gabarit générique
 * de comparaison (src/lib/subject-templates/comparison.ts) spécialisé sur le
 * type Premium et un seed figé. Ce module conserve l'API historique utilisée
 * par `npm run premium` et les tests.
 */
export const premiumCaseConfig = comparisonConfig({ seed: 30, storeType: "Premium", storeCount: 9 });

export function buildPremiumDataset(): GeneratedDataset {
  return generateDataset(premiumCaseConfig);
}

export const premiumCaseQuestions = comparisonQuestions("Premium");
export const premiumCaseTotalPoints = COMPARISON_TOTAL_POINTS;

export function comparePremiumStores(dataset: GeneratedDataset) {
  return compareStores(dataset, "Premium");
}

export function computePremiumAnswerKey(dataset: GeneratedDataset) {
  return computeComparisonAnswerKey(dataset, "Premium");
}

export function buildPremiumSubjectWorkbookBuffer() {
  return buildComparisonSubjectWorkbookBuffer("Premium");
}

export function buildPremiumDataWorkbookBuffer(dataset: GeneratedDataset) {
  return buildComparisonDataWorkbookBuffer(dataset);
}

export function buildPremiumCorrigeWorkbookBuffer(dataset: GeneratedDataset) {
  return buildComparisonCorrigeWorkbookBuffer(dataset, "Premium");
}
