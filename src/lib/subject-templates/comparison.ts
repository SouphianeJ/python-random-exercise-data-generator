import ExcelJS from "exceljs";

import { generateDataset } from "../generator";
import { defaultConfig } from "../generator/config";
import { tabularExports } from "../generator/tabular";
import type { GeneratedDataset, GeneratorConfig, Store, StoreType } from "../generator/types";
import { buildDataWorkbookBuffer } from "./data-workbook";
import {
  readInt,
  readStr,
  type GeneratedSubjectFile,
  type ParamValues,
  type SeedEvaluation,
  type SubjectTemplate,
} from "./types";

/**
 * Gabarit générique « comparer deux magasins de même type ».
 *
 * Le sujet fait travailler l'équation du commerce de détail
 * `CA = trafic × taux de transformation × panier moyen` pour décomposer un
 * écart de CA entre deux magasins du même format, puis tester deux hypothèses
 * de pilotage (déficit de fréquentation vs effet de taille). « 2 Premium » et
 * « 2 Discount » ne sont que deux valeurs du paramètre `storeType`.
 */

export const OPEN_DAYS_PER_YEAR = 300;
export const COMPARISON_TVA = 0.2;
export const COMPARISON_TOTAL_POINTS = 20;

const DATA_SHEETS = ["magasins", "employes", "ventes_exam", "store_month_costs"] as const;

export interface ComparisonParams {
  seed: number;
  storeType: StoreType;
  storeCount: number;
}

export function comparisonConfig(params: ComparisonParams): GeneratorConfig {
  return {
    ...defaultConfig,
    seed: params.seed,
    storeCount: params.storeCount,
    productCount: 90,
    customerCount: 480,
  };
}

export function readComparisonParams(params: ParamValues): ComparisonParams {
  const storeType = readStr(params, "storeType", "Premium") as StoreType;
  return {
    seed: readInt(params, "seed", 30),
    storeType,
    storeCount: readInt(params, "storeCount", 9),
  };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export interface StoreKpi {
  storeId: string;
  type: string;
  zone: string;
  surface: number;
  openHours: string;
  dailyFootTraffic: number;
  annualTraffic: number;
  tickets: number;
  caTtc: number;
  averageBasketTtc: number;
  conversionRate: number;
  articlesPerTicket: number;
  caPerSquareMeter: number;
  caPerActiveSeller: number;
  activeSellers: number;
  averageTenureMonths: number;
  annualResult: number;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function computeStoreKpi(dataset: GeneratedDataset, store: Store): StoreKpi {
  const tables = tabularExports(dataset);
  const examRows = tables.ventes_exam.filter((row) => row.store_id === store.id);
  const tickets = examRows.length;
  const articles = examRows.reduce((sum, row) => sum + Number(row.article_count ?? 0), 0);

  const costs = tables.store_month_costs.filter((row) => row.store_id === store.id);
  const caTtc = costs.reduce((sum, row) => sum + Number(row.ca_ttc), 0);
  const totalCost = costs.reduce((sum, row) => sum + Number(row.total_store_cost), 0);

  const employees = dataset.employees.filter((employee) => employee.storeId === store.id);
  const active = employees.filter((employee) => !employee.endDate);
  const tenure = active.reduce((sum, employee) => sum + employee.tenureMonths, 0);

  const annualTraffic = store.dailyFootTraffic * OPEN_DAYS_PER_YEAR;

  return {
    storeId: store.id,
    type: store.type,
    zone: store.zone,
    surface: store.surface,
    openHours: store.openToClientsHours,
    dailyFootTraffic: store.dailyFootTraffic,
    annualTraffic,
    tickets,
    caTtc: round(caTtc),
    averageBasketTtc: tickets > 0 ? round(caTtc / tickets) : 0,
    conversionRate: annualTraffic > 0 ? round((tickets / annualTraffic) * 100, 2) : 0,
    articlesPerTicket: tickets > 0 ? round(articles / tickets) : 0,
    caPerSquareMeter: store.surface > 0 ? round(caTtc / store.surface) : 0,
    caPerActiveSeller: active.length > 0 ? round(caTtc / active.length) : 0,
    activeSellers: active.length,
    averageTenureMonths: active.length > 0 ? round(tenure / active.length, 1) : 0,
    annualResult: round(caTtc - totalCost),
  };
}

export interface ComparisonResult {
  storeType: StoreType;
  strong: StoreKpi;
  weak: StoreKpi;
  trafficRatio: number;
  conversionRatio: number;
  basketRatio: number;
  productOfRatios: number;
  caRatio: number;
  trafficShare: number;
  conversionShare: number;
  basketShare: number;
  caPerM2Ratio: number;
  caPerSellerRatio: number;
}

/** Retourne null si moins de deux magasins du type demandé. */
export function tryCompareStores(
  dataset: GeneratedDataset,
  storeType: StoreType,
): ComparisonResult | null {
  const kpis = dataset.stores
    .filter((store) => store.type === storeType)
    .map((store) => computeStoreKpi(dataset, store))
    .sort((a, b) => b.caTtc - a.caTtc);

  if (kpis.length < 2) return null;

  const [strong, weak] = kpis;
  if (weak.tickets === 0 || weak.dailyFootTraffic === 0 || weak.averageBasketTtc === 0) {
    return null;
  }

  const trafficRatio = strong.dailyFootTraffic / weak.dailyFootTraffic;
  const conversionRatio = strong.conversionRate / weak.conversionRate;
  const basketRatio = strong.averageBasketTtc / weak.averageBasketTtc;
  const caRatio = strong.caTtc / weak.caTtc;

  const lt = Math.log(trafficRatio);
  const lc = Math.log(conversionRatio);
  const lb = Math.log(basketRatio);
  const total = lt + lc + lb || 1;

  return {
    storeType,
    strong,
    weak,
    trafficRatio: round(trafficRatio, 3),
    conversionRatio: round(conversionRatio, 3),
    basketRatio: round(basketRatio, 3),
    productOfRatios: round(trafficRatio * conversionRatio * basketRatio, 3),
    caRatio: round(caRatio, 3),
    trafficShare: round((lt / total) * 100, 1),
    conversionShare: round((lc / total) * 100, 1),
    basketShare: round((lb / total) * 100, 1),
    caPerM2Ratio: round(strong.caPerSquareMeter / weak.caPerSquareMeter, 2),
    caPerSellerRatio: round(strong.caPerActiveSeller / weak.caPerActiveSeller, 2),
  };
}

export function compareStores(dataset: GeneratedDataset, storeType: StoreType): ComparisonResult {
  const result = tryCompareStores(dataset, storeType);
  if (!result) {
    throw new Error(`Le tirage ne contient pas deux magasins exploitables de type ${storeType}.`);
  }
  return result;
}

/**
 * Score d'« intérêt » d'un tirage : on veut un écart de CA marqué, des formats
 * comparables (surface proche), et des hypothèses qui tiennent (le trafic
 * domine, l'écart persiste au m²). Renvoie null si le tirage est inutilisable.
 */
export function evaluateComparison(
  dataset: GeneratedDataset,
  storeType: StoreType,
): SeedEvaluation | null {
  const cmp = tryCompareStores(dataset, storeType);
  if (!cmp) return null;

  const caGapPct = round((1 - cmp.weak.caTtc / cmp.strong.caTtc) * 100, 1);
  if (caGapPct < 20) return null;

  const surfaceDiff = Math.abs(cmp.strong.surface - cmp.weak.surface) /
    Math.max(cmp.strong.surface, cmp.weak.surface);
  const surfaceFactor = Math.max(0.5, 1 - surfaceDiff);

  const trafficDominates =
    cmp.trafficRatio > cmp.conversionRatio && cmp.trafficRatio > cmp.basketRatio;
  const gapPersists = cmp.caPerM2Ratio > 1.5 && cmp.caPerSellerRatio > 1.5;
  const hypothesesFactor = (trafficDominates ? 0.6 : 0.3) + (gapPersists ? 0.4 : 0.1);

  const score = round(caGapPct * surfaceFactor * hypothesesFactor, 1);

  return {
    score,
    summary: {
      magasins: `${cmp.strong.storeId} (fort) vs ${cmp.weak.storeId} (faible)`,
      "ecart_CA_%": caGapPct,
      "ratio_trafic": cmp.trafficRatio,
      "ratio_transfo": cmp.conversionRatio,
      "ratio_panier": cmp.basketRatio,
      "produit_ratios": cmp.productOfRatios,
      "ratio_CA": cmp.caRatio,
      H1_trafic_domine: trafficDominates ? "oui" : "non",
      H2_ecart_persiste: gapPersists ? "oui" : "non",
    },
  };
}

// ---------------------------------------------------------------------------
// Énoncé noté
// ---------------------------------------------------------------------------

export type Difficulty = "facile" | "intermediaire" | "avance";

export interface CaseQuestion {
  id: string;
  competence: string;
  prompt: string;
  sources: string[];
  method: string;
  difficulty: Difficulty;
  points: number;
}

export interface CaseSection {
  code: string;
  title: string;
  objective: string;
  difficulty: Difficulty;
  questions: CaseQuestion[];
}

export function comparisonMeta(storeType: StoreType) {
  return {
    title: `Étude de cas notée — Deux magasins ${storeType} au banc d'essai`,
    subtitle: "Décomposer un écart de chiffre d'affaires pour piloter par la donnée",
    durationMinutes: 90,
    context:
      `Une enseigne de sneakers exploite deux magasins de type ${storeType} de taille comparable. ` +
      "L'un réalise un chiffre d'affaires plusieurs fois supérieur à l'autre. La direction hésite : faut-il " +
      "considérer que le plus faible est condamné par sa taille ou son emplacement, ou bien y a-t-il un vrai " +
      "problème d'exploitation ? Votre mission : décomposer l'écart de CA avec l'équation du commerce de " +
      "détail — CA = trafic × taux de transformation × panier moyen — pour identifier le levier dominant, " +
      "puis distinguer ce qui relève de la fréquentation (souvent subie) et ce qui est réellement pilotable.",
    reminders: [
      `On suppose ${OPEN_DAYS_PER_YEAR} jours d'ouverture par an : trafic annuel ≈ daily_foot_traffic × ${OPEN_DAYS_PER_YEAR}.`,
      "Le CA TTC annuel d'un magasin = somme de ca_ttc sur ses 12 lignes de store_month_costs.",
      "Taux de transformation = nombre de tickets ÷ trafic annuel estimé.",
      "Séparateur décimal : la virgule.",
    ],
    generalInstructions: [
      `Travaillez sur les DEUX magasins de type ${storeType} uniquement.`,
      "Reportez vos résultats dans la feuille « Sujet », colonne « reponse ».",
      "Arrondissez les montants à 2 décimales, les taux et ratios à 2 décimales.",
      "Pour les questions d'analyse, rédigez une réponse argumentée citant vos chiffres.",
    ],
    workingFiles: [
      { file: "magasins (feuille)", description: "Type, zone, surface, daily_foot_traffic, horaires." },
      { file: "ventes_exam (feuille)", description: "1 ligne = 1 ticket ; article_count, store_id, employee_id." },
      { file: "store_month_costs (feuille)", description: "ca_ttc et total_store_cost par magasin et par mois." },
      { file: "employes (feuille)", description: "anciennete_mois, end_date, store_id." },
    ],
  };
}

export function comparisonSections(storeType: StoreType): CaseSection[] {
  const T = storeType;
  return [
    {
      code: "1",
      title: "Partie 1 — Mesurer",
      objective: `Produire les agrégats de base pour chaque ${T}.`,
      difficulty: "facile",
      questions: [
        {
          id: "Q1",
          competence: `Repérer les deux magasins ${T}`,
          prompt: `Dans la feuille magasins, relevez les store_id des deux magasins de type « ${T} » et leur surface.`,
          sources: ["magasins"],
          method: "Filtrer la colonne type.",
          difficulty: "facile",
          points: 1,
        },
        {
          id: "Q2",
          competence: "Nombre de tickets",
          prompt: `Comptez le nombre de tickets de chaque ${T} (lignes de ventes_exam pour ce store_id).`,
          sources: ["ventes_exam"],
          method: "NB.SI sur store_id.",
          difficulty: "facile",
          points: 1,
        },
        {
          id: "Q3",
          competence: "CA TTC annuel",
          prompt: `Calculez le CA TTC annuel de chaque ${T} (somme de ca_ttc sur ses 12 lignes de store_month_costs).`,
          sources: ["store_month_costs"],
          method: "SOMME.SI de ca_ttc par store_id.",
          difficulty: "facile",
          points: 1.5,
        },
        {
          id: "Q4",
          competence: "Panier moyen TTC",
          prompt: `Déduisez le panier moyen TTC de chaque ${T} (CA TTC ÷ nombre de tickets).`,
          sources: ["store_month_costs", "ventes_exam"],
          method: "Q3 ÷ Q2.",
          difficulty: "facile",
          points: 1.5,
        },
      ],
    },
    {
      code: "2",
      title: "Partie 2 — Décomposer (équation du retail)",
      objective: "Mesurer trafic et transformation, vérifier l'identité CA = trafic × transfo × panier.",
      difficulty: "intermediaire",
      questions: [
        {
          id: "Q5",
          competence: "Trafic annuel estimé",
          prompt: `Estimez le trafic annuel de chaque ${T} = daily_foot_traffic × ${OPEN_DAYS_PER_YEAR}.`,
          sources: ["magasins"],
          method: "Lire daily_foot_traffic et multiplier.",
          difficulty: "intermediaire",
          points: 1,
        },
        {
          id: "Q6",
          competence: "Taux de transformation",
          prompt: `Calculez le taux de transformation de chaque ${T} = tickets ÷ trafic annuel estimé (en %).`,
          sources: ["ventes_exam", "magasins"],
          method: "Q2 ÷ Q5.",
          difficulty: "intermediaire",
          points: 2,
        },
        {
          id: "Q7",
          competence: "Vérifier l'identité du retail",
          prompt:
            `Pour chaque ${T}, vérifiez que trafic annuel × taux de transformation × panier moyen redonne bien le CA TTC (Q3). ` +
            "Commentez : pourquoi cette égalité est-elle exacte ?",
          sources: ["Q3", "Q4", "Q5", "Q6"],
          method: "Multiplier les trois leviers et comparer à Q3.",
          difficulty: "intermediaire",
          points: 2,
        },
      ],
    },
    {
      code: "3",
      title: "Partie 3 — Comparer et normaliser",
      objective: "Décomposer l'écart en leviers et neutraliser l'effet taille.",
      difficulty: "intermediaire",
      questions: [
        {
          id: "Q8",
          competence: "Décomposition de l'écart",
          prompt:
            `Entre le ${T} fort et le ${T} faible, calculez les trois ratios (trafic, transformation, panier). ` +
            "Vérifiez que leur produit ≈ ratio des CA. Quel levier pèse le plus dans l'écart ?",
          sources: ["Q3", "Q4", "Q5", "Q6"],
          method: "Faire les trois rapports fort/faible et leur produit.",
          difficulty: "intermediaire",
          points: 2,
        },
        {
          id: "Q9",
          competence: "CA au m²",
          prompt: `Calculez le CA TTC au m² de chaque ${T} (CA TTC ÷ surface).`,
          sources: ["store_month_costs", "magasins"],
          method: "Q3 ÷ surface.",
          difficulty: "intermediaire",
          points: 1,
        },
        {
          id: "Q10",
          competence: "CA par vendeur actif",
          prompt: `Calculez le CA TTC par vendeur encore en poste de chaque ${T} (employes : end_date vide).`,
          sources: ["store_month_costs", "employes"],
          method: "Q3 ÷ nombre de vendeurs actifs du magasin.",
          difficulty: "intermediaire",
          points: 1,
        },
        {
          id: "Q11",
          competence: "Résultat annuel",
          prompt: `Calculez le résultat annuel de chaque ${T} = somme(ca_ttc) − somme(total_store_cost).`,
          sources: ["store_month_costs"],
          method: "SOMME.SI des deux colonnes par store_id, puis différence.",
          difficulty: "intermediaire",
          points: 1,
        },
      ],
    },
    {
      code: "4",
      title: "Partie 4 — Piloter (hypothèses)",
      objective: "Trancher les deux hypothèses et proposer des actions.",
      difficulty: "avance",
      questions: [
        {
          id: "Q12",
          competence: "Hypothèse 1 — fréquentation vs commercial",
          prompt:
            "Hypothèse 1 : « l'écart vient surtout d'un déficit de fréquentation (trafic), plus que de la performance " +
            "commerciale (transformation + panier) ». À partir des ratios de Q8, comparez le ratio de trafic au produit " +
            "des ratios transformation × panier. Concluez sur ce qui est subi vs pilotable.",
          sources: ["Q8"],
          method: "Comparer ratio trafic et (ratio transfo × ratio panier).",
          difficulty: "avance",
          points: 2.5,
        },
        {
          id: "Q13",
          competence: "Hypothèse 2 — effet taille + recommandations",
          prompt:
            "Hypothèse 2 : « le magasin faible vend moins simplement parce qu'il est plus petit ». Réfutez ou confirmez-la " +
            "en comparant surfaces (Q1), CA/m² (Q9) et CA/vendeur (Q10). Si l'écart persiste après normalisation, c'est une " +
            "vraie sous-performance. Proposez deux actions : une sur le levier dominant (Q12), une sur un levier pilotable " +
            "(transformation : formation/vente additionnelle ; ou panier : montée en gamme).",
          sources: ["Q1", "Q9", "Q10"],
          method: "Comparer surfaces et indicateurs normalisés, puis recommander.",
          difficulty: "avance",
          points: 2.5,
        },
      ],
    },
  ];
}

export function comparisonQuestions(storeType: StoreType): CaseQuestion[] {
  return comparisonSections(storeType).flatMap((section) => section.questions);
}

// ---------------------------------------------------------------------------
// Corrigé
// ---------------------------------------------------------------------------

export interface ComparisonAnswerKey {
  comparison: ComparisonResult;
  perQuestion: Array<{ id: string; expected: string }>;
  hypothesis1: string;
  hypothesis2: string;
}

function fr(value: number, decimals = 2) {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function eur(value: number) {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function computeComparisonAnswerKey(
  dataset: GeneratedDataset,
  storeType: StoreType,
): ComparisonAnswerKey {
  const cmp = compareStores(dataset, storeType);
  const s = cmp.strong;
  const w = cmp.weak;

  const perQuestion = [
    { id: "Q1", expected: `${s.storeId} (${s.surface} m²) et ${w.storeId} (${w.surface} m²).` },
    { id: "Q2", expected: `${s.storeId} : ${s.tickets} tickets ; ${w.storeId} : ${w.tickets} tickets.` },
    { id: "Q3", expected: `${s.storeId} : ${eur(s.caTtc)} ; ${w.storeId} : ${eur(w.caTtc)}.` },
    { id: "Q4", expected: `${s.storeId} : ${fr(s.averageBasketTtc)} € ; ${w.storeId} : ${fr(w.averageBasketTtc)} €.` },
    { id: "Q5", expected: `${s.storeId} : ${fr(s.annualTraffic, 0)} visiteurs/an ; ${w.storeId} : ${fr(w.annualTraffic, 0)} visiteurs/an.` },
    { id: "Q6", expected: `${s.storeId} : ${fr(s.conversionRate)} % ; ${w.storeId} : ${fr(w.conversionRate)} %.` },
    {
      id: "Q7",
      expected:
        `Identité vérifiée : ${fr(s.annualTraffic, 0)} × ${fr(s.conversionRate)} % × ${fr(s.averageBasketTtc)} € ≈ ${eur(s.caTtc)}. ` +
        "Exacte car taux de transformation = tickets/trafic et panier = CA/tickets : le trafic et les tickets se simplifient.",
    },
    {
      id: "Q8",
      expected:
        `Ratios fort/faible — trafic ×${fr(cmp.trafficRatio)}, transformation ×${fr(cmp.conversionRatio)}, panier ×${fr(cmp.basketRatio)}. ` +
        `Produit ×${fr(cmp.productOfRatios)} ≈ ratio des CA ×${fr(cmp.caRatio)}. Levier dominant : le trafic.`,
    },
    { id: "Q9", expected: `${s.storeId} : ${eur(s.caPerSquareMeter)}/m² ; ${w.storeId} : ${eur(w.caPerSquareMeter)}/m² (×${fr(cmp.caPerM2Ratio)}).` },
    {
      id: "Q10",
      expected:
        `${s.storeId} : ${eur(s.caPerActiveSeller)}/vendeur (${s.activeSellers} actifs) ; ` +
        `${w.storeId} : ${eur(w.caPerActiveSeller)}/vendeur (${w.activeSellers} actifs) (×${fr(cmp.caPerSellerRatio)}).`,
    },
    { id: "Q11", expected: `${s.storeId} : ${eur(s.annualResult)} ; ${w.storeId} : ${eur(w.annualResult)}.` },
    {
      id: "Q12",
      expected:
        `VRAIE. Ratio trafic ×${fr(cmp.trafficRatio)} > produit des leviers commerciaux (transfo × panier) ` +
        `×${fr(cmp.conversionRatio * cmp.basketRatio)}. Le trafic explique ${fr(cmp.trafficShare)} % de l'écart (échelle log) ` +
        `contre ${fr(cmp.conversionShare + cmp.basketShare)} % pour transformation + panier. La fréquentation est surtout ` +
        "subie ; transformation et panier sont les leviers pilotables.",
    },
    {
      id: "Q13",
      expected:
        `RÉFUTÉE. ${w.storeId} (${w.surface} vs ${s.surface} m²) a un CA/m² ×${fr(cmp.caPerM2Ratio)} plus faible et un ` +
        `CA/vendeur ×${fr(cmp.caPerSellerRatio)} plus faible : l'écart PERSISTE après normalisation, donc vraie sous-performance, ` +
        "pas un effet de taille. Actions : (1) trafic — campagne locale / vitrine / horaires ; (2) levier pilotable — vente " +
        `additionnelle (articles/ticket ${fr(w.articlesPerTicket)} vs ${fr(s.articlesPerTicket)}) et montée en gamme du panier.`,
    },
  ];

  return {
    comparison: cmp,
    perQuestion,
    hypothesis1:
      `H1 confirmée : le trafic (×${fr(cmp.trafficRatio)}) est le premier levier de l'écart, devant transformation ` +
      `(×${fr(cmp.conversionRatio)}) et panier (×${fr(cmp.basketRatio)}).`,
    hypothesis2:
      `H2 réfutée : à surface comparable (${w.surface} vs ${s.surface} m²), le CA/m² reste ×${fr(cmp.caPerM2Ratio)} et le ` +
      `CA/vendeur ×${fr(cmp.caPerSellerRatio)} en faveur du fort : sous-performance réelle, pas un effet de taille.`,
  };
}

// ---------------------------------------------------------------------------
// Classeurs
// ---------------------------------------------------------------------------

const TITLE_COLOR = "FF1E3A46";
const ACCENT_COLOR = "FF2F6F4E";
const ANSWER_FILL = "FFEAF3EC";
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facile: "facile",
  intermediaire: "intermédiaire",
  avance: "avancé",
};

function styleHeader(row: ExcelJS.Row, color = TITLE_COLOR) {
  row.font = { bold: true, color: { argb: "FFF8F4EA" } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  row.height = 22;
}

export async function buildComparisonSubjectWorkbookBuffer(storeType: StoreType) {
  const meta = comparisonMeta(storeType);
  const sections = comparisonSections(storeType);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Exercise Data Generator";
  workbook.created = new Date(Date.UTC(2024, 0, 1));
  workbook.modified = workbook.created;

  const guide = workbook.addWorksheet("Consignes");
  guide.columns = [{ width: 26 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];
  guide.mergeCells("A1:E1");
  guide.getCell("A1").value = meta.title;
  guide.getCell("A1").font = { size: 18, bold: true, color: { argb: TITLE_COLOR } };
  guide.mergeCells("A2:E2");
  guide.getCell("A2").value = `${meta.subtitle} — noté sur ${COMPARISON_TOTAL_POINTS} points — durée conseillée ${meta.durationMinutes} min`;
  guide.getCell("A2").font = { italic: true, color: { argb: TITLE_COLOR } };

  let cursor = 4;
  const block = (heading: string, lines: string[]) => {
    guide.getCell(`A${cursor}`).value = heading;
    guide.getCell(`A${cursor}`).font = { bold: true, size: 12, color: { argb: ACCENT_COLOR } };
    cursor += 1;
    for (const line of lines) {
      guide.mergeCells(`A${cursor}:E${cursor}`);
      const cell = guide.getCell(`A${cursor}`);
      cell.value = line;
      cell.alignment = { wrapText: true, vertical: "top" };
      guide.getRow(cursor).height = Math.max(18, Math.ceil(line.length / 90) * 16);
      cursor += 1;
    }
    cursor += 1;
  };

  block("Contexte", [meta.context]);
  block("Feuilles de données", meta.workingFiles.map((e) => `${e.file} — ${e.description}`));
  block("À retenir", meta.reminders);
  block("Consignes générales", meta.generalInstructions);

  guide.getCell(`A${cursor}`).value = "Barème";
  guide.getCell(`A${cursor}`).font = { bold: true, size: 12, color: { argb: ACCENT_COLOR } };
  cursor += 1;
  const head = guide.getRow(cursor);
  head.getCell(1).value = "Partie";
  head.getCell(2).value = "Objectif";
  head.getCell(4).value = "Points";
  styleHeader(head);
  guide.mergeCells(`B${cursor}:C${cursor}`);
  cursor += 1;
  for (const section of sections) {
    const points = section.questions.reduce((sum, q) => sum + q.points, 0);
    const row = guide.getRow(cursor);
    row.getCell(1).value = section.title;
    row.getCell(2).value = section.objective;
    row.getCell(4).value = points;
    row.alignment = { vertical: "top", wrapText: true };
    guide.mergeCells(`B${cursor}:C${cursor}`);
    cursor += 1;
  }
  const totalRow = guide.getRow(cursor);
  totalRow.getCell(1).value = "Total";
  totalRow.getCell(4).value = COMPARISON_TOTAL_POINTS;
  totalRow.font = { bold: true };

  const subject = workbook.addWorksheet("Sujet", { views: [{ state: "frozen", ySplit: 1 }] });
  subject.columns = [
    { header: "id", key: "id", width: 6 },
    { header: "partie", key: "partie", width: 32 },
    { header: "indicateur", key: "competence", width: 30 },
    { header: "enonce", key: "prompt", width: 70 },
    { header: "source", key: "sources", width: 26 },
    { header: "methode", key: "method", width: 34 },
    { header: "niveau", key: "difficulty", width: 14 },
    { header: "points", key: "points", width: 8 },
    { header: "reponse", key: "answer", width: 26 },
  ];
  styleHeader(subject.getRow(1));
  subject.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };
  for (const section of sections) {
    for (const question of section.questions) {
      const row = subject.addRow({
        id: question.id,
        partie: section.title,
        competence: question.competence,
        prompt: question.prompt,
        sources: question.sources.join(" + "),
        method: question.method,
        difficulty: DIFFICULTY_LABEL[question.difficulty],
        points: question.points,
        answer: "",
      });
      row.alignment = { vertical: "top", wrapText: true };
      const answer = row.getCell("answer");
      answer.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ANSWER_FILL } };
      answer.border = {
        top: { style: "thin", color: { argb: ACCENT_COLOR } },
        right: { style: "thin", color: { argb: ACCENT_COLOR } },
        bottom: { style: "thin", color: { argb: ACCENT_COLOR } },
        left: { style: "thin", color: { argb: ACCENT_COLOR } },
      };
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildComparisonDataWorkbookBuffer(dataset: GeneratedDataset) {
  return buildDataWorkbookBuffer(dataset, DATA_SHEETS);
}

export async function buildComparisonCorrigeWorkbookBuffer(
  dataset: GeneratedDataset,
  storeType: StoreType,
) {
  const key = computeComparisonAnswerKey(dataset, storeType);
  const { strong, weak } = key.comparison;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Exercise Data Generator";
  workbook.created = new Date(Date.UTC(2024, 0, 1));
  workbook.modified = workbook.created;

  const kpi = workbook.addWorksheet("KPIs", { views: [{ state: "frozen", ySplit: 1 }] });
  kpi.columns = [
    { header: "indicateur", key: "label", width: 30 },
    { header: `${strong.storeId} (fort)`, key: "strong", width: 18 },
    { header: `${weak.storeId} (faible)`, key: "weak", width: 18 },
    { header: "ratio fort/faible", key: "ratio", width: 18 },
  ];
  styleHeader(kpi.getRow(1), ACCENT_COLOR);
  const ratio = (a: number, b: number) => (b !== 0 ? Math.round((a / b) * 100) / 100 : 0);
  const lines: Array<[string, number | string, number | string, number | string]> = [
    ["surface (m²)", strong.surface, weak.surface, ratio(strong.surface, weak.surface)],
    ["daily_foot_traffic", strong.dailyFootTraffic, weak.dailyFootTraffic, key.comparison.trafficRatio],
    ["trafic annuel estimé", strong.annualTraffic, weak.annualTraffic, key.comparison.trafficRatio],
    ["tickets", strong.tickets, weak.tickets, ratio(strong.tickets, weak.tickets)],
    ["taux de transformation (%)", strong.conversionRate, weak.conversionRate, key.comparison.conversionRatio],
    ["panier moyen TTC (€)", strong.averageBasketTtc, weak.averageBasketTtc, key.comparison.basketRatio],
    ["articles / ticket", strong.articlesPerTicket, weak.articlesPerTicket, ratio(strong.articlesPerTicket, weak.articlesPerTicket)],
    ["CA TTC annuel (€)", strong.caTtc, weak.caTtc, key.comparison.caRatio],
    ["CA / m² (€)", strong.caPerSquareMeter, weak.caPerSquareMeter, key.comparison.caPerM2Ratio],
    ["CA / vendeur actif (€)", strong.caPerActiveSeller, weak.caPerActiveSeller, key.comparison.caPerSellerRatio],
    ["vendeurs actifs", strong.activeSellers, weak.activeSellers, ratio(strong.activeSellers, weak.activeSellers)],
    ["ancienneté moyenne (mois)", strong.averageTenureMonths, weak.averageTenureMonths, ratio(strong.averageTenureMonths, weak.averageTenureMonths)],
    ["résultat annuel (€)", strong.annualResult, weak.annualResult, "—"],
  ];
  for (const [label, a, b, r] of lines) {
    kpi.addRow({ label, strong: a, weak: b, ratio: r });
  }

  const answers = workbook.addWorksheet("Reponses attendues", { views: [{ state: "frozen", ySplit: 1 }] });
  answers.columns = [
    { header: "id", key: "id", width: 6 },
    { header: "points", key: "points", width: 8 },
    { header: "reponse attendue", key: "expected", width: 110 },
  ];
  styleHeader(answers.getRow(1), ACCENT_COLOR);
  const pointsById = new Map(comparisonQuestions(storeType).map((q) => [q.id, q.points]));
  for (const item of key.perQuestion) {
    const row = answers.addRow({ id: item.id, points: pointsById.get(item.id) ?? "", expected: item.expected });
    row.alignment = { vertical: "top", wrapText: true };
  }

  const synth = workbook.addWorksheet("Synthese");
  synth.columns = [{ width: 28 }, { width: 90 }];
  synth.getCell("A1").value = "Décomposition de l'écart de CA";
  synth.getCell("A1").font = { bold: true, size: 14, color: { argb: TITLE_COLOR } };
  const c = key.comparison;
  const synthRows: Array<[string, string]> = [
    ["Équation", "CA = trafic × taux de transformation × panier moyen"],
    ["Ratio trafic", `×${fr(c.trafficRatio)} (part ${fr(c.trafficShare)} % de l'écart, échelle log)`],
    ["Ratio transformation", `×${fr(c.conversionRatio)} (part ${fr(c.conversionShare)} %)`],
    ["Ratio panier", `×${fr(c.basketRatio)} (part ${fr(c.basketShare)} %)`],
    ["Produit des ratios", `×${fr(c.productOfRatios)}`],
    ["Ratio des CA", `×${fr(c.caRatio)} (le produit reconstruit l'écart)`],
    ["Hypothèse 1", key.hypothesis1],
    ["Hypothèse 2", key.hypothesis2],
  ];
  let row = 3;
  for (const [label, value] of synthRows) {
    synth.getCell(`A${row}`).value = label;
    synth.getCell(`A${row}`).font = { bold: true, color: { argb: ACCENT_COLOR } };
    synth.getCell(`B${row}`).value = value;
    synth.getCell(`B${row}`).alignment = { wrapText: true, vertical: "top" };
    synth.getRow(row).height = Math.max(18, Math.ceil(value.length / 88) * 16);
    row += 1;
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// Gabarit
// ---------------------------------------------------------------------------

const STORE_TYPE_OPTIONS = [
  { value: "Premium", label: "Premium (petites boutiques centre-ville)" },
  { value: "Standard", label: "Standard" },
  { value: "Discount", label: "Discount (grandes surfaces périphérie)" },
];

export function createComparisonTemplate(): SubjectTemplate {
  return {
    id: "comparaison",
    label: "Comparaison de deux magasins (équation du retail)",
    description:
      "Décompose un écart de CA entre deux magasins du même type avec CA = trafic × transformation × panier, " +
      "puis teste deux hypothèses de pilotage. Choisissez le type de magasin à comparer.",
    params: [
      { key: "storeType", label: "Type de magasin", type: "select", options: STORE_TYPE_OPTIONS, default: "Premium" },
      { key: "storeCount", label: "Nombre de magasins du réseau", type: "int", min: 5, max: 14, default: 9 },
      { key: "seed", label: "Seed", type: "int", min: 1, max: 999999, default: 30 },
    ],
    buildConfig(params) {
      return comparisonConfig(readComparisonParams(params));
    },
    evaluate(dataset, params) {
      return evaluateComparison(dataset, readComparisonParams(params).storeType);
    },
    async buildFiles(params): Promise<GeneratedSubjectFile[]> {
      const p = readComparisonParams(params);
      const dataset = generateDataset(comparisonConfig(p));
      const slug = p.storeType.toLowerCase();
      const [sujet, donnees, corrige] = await Promise.all([
        buildComparisonSubjectWorkbookBuffer(p.storeType),
        buildComparisonDataWorkbookBuffer(dataset),
        buildComparisonCorrigeWorkbookBuffer(dataset, p.storeType),
      ]);
      return [
        { name: `${slug}_sujet.xlsx`, kind: "sujet", buffer: sujet },
        { name: `${slug}_donnees.xlsx`, kind: "donnees", buffer: donnees },
        { name: `${slug}_corrige.xlsx`, kind: "corrige", buffer: corrige },
      ];
    },
  };
}
