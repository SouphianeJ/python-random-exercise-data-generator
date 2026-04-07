import { tabularExports, type RowValue, type TabularExportName } from "./tabular";
import type { GeneratedDataset } from "./types";
import { buildTableWorkbookBuffer } from "@/lib/xlsx";

function formatCell(value: RowValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function escapeCell(value: string) {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv<T extends Record<string, RowValue>>(rows: T[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(";"),
    ...rows.map((row) =>
      headers.map((header) => escapeCell(formatCell(row[header]))).join(";"),
    ),
  ];
  return `\ufeff${lines.join("\n")}`;
}

export function exportFiles(dataset: GeneratedDataset) {
  const tables = tabularExports(dataset);

  return {
    "magasins.csv": toCsv(tables.magasins),
    "employes.csv": toCsv(tables.employes),
    "articles.csv": toCsv(tables.articles),
    "clients.csv": toCsv(tables.clients),
    "ventes.csv": toCsv(tables.ventes),
    "ventes_filtre.csv": toCsv(tables.ventes_filtre),
    "ventes_exam.csv": toCsv(tables.ventes_exam),
    "store_month_costs.csv": toCsv(tables.store_month_costs),
    "canonical.json": JSON.stringify(dataset, null, 2),
  };
}

function tabularNameFromFilename(file: string): TabularExportName | null {
  switch (file) {
    case "magasins.csv":
    case "magasins.xlsx":
      return "magasins";
    case "employes.csv":
    case "employes.xlsx":
      return "employes";
    case "articles.csv":
    case "articles.xlsx":
      return "articles";
    case "clients.csv":
    case "clients.xlsx":
      return "clients";
    case "ventes.csv":
    case "ventes.xlsx":
      return "ventes";
    case "ventes_filtre.csv":
    case "ventes_filtre.xlsx":
      return "ventes_filtre";
    case "ventes_exam.csv":
    case "ventes_exam.xlsx":
      return "ventes_exam";
    case "store_month_costs.csv":
    case "store_month_costs.xlsx":
      return "store_month_costs";
    default:
      return null;
  }
}

export async function exportBinaryFile(dataset: GeneratedDataset, file: string) {
  const tabularName = tabularNameFromFilename(file);
  if (!tabularName || !file.endsWith(".xlsx")) {
    return null;
  }

  const rows = tabularExports(dataset)[tabularName];
  return buildTableWorkbookBuffer(tabularName, rows);
}
