import type { GeneratedDataset, GeneratorConfig } from "../generator/types";

/**
 * Champ de paramètre déclaratif, exposé tel quel à l'UI pour construire le
 * formulaire d'un gabarit de sujet sans coder.
 */
export type ParamField =
  | {
      key: string;
      label: string;
      type: "int";
      min: number;
      max: number;
      default: number;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: Array<{ value: string; label: string }>;
      default: string;
    };

/** Valeurs de paramètres telles qu'elles arrivent (query-string → string|number). */
export type ParamValues = Record<string, string | number>;

export type SubjectFileKind = "sujet" | "donnees" | "corrige";

export interface GeneratedSubjectFile {
  name: string;
  kind: SubjectFileKind;
  buffer: Buffer;
}

export interface SeedEvaluation {
  /** Plus c'est élevé, plus le tirage est « intéressant ». */
  score: number;
  /** Résumé lisible (aperçu UI) : ratios, verdict d'hypothèses, etc. */
  summary: Record<string, string | number>;
}

export interface SeedPreview extends SeedEvaluation {
  seed: number;
}

/** Métadonnée sérialisable d'un gabarit (pour l'API/UI, sans fonctions). */
export interface SubjectTemplateInfo {
  id: string;
  label: string;
  description: string;
  params: ParamField[];
}

export interface SubjectTemplate extends SubjectTemplateInfo {
  /** Construit la config générateur à partir des paramètres choisis. */
  buildConfig(params: ParamValues): GeneratorConfig;
  /** Évalue l'intérêt d'un tirage ; null si le tirage est inutilisable. */
  evaluate(dataset: GeneratedDataset, params: ParamValues): SeedEvaluation | null;
  /** Produit les classeurs (sujet / données / corrigé) du sujet. */
  buildFiles(params: ParamValues): Promise<GeneratedSubjectFile[]>;
}

export function readInt(params: ParamValues, key: string, fallback: number): number {
  const raw = params[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function readStr(params: ParamValues, key: string, fallback: string): string {
  const raw = params[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  return String(raw);
}

export function toInfo(template: SubjectTemplate): SubjectTemplateInfo {
  return {
    id: template.id,
    label: template.label,
    description: template.description,
    params: template.params,
  };
}
