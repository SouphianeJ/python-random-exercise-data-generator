import ExcelJS from "exceljs";

import type { GeneratedDataset } from "./generator/types";
import { TVA_RATE } from "./generator/economics";

/**
 * Modèle d'examen noté.
 *
 * L'exercice est conçu comme une étude de cas progressive : l'étudiant part
 * d'indicateurs simples (partie A) et construit, partie après partie, le
 * faisceau de preuves qui lui permet de trancher le débat métier de la
 * dernière question. Chaque énoncé est rédigé pour être directement réalisable
 * avec les colonnes RÉELLEMENT présentes dans les exports examen.
 */

export type Difficulty = "facile" | "intermediaire" | "avance";

export interface ExamQuestion {
  /** Identifiant court affiché à l'étudiant, ex. "A2". */
  id: string;
  /** Compétence évaluée (sert aussi d'intitulé d'indicateur). */
  competence: string;
  /** Énoncé complet, sans ambiguïté, qui précise quand une colonne est à recalculer. */
  prompt: string;
  /** Fichier(s) de travail nécessaires. */
  sources: string[];
  /** Colonnes réellement utilisées (noms exacts des exports). */
  columns: string[];
  /** Méthode attendue / coup de pouce Excel. */
  method: string;
  difficulty: Difficulty;
  /** Barème de la question. */
  points: number;
}

export interface ExamSection {
  code: string;
  title: string;
  objective: string;
  difficulty: Difficulty;
  questions: ExamQuestion[];
}

export interface ExamMeta {
  title: string;
  subtitle: string;
  durationMinutes: number;
  context: string;
  workingFiles: Array<{ file: string; description: string }>;
  reminders: string[];
  generalInstructions: string[];
}

export const examMeta: ExamMeta = {
  title: "Étude de cas notée — Diagnostic d'un réseau de magasins",
  subtitle: "Analyse de données de ventes, de charges et de ressources humaines",
  durationMinutes: 120,
  context:
    "Vous êtes analyste pour une enseigne de sneakers. Le PDG France martèle que les magasins qui " +
    "vendent mal devraient « faire encore plus de promotions » pour relancer le chiffre d'affaires. " +
    "Sur le terrain, les responsables défendent une autre lecture : organisation instable, manque de " +
    "formation et turnover élevé des vendeurs. Personne n'a tranché avec des chiffres. À partir des " +
    "fichiers fournis, vous devez (1) repérer le magasin réellement en difficulté, (2) tester les deux " +
    "hypothèses avec des indicateurs, puis (3) conclure et proposer des actions. Le réseau compte " +
    "plusieurs magasins : à vous d'identifier celui qui pose problème, on ne vous le donne pas.",
  workingFiles: [
    { file: "ventes_exam.xlsx", description: "1 ligne = 1 ticket ; les colonnes produit sont répétées (product_1_*, product_2_*, …)." },
    { file: "store_month_costs.xlsx", description: "Charges et CA par magasin et par mois (12 mois par magasin)." },
    { file: "magasins.xlsx", description: "Caractéristiques des magasins (type, zone, surface…)." },
    { file: "employes.xlsx", description: "Vendeurs : ancienneté, dates d'embauche et de départ, magasin." },
  ],
  reminders: [
    `Taux de TVA applicable : ${(TVA_RATE * 100).toFixed(0)} %. TTC = HT × (1 + ${TVA_RATE}).`,
    "Séparateur décimal : la virgule. Séparateur de colonnes des CSV : le point-virgule.",
    "Dans ventes_exam.xlsx, les colonnes sale_total_ht et sale_total_ttc sont VIDES : c'est à vous de les reconstruire.",
    "Données de l'année civile : une embauche « en cours d'année » a une hire_date à partir du 1er janvier de l'année étudiée.",
  ],
  generalInstructions: [
    "Reportez chaque résultat dans la feuille « Sujet », colonne « reponse ».",
    "Vous pouvez utiliser SOMME.SI / MOYENNE.SI / NB.SI / NB.SI.ENS ou un tableau croisé dynamique.",
    "Arrondissez les montants à 2 décimales et les taux à 1 décimale.",
    "Pour la question de synthèse, rédigez un paragraphe argumenté citant au moins trois indicateurs chiffrés.",
  ],
};

export const examSections: ExamSection[] = [
  {
    code: "A",
    title: "Partie A — Indicateurs de vente",
    objective: "Prendre en main ventes_exam.xlsx et produire les agrégats de base.",
    difficulty: "facile",
    questions: [
      {
        id: "A1",
        competence: "Nombre de tickets par magasin",
        prompt: "Comptez le nombre de tickets (lignes de ventes_exam) pour chaque magasin.",
        sources: ["ventes_exam.xlsx"],
        columns: ["store_id", "sale_id"],
        method: "NB.SI sur store_id, ou un tableau croisé dynamique (store_id en lignes, nombre de sale_id).",
        difficulty: "facile",
        points: 1,
      },
      {
        id: "A2",
        competence: "Chiffre d'affaires TTC par magasin",
        prompt:
          "Reconstruisez le total de chaque ticket : sale_total_ht = somme des product_i_price_ht du ticket, " +
          "puis sale_total_ttc = sale_total_ht × 1,20 (TVA 20 %). Additionnez ensuite le TTC par magasin.",
        sources: ["ventes_exam.xlsx"],
        columns: ["store_id", "product_1_price_ht", "product_2_price_ht", "…"],
        method: "SOMME des product_i_price_ht par ligne, ×1,20, puis SOMME.SI par store_id.",
        difficulty: "facile",
        points: 2,
      },
      {
        id: "A3",
        competence: "Panier moyen TTC par magasin",
        prompt: "Calculez le panier moyen TTC de chaque magasin (CA TTC du magasin ÷ nombre de tickets du magasin).",
        sources: ["ventes_exam.xlsx"],
        columns: ["store_id"],
        method: "Réutilisez A1 (tickets) et A2 (CA TTC).",
        difficulty: "facile",
        points: 1,
      },
      {
        id: "A4",
        competence: "Nombre moyen d'articles par ticket",
        prompt: "Calculez le nombre moyen d'articles par ticket sur l'ensemble du réseau (moyenne de la colonne article_count).",
        sources: ["ventes_exam.xlsx"],
        columns: ["article_count"],
        method: "MOYENNE de article_count.",
        difficulty: "facile",
        points: 1,
      },
    ],
  },
  {
    code: "B",
    title: "Partie B — Performance des équipes de vente",
    objective: "Croiser ventes et vendeurs pour mesurer l'efficacité commerciale.",
    difficulty: "intermediaire",
    questions: [
      {
        id: "B1",
        competence: "Indice de vente additionnelle par magasin",
        prompt: "Calculez, pour chaque magasin, la part des tickets comportant plus d'un article (article_count > 1).",
        sources: ["ventes_exam.xlsx"],
        columns: ["store_id", "article_count"],
        method: "NB.SI.ENS (store_id et article_count>1) ÷ nombre de tickets du magasin.",
        difficulty: "intermediaire",
        points: 1.5,
      },
      {
        id: "B2",
        competence: "Panier moyen TTC par vendeur",
        prompt: "Calculez le panier moyen TTC par vendeur (regroupement par employee_id), à partir du TTC reconstruit en A2.",
        sources: ["ventes_exam.xlsx"],
        columns: ["employee_id"],
        method: "Tableau croisé dynamique : employee_id en lignes, moyenne du TTC du ticket.",
        difficulty: "intermediaire",
        points: 1.5,
      },
      {
        id: "B3",
        competence: "CA TTC par vendeur actif",
        prompt:
          "Pour chaque magasin, divisez le CA TTC du magasin (A2) par le nombre de vendeurs ENCORE en poste " +
          "(lignes de employes.xlsx dont end_date est vide). Comparez les magasins entre eux.",
        sources: ["ventes_exam.xlsx", "employes.xlsx"],
        columns: ["store_id", "end_date"],
        method: "NB.SI.ENS sur employes (store_id, end_date vide) pour l'effectif actif, puis CA TTC ÷ effectif.",
        difficulty: "intermediaire",
        points: 2,
      },
      {
        id: "B4",
        competence: "Taux de remise par magasin",
        prompt:
          "Calculez le taux de remise moyen par magasin = somme(sale_total_discount) ÷ CA TTC du magasin (A2). " +
          "Un magasin qui « fait beaucoup de promotions » aura un taux élevé.",
        sources: ["ventes_exam.xlsx"],
        columns: ["store_id", "sale_total_discount"],
        method: "SOMME.SI de sale_total_discount par store_id, divisé par le CA TTC du magasin.",
        difficulty: "intermediaire",
        points: 1,
      },
    ],
  },
  {
    code: "C",
    title: "Partie C — Rentabilité et structure de coûts",
    objective: "Évaluer la rentabilité réelle et le poids des charges, magasin par magasin.",
    difficulty: "intermediaire",
    questions: [
      {
        id: "C1",
        competence: "Résultat annuel par magasin",
        prompt:
          "Pour chaque magasin, calculez le résultat annuel = somme(ca_ttc) − somme(total_store_cost) sur les 12 mois. " +
          "Indiquez le(s) magasin(s) déficitaire(s).",
        sources: ["store_month_costs.xlsx"],
        columns: ["store_id", "ca_ttc", "total_store_cost"],
        method: "SOMME.SI de ca_ttc et de total_store_cost par store_id, puis différence.",
        difficulty: "intermediaire",
        points: 1.5,
      },
      {
        id: "C2",
        competence: "Poids de la masse salariale",
        prompt:
          "Calculez la part de la masse salariale dans les charges = somme(gross_payroll + employer_contrib) ÷ somme(total_store_cost), par magasin.",
        sources: ["store_month_costs.xlsx"],
        columns: ["store_id", "gross_payroll", "employer_contrib", "total_store_cost"],
        method: "SOMME.SI des trois colonnes par store_id, puis ratio.",
        difficulty: "intermediaire",
        points: 1.5,
      },
      {
        id: "C3",
        competence: "Chiffre d'affaires au m²",
        prompt: "Calculez le CA TTC annuel au mètre carré de chaque magasin = somme(ca_ttc) ÷ surface (issue de magasins.xlsx).",
        sources: ["store_month_costs.xlsx", "magasins.xlsx"],
        columns: ["store_id", "ca_ttc", "surface"],
        method: "RECHERCHEV de la surface dans magasins.xlsx, puis CA TTC ÷ surface.",
        difficulty: "intermediaire",
        points: 1,
      },
      {
        id: "C4",
        competence: "Effort promotionnel rapporté au CA",
        prompt:
          "Calculez le taux d'effort marketing par magasin = somme(local_marketing) ÷ somme(ca_ttc). " +
          "Cet indicateur teste directement l'hypothèse du PDG (« faire plus de promotions »).",
        sources: ["store_month_costs.xlsx"],
        columns: ["store_id", "local_marketing", "ca_ttc"],
        method: "SOMME.SI de local_marketing et de ca_ttc par store_id, puis ratio.",
        difficulty: "intermediaire",
        points: 1,
      },
    ],
  },
  {
    code: "D",
    title: "Partie D — Diagnostic RH et synthèse",
    objective: "Mesurer l'instabilité des équipes et trancher le débat métier.",
    difficulty: "avance",
    questions: [
      {
        id: "D1",
        competence: "Ancienneté moyenne des vendeurs",
        prompt: "Calculez l'ancienneté moyenne (anciennete_mois) des vendeurs encore en poste, par magasin.",
        sources: ["employes.xlsx"],
        columns: ["store_id", "anciennete_mois", "end_date"],
        method: "MOYENNE.SI.ENS de anciennete_mois (store_id, end_date vide).",
        difficulty: "avance",
        points: 1,
      },
      {
        id: "D2",
        competence: "Taux de renouvellement de l'équipe",
        prompt:
          "Pour chaque magasin, comptez (a) les départs (end_date renseignée) et (b) les embauches en cours d'année " +
          "(hire_date à partir du 1er janvier de l'année étudiée). Rapportez ce total à l'effectif du magasin pour obtenir un taux de renouvellement.",
        sources: ["employes.xlsx"],
        columns: ["store_id", "hire_date", "end_date"],
        method: "NB.SI.ENS pour les départs et pour les embauches récentes, divisé par l'effectif total du magasin.",
        difficulty: "avance",
        points: 1.5,
      },
      {
        id: "D3",
        competence: "Synthèse argumentée et recommandations",
        prompt:
          "Le réseau compte plusieurs magasins déficitaires (C1) : leurs causes ne sont pas forcément les mêmes. " +
          "Repérez celui dont la difficulté s'explique par l'INSTABILITÉ DE L'ÉQUIPE : ancienneté la plus faible (D1) " +
          "et renouvellement le plus élevé (D2). Montrez ensuite que, pour ce magasin, le taux de remise (B4) et l'effort " +
          "marketing (C4) ne sont PAS inférieurs aux autres — l'hypothèse « plus de promotions » du PDG n'explique donc pas " +
          "sa contre-performance — alors que son CA par vendeur (B3) et son ancienneté (D1) révèlent le vrai problème. " +
          "Citez au moins TROIS indicateurs chiffrés, concluez et proposez deux actions correctives.",
        sources: ["toutes les parties précédentes"],
        columns: [],
        method: "Réponse rédigée : comparer le magasin faible aux autres et montrer quelle hypothèse les données soutiennent.",
        difficulty: "avance",
        points: 1.5,
      },
    ],
  },
];

export const examQuestions: ExamQuestion[] = examSections.flatMap((section) => section.questions);

export const examTotalPoints = examQuestions.reduce((sum, question) => sum + question.points, 0);

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facile: "facile",
  intermediaire: "intermédiaire",
  avance: "avancé",
};

// ---------------------------------------------------------------------------
// Corrigé enseignant : calculé directement depuis le dataset pour garantir que
// chaque énoncé est réellement solvable et fournir une grille de correction.
// ---------------------------------------------------------------------------

export interface StoreAnswerRow {
  storeId: string;
  type: string;
  zone: string;
  status: string;
  tickets: number;
  caTtc: number;
  averageBasketTtc: number;
  averageArticlesPerTicket: number;
  additionalSaleIndex: number;
  caPerActiveSeller: number;
  discountRate: number;
  annualResult: number;
  payrollWeight: number;
  caPerSquareMeter: number;
  marketingRate: number;
  averageTenureMonths: number;
  departures: number;
  midYearHires: number;
  headcount: number;
}

export interface ExamAnswerKey {
  networkAverageArticlesPerTicket: number;
  stores: StoreAnswerRow[];
  /** Magasin volontairement dégradé par le scénario (cible pédagogique : turnover). */
  targetStoreId: string;
  /** Tous les magasins déficitaires sur l'année (peuvent avoir des causes différentes). */
  lossMakingStoreIds: string[];
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function computeAnswerKey(dataset: GeneratedDataset): ExamAnswerKey {
  const yearStart = `${dataset.config.year}-01-01`;
  const statusByStore = new Map(
    dataset.storePerformanceApplied.map((entry) => [entry.targetStoreId, entry.label]),
  );

  const stores: StoreAnswerRow[] = dataset.stores.map((store) => {
    const sales = dataset.sales.filter((sale) => sale.storeId === store.id);
    const tickets = sales.length;
    const caTtc = sales.reduce((sum, sale) => sum + sale.totalPaid, 0);
    const multiArticleTickets = sales.filter((sale) => sale.lineCount > 1).length;
    const articlesTotal = sales.reduce((sum, sale) => sum + sale.lineCount, 0);

    const lines = dataset.saleLines.filter((line) => line.storeId === store.id);
    const discountTotal = lines.reduce((sum, line) => sum + line.totalDiscountApplied, 0);

    const employees = dataset.employees.filter((employee) => employee.storeId === store.id);
    const activeEmployees = employees.filter((employee) => !employee.endDate);
    const departures = employees.filter((employee) => employee.endDate).length;
    const midYearHires = employees.filter((employee) => employee.hireDate >= yearStart).length;
    const tenureSum = activeEmployees.reduce((sum, employee) => sum + employee.tenureMonths, 0);

    const costs = dataset.storeMonthCosts.filter((cost) => cost.storeId === store.id);
    const costCaTtc = costs.reduce((sum, cost) => sum + cost.caTtc, 0);
    const totalCost = costs.reduce((sum, cost) => sum + cost.totalStoreCost, 0);
    const payroll = costs.reduce((sum, cost) => sum + cost.grossPayroll + cost.employerContrib, 0);
    const marketing = costs.reduce((sum, cost) => sum + cost.localMarketing, 0);

    return {
      storeId: store.id,
      type: store.type,
      zone: store.zone,
      status: statusByStore.get(store.id) ?? "neutre",
      tickets,
      caTtc: round(caTtc),
      averageBasketTtc: tickets > 0 ? round(caTtc / tickets) : 0,
      averageArticlesPerTicket: tickets > 0 ? round(articlesTotal / tickets) : 0,
      additionalSaleIndex: tickets > 0 ? round((multiArticleTickets / tickets) * 100, 1) : 0,
      caPerActiveSeller: activeEmployees.length > 0 ? round(caTtc / activeEmployees.length) : 0,
      discountRate: caTtc > 0 ? round((discountTotal / caTtc) * 100, 1) : 0,
      annualResult: round(costCaTtc - totalCost),
      payrollWeight: totalCost > 0 ? round((payroll / totalCost) * 100, 1) : 0,
      caPerSquareMeter: store.surface > 0 ? round(costCaTtc / store.surface) : 0,
      marketingRate: costCaTtc > 0 ? round((marketing / costCaTtc) * 100, 1) : 0,
      averageTenureMonths: activeEmployees.length > 0 ? round(tenureSum / activeEmployees.length, 1) : 0,
      departures,
      midYearHires,
      headcount: employees.length,
    };
  });

  const networkArticles = dataset.sales.length
    ? round(dataset.sales.reduce((sum, sale) => sum + sale.lineCount, 0) / dataset.sales.length)
    : 0;

  // La cible pédagogique est le magasin que le scénario a délibérément dégradé
  // (turnover), pas simplement le pire résultat : un autre magasin peut perdre
  // davantage d'argent pour des raisons différentes.
  const targetStoreId =
    dataset.storePerformanceApplied[0]?.targetStoreId ??
    stores.reduce((worst, current) =>
      current.annualResult < worst.annualResult ? current : worst,
    ).storeId;

  const lossMakingStoreIds = stores
    .filter((store) => store.annualResult < 0)
    .map((store) => store.storeId);

  return {
    networkAverageArticlesPerTicket: networkArticles,
    stores,
    targetStoreId,
    lossMakingStoreIds,
  };
}

// ---------------------------------------------------------------------------
// Mise en forme Excel
// ---------------------------------------------------------------------------

const TITLE_COLOR = "FF1E3A46";
const ACCENT_COLOR = "FFD65A31";
const ANSWER_FILL = "FFF8F1DC";

function decorateTitleCell(cell: ExcelJS.Cell) {
  cell.font = { size: 18, bold: true, color: { argb: TITLE_COLOR } };
  cell.alignment = { vertical: "middle" };
}

function decorateHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFDF8EE" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT_COLOR } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 26;
}

function buildGuideSheet(workbook: ExcelJS.Workbook) {
  const guide = workbook.addWorksheet("Consignes");
  guide.columns = [{ width: 26 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }];

  guide.mergeCells("A1:E1");
  guide.getCell("A1").value = examMeta.title;
  decorateTitleCell(guide.getCell("A1"));

  guide.mergeCells("A2:E2");
  guide.getCell("A2").value = `${examMeta.subtitle} — durée conseillée : ${examMeta.durationMinutes} min — noté sur ${examTotalPoints} points`;
  guide.getCell("A2").font = { italic: true, color: { argb: TITLE_COLOR } };

  let cursor = 4;
  const writeBlock = (heading: string, lines: string[]) => {
    guide.getCell(`A${cursor}`).value = heading;
    guide.getCell(`A${cursor}`).font = { bold: true, size: 12, color: { argb: ACCENT_COLOR } };
    cursor += 1;
    for (const line of lines) {
      guide.mergeCells(`A${cursor}:E${cursor}`);
      const cell = guide.getCell(`A${cursor}`);
      cell.value = line;
      cell.alignment = { wrapText: true, vertical: "top" };
      guide.getRow(cursor).height = Math.max(18, Math.ceil(line.length / 95) * 16);
      cursor += 1;
    }
    cursor += 1;
  };

  writeBlock("Contexte métier", [examMeta.context]);
  writeBlock(
    "Fichiers de travail",
    examMeta.workingFiles.map((entry) => `${entry.file} — ${entry.description}`),
  );
  writeBlock("À retenir", examMeta.reminders);
  writeBlock("Consignes générales", examMeta.generalInstructions);

  guide.getCell(`A${cursor}`).value = "Barème";
  guide.getCell(`A${cursor}`).font = { bold: true, size: 12, color: { argb: ACCENT_COLOR } };
  cursor += 1;
  const baremeHeader = guide.getRow(cursor);
  baremeHeader.getCell(1).value = "Partie";
  baremeHeader.getCell(2).value = "Objectif";
  baremeHeader.getCell(3).value = "Niveau";
  baremeHeader.getCell(4).value = "Points";
  decorateHeaderRow(baremeHeader);
  guide.mergeCells(`B${cursor}:C${cursor}`);
  cursor += 1;
  for (const section of examSections) {
    const points = section.questions.reduce((sum, question) => sum + question.points, 0);
    const row = guide.getRow(cursor);
    row.getCell(1).value = section.title;
    row.getCell(2).value = section.objective;
    row.getCell(3).value = DIFFICULTY_LABEL[section.difficulty];
    row.getCell(4).value = points;
    row.alignment = { vertical: "top", wrapText: true };
    guide.mergeCells(`B${cursor}:C${cursor}`);
    cursor += 1;
  }
  const totalRow = guide.getRow(cursor);
  totalRow.getCell(1).value = "Total";
  totalRow.getCell(4).value = examTotalPoints;
  totalRow.font = { bold: true };
}

function buildSubjectSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Sujet", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "id", key: "id", width: 6 },
    { header: "partie", key: "partie", width: 30 },
    { header: "indicateur", key: "competence", width: 30 },
    { header: "enonce", key: "prompt", width: 62 },
    { header: "source", key: "sources", width: 26 },
    { header: "methode", key: "method", width: 40 },
    { header: "niveau", key: "difficulty", width: 14 },
    { header: "points", key: "points", width: 8 },
    { header: "reponse", key: "answer", width: 24 },
  ];
  decorateHeaderRow(sheet.getRow(1));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };

  for (const section of examSections) {
    for (const question of section.questions) {
      const row = sheet.addRow({
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
      const answerCell = row.getCell("answer");
      answerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ANSWER_FILL } };
      answerCell.border = {
        top: { style: "thin", color: { argb: ACCENT_COLOR } },
        right: { style: "thin", color: { argb: ACCENT_COLOR } },
        bottom: { style: "thin", color: { argb: ACCENT_COLOR } },
        left: { style: "thin", color: { argb: ACCENT_COLOR } },
      };
    }
  }
}

function buildAnswerKeySheet(workbook: ExcelJS.Workbook, key: ExamAnswerKey) {
  const sheet = workbook.addWorksheet("Corrige enseignant", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "store_id", key: "storeId", width: 10 },
    { header: "type", key: "type", width: 12 },
    { header: "zone", key: "zone", width: 14 },
    { header: "statut", key: "status", width: 22 },
    { header: "tickets (A1)", key: "tickets", width: 12 },
    { header: "CA TTC (A2)", key: "caTtc", width: 14 },
    { header: "panier TTC (A3)", key: "averageBasketTtc", width: 14 },
    { header: "art./ticket (A4)", key: "averageArticlesPerTicket", width: 14 },
    { header: "IVA % (B1)", key: "additionalSaleIndex", width: 12 },
    { header: "CA/vendeur (B3)", key: "caPerActiveSeller", width: 16 },
    { header: "taux remise % (B4)", key: "discountRate", width: 16 },
    { header: "resultat annuel (C1)", key: "annualResult", width: 18 },
    { header: "masse sal. % (C2)", key: "payrollWeight", width: 16 },
    { header: "CA/m2 (C3)", key: "caPerSquareMeter", width: 12 },
    { header: "marketing % (C4)", key: "marketingRate", width: 14 },
    { header: "anciennete moy. (D1)", key: "averageTenureMonths", width: 18 },
    { header: "departs (D2)", key: "departures", width: 12 },
    { header: "embauches an. (D2)", key: "midYearHires", width: 16 },
    { header: "effectif", key: "headcount", width: 10 },
  ];
  decorateHeaderRow(sheet.getRow(1));

  for (const store of key.stores) {
    const row = sheet.addRow(store);
    if (store.storeId === key.targetStoreId) {
      row.font = { bold: true, color: { argb: "FF9B1C1C" } };
    } else if (store.annualResult < 0) {
      row.font = { color: { argb: "FFB45309" } };
    }
  }

  const note = sheet.addRow({});
  sheet.mergeCells(`A${note.number}:S${note.number}`);
  const noteCell = sheet.getCell(`A${note.number}`);
  noteCell.value =
    `Cible pédagogique (turnover) : ${key.targetStoreId} — en rouge. Magasins déficitaires : ` +
    `${key.lossMakingStoreIds.join(", ") || "aucun"} (causes potentiellement différentes : tous ne relèvent pas du turnover). ` +
    `A4 réseau : ${key.networkAverageArticlesPerTicket} articles/ticket. Conclusion attendue : ${key.targetStoreId} affiche ` +
    `l'ancienneté la plus faible et le renouvellement le plus élevé, un CA par vendeur dégradé, alors que son taux de remise ` +
    `et son effort marketing ne sont pas inférieurs aux autres — l'hypothèse « plus de promotions » n'est donc pas soutenue ` +
    `par les données, contrairement à l'hypothèse turnover/formation.`;
  noteCell.alignment = { wrapText: true, vertical: "top" };
  note.height = 72;
}

export interface SubjectsWorkbookOptions {
  /** Si fourni, ajoute une feuille « Corrige enseignant » calculée depuis les données. */
  dataset?: GeneratedDataset;
}

export async function buildSubjectsWorkbookBuffer(options: SubjectsWorkbookOptions = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Exercise Data Generator";
  workbook.created = new Date();

  buildGuideSheet(workbook);
  buildSubjectSheet(workbook);

  if (options.dataset) {
    buildAnswerKeySheet(workbook, computeAnswerKey(options.dataset));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
