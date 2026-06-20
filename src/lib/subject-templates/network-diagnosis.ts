import { generateDataset } from "../generator";
import { defaultConfig } from "../generator/config";
import type { GeneratedDataset } from "../generator/types";
import {
  buildSubjectsWorkbookBuffer,
  computeAnswerKey,
} from "../subjects";
import { buildDataWorkbookBuffer } from "./data-workbook";
import {
  readInt,
  type GeneratedSubjectFile,
  type ParamValues,
  type SeedEvaluation,
  type SubjectTemplate,
} from "./types";

/**
 * Gabarit « diagnostic réseau » : enveloppe l'examen noté de src/lib/subjects.ts
 * (un magasin Discount dégradé par un scénario de turnover) dans le contrat
 * commun, pour qu'il soit pilotable depuis la même interface.
 */

const DATA_SHEETS = ["magasins", "employes", "ventes_exam", "store_month_costs"] as const;

interface NetworkParams {
  seed: number;
  storeCount: number;
  productCount: number;
  customerCount: number;
}

function readNetworkParams(params: ParamValues): NetworkParams {
  return {
    seed: readInt(params, "seed", 111222),
    storeCount: readInt(params, "storeCount", 8),
    productCount: readInt(params, "productCount", 100),
    customerCount: readInt(params, "customerCount", 420),
  };
}

function networkConfig(params: ParamValues) {
  const p = readNetworkParams(params);
  return {
    ...defaultConfig,
    seed: p.seed,
    storeCount: p.storeCount,
    productCount: p.productCount,
    customerCount: p.customerCount,
    storePerformancePlan: [
      { storeType: "Discount" as const, performanceStatus: "sous_performant_turnover" as const },
    ],
  };
}

function evaluateNetwork(dataset: GeneratedDataset): SeedEvaluation | null {
  const key = computeAnswerKey(dataset);
  const target = key.stores.find((store) => store.storeId === key.targetStoreId);
  if (!target) return null;

  const minTenure = Math.min(...key.stores.map((store) => store.averageTenureMonths));
  const turnoverIsLowestTenure = target.averageTenureMonths === minTenure;
  const inDeficit = target.annualResult < 0;
  const churn = target.departures + target.midYearHires;

  // On veut que le magasin turnover soit démontrable : déficitaire, ancienneté
  // la plus faible du réseau, churn visible.
  if (churn === 0) return null;
  const score = (inDeficit ? 40 : 10) + (turnoverIsLowestTenure ? 40 : 10) + churn;

  return {
    score,
    summary: {
      magasin_cible: key.targetStoreId,
      deficitaires: key.lossMakingStoreIds.join(", ") || "aucun",
      anciennete_cible_mois: target.averageTenureMonths,
      anciennete_min_reseau: minTenure,
      departs: target.departures,
      embauches_annee: target.midYearHires,
      resultat_cible: target.annualResult,
    },
  };
}

export function createNetworkTemplate(): SubjectTemplate {
  return {
    id: "diagnostic-reseau",
    label: "Diagnostic réseau (promotions vs turnover)",
    description:
      "Étude de cas /20 à l'échelle d'un réseau : identifier le magasin dégradé par le turnover et trancher " +
      "le débat « plus de promotions » vs « instabilité de l'équipe ».",
    params: [
      { key: "seed", label: "Seed", type: "int", min: 1, max: 999999, default: 111222 },
      { key: "storeCount", label: "Nombre de magasins", type: "int", min: 4, max: 14, default: 8 },
      { key: "productCount", label: "Nombre de produits", type: "int", min: 40, max: 200, default: 100 },
      { key: "customerCount", label: "Nombre de clients", type: "int", min: 80, max: 1000, default: 420 },
    ],
    buildConfig(params) {
      return networkConfig(params);
    },
    evaluate(dataset) {
      return evaluateNetwork(dataset);
    },
    async buildFiles(params): Promise<GeneratedSubjectFile[]> {
      const dataset = generateDataset(networkConfig(params));
      const [sujet, corrige, donnees] = await Promise.all([
        buildSubjectsWorkbookBuffer(),
        buildSubjectsWorkbookBuffer({ dataset }),
        buildDataWorkbookBuffer(dataset, DATA_SHEETS),
      ]);
      return [
        { name: "reseau_sujet.xlsx", kind: "sujet", buffer: sujet },
        { name: "reseau_donnees.xlsx", kind: "donnees", buffer: donnees },
        { name: "reseau_corrige.xlsx", kind: "corrige", buffer: corrige },
      ];
    },
  };
}
