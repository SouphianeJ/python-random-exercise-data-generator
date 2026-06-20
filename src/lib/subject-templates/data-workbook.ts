import ExcelJS from "exceljs";

import { tabularExports } from "../generator/tabular";
import type { GeneratedDataset } from "../generator/types";
import type { TabularExportName } from "../generator/tabular";

const HEADER_COLOR = "FF1E3A46";

/**
 * Construit un classeur « données » regroupant plusieurs tables du dataset,
 * une feuille par table. Sert de fichier de travail unique pour l'élève.
 */
export async function buildDataWorkbookBuffer(
  dataset: GeneratedDataset,
  sheets: readonly TabularExportName[],
) {
  const tables = tabularExports(dataset);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Exercise Data Generator";
  workbook.created = new Date(Date.UTC(2024, 0, 1));
  workbook.modified = workbook.created;

  for (const name of sheets) {
    const rows = tables[name];
    const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    if (rows.length === 0) {
      sheet.addRow(["(vide)"]);
      continue;
    }
    const headers = Object.keys(rows[0]);
    sheet.columns = headers.map((header) => ({ header, key: header, width: 16 }));
    for (const row of rows) {
      sheet.addRow(row);
    }
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFF8F4EA" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 22;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
