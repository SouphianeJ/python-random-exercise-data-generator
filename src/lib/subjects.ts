import ExcelJS from "exceljs";

export interface SubjectPrompt {
  theme: string;
  indicator: string;
  prompt: string;
  source: string;
  difficulty: "facile" | "moyen";
}

export const subjectPrompts: SubjectPrompt[] = [
  {
    theme: "Ventes",
    indicator: "Panier moyen magasin",
    prompt: "Calculez le panier moyen TTC par magasin a partir de ventes_exam.xlsx.",
    source: "ventes_exam.xlsx",
    difficulty: "facile",
  },
  {
    theme: "Ventes",
    indicator: "Nombre de tickets magasin",
    prompt: "Comptez le nombre de tickets par magasin.",
    source: "ventes_exam.xlsx",
    difficulty: "facile",
  },
  {
    theme: "Ventes",
    indicator: "CA TTC magasin",
    prompt: "Calculez le chiffre d'affaires TTC par magasin.",
    source: "ventes_exam.xlsx",
    difficulty: "facile",
  },
  {
    theme: "Vendeur",
    indicator: "Panier moyen vendeur",
    prompt: "Calculez le panier moyen TTC par vendeur.",
    source: "ventes_exam.xlsx",
    difficulty: "facile",
  },
  {
    theme: "Vendeur",
    indicator: "Indice de vente additionnelle",
    prompt: "Calculez la part des tickets avec plus d'un article par vendeur ou par magasin.",
    source: "ventes_exam.xlsx",
    difficulty: "moyen",
  },
  {
    theme: "Client",
    indicator: "Frequence d'achat client",
    prompt: "Comptez le nombre de tickets par client et identifiez les clients les plus fideles.",
    source: "ventes_exam.xlsx",
    difficulty: "moyen",
  },
  {
    theme: "Produits",
    indicator: "Nombre moyen d'articles par ticket",
    prompt: "Calculez la moyenne de line_count sur l'ensemble des tickets.",
    source: "ventes_exam.xlsx",
    difficulty: "facile",
  },
  {
    theme: "Promotions",
    indicator: "Remise moyenne par ticket",
    prompt: "Calculez la remise moyenne par ticket a partir de sale_total_discount.",
    source: "ventes_exam.xlsx",
    difficulty: "facile",
  },
  {
    theme: "Saisonnalite",
    indicator: "CA mensuel",
    prompt: "Calculez le chiffre d'affaires TTC par mois pour observer la saisonnalite.",
    source: "ventes_exam.xlsx",
    difficulty: "moyen",
  },
  {
    theme: "Rentabilite",
    indicator: "Part des charges sur le CA",
    prompt: "Comparez total_store_cost et ca_ttc par magasin-mois.",
    source: "store_month_costs.xlsx",
    difficulty: "moyen",
  },
  {
    theme: "Rentabilite",
    indicator: "Poids de la masse salariale",
    prompt: "Calculez la part de gross_payroll + employer_contrib dans le total des charges.",
    source: "store_month_costs.xlsx",
    difficulty: "moyen",
  },
  {
    theme: "Magasin",
    indicator: "CA au m2",
    prompt: "Calculez le chiffre d'affaires TTC par metre carre a partir de magasins.xlsx et store_month_costs.xlsx.",
    source: "magasins.xlsx + store_month_costs.xlsx",
    difficulty: "moyen",
  },
];

function decorateTitleCell(cell: ExcelJS.Cell) {
  cell.font = { size: 18, bold: true, color: { argb: "FF1E3A46" } };
  cell.alignment = { vertical: "middle" };
}

function decorateHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFDF8EE" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD65A31" },
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 24;
}

function autosize(worksheet: ExcelJS.Worksheet) {
  if (!worksheet.columns) {
    return;
  }

  worksheet.columns.forEach((column) => {
    let maxLength = 14;
    if (!column.eachCell) {
      return;
    }
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      const text =
        typeof value === "object" && value !== null && "text" in value
          ? String(value.text ?? "")
          : String(value ?? "");
      maxLength = Math.max(maxLength, text.length + 2);
    });
    const minimumWidth = column.key === "answer" ? 22 : 14;
    column.width = Math.min(Math.max(maxLength, minimumWidth), 58);
  });
}

export async function buildSubjectsWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  const guide = workbook.addWorksheet("Consignes");
  guide.mergeCells("A1:E1");
  guide.getCell("A1").value = "Sujets Excel";
  decorateTitleCell(guide.getCell("A1"));
  guide.getCell("A3").value = "Fichiers de travail";
  guide.getCell("A3").font = { bold: true };
  guide.getCell("A4").value = "ventes_exam.xlsx : 1 ligne = 1 ticket";
  guide.getCell("A5").value = "store_month_costs.xlsx : charges par magasin-mois";
  guide.getCell("A6").value = "magasins.xlsx : caracteristiques des magasins";
  guide.getCell("A8").value = "Consigne";
  guide.getCell("A8").font = { bold: true };
  guide.getCell("A9").value =
    "Renseignez vos resultats dans la feuille Reponses. La colonne Reponse est volontairement vide.";
  guide.getCell("A10").value =
    "Vous pouvez utiliser SOMME.SI, MOYENNE.SI, NB.SI ou un tableau croise dynamique.";
  guide.getCell("A12").value = "Contexte metier";
  guide.getCell("A12").font = { bold: true };
  guide.mergeCells("A13:E13");
  guide.getCell("A13").value =
    "Le PDG France de la chaine repete que votre magasin doit faire davantage de promotions pour relancer les ventes. Sur le terrain, l'equipe explique plutot les mauvais resultats par une organisation instable, un manque de formation et un turnover eleve. A partir des donnees, determinez quelle hypothese est la plus solide et proposez des actions correctives.";
  guide.getCell("A13").alignment = { wrapText: true, vertical: "top" };
  guide.getRow(13).height = 48;
  guide.columns = [{ width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }];

  const answers = workbook.addWorksheet("Reponses", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  answers.columns = [
    { header: "theme", key: "theme", width: 16 },
    { header: "indicateur", key: "indicator", width: 28 },
    { header: "question", key: "prompt", width: 58 },
    { header: "source", key: "source", width: 28 },
    { header: "niveau", key: "difficulty", width: 12 },
    { header: "reponse", key: "answer", width: 22 },
  ];

  decorateHeaderRow(answers.getRow(1));
  answers.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 6 },
  };

  for (const prompt of subjectPrompts) {
    const row = answers.addRow({
      theme: prompt.theme,
      indicator: prompt.indicator,
      prompt: prompt.prompt,
      source: prompt.source,
      difficulty: prompt.difficulty,
      answer: "",
    });
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell("F").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8F1DC" },
    };
    row.getCell("F").border = {
      top: { style: "thin", color: { argb: "FFD65A31" } },
      right: { style: "thin", color: { argb: "FFD65A31" } },
      bottom: { style: "thin", color: { argb: "FFD65A31" } },
      left: { style: "thin", color: { argb: "FFD65A31" } },
    };
  }

  autosize(answers);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
