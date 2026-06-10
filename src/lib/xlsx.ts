import ExcelJS from "exceljs";

import type { TableRow } from "@/lib/generator/tabular";

function autosizeColumns(worksheet: ExcelJS.Worksheet) {
  if (!worksheet.columns) {
    return;
  }

  worksheet.columns.forEach((column) => {
    let maxLength = 12;

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

    column.width = Math.min(maxLength, 40);
  });
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFF8F4EA" } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A46" },
  };
  row.height = 24;
}

export async function buildTableWorkbookBuffer(sheetName: string, rows: TableRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "exercise-data-generator";
  // Fixed timestamp keeps xlsx output byte-stable for a given dataset.
  workbook.created = new Date(Date.UTC(2024, 0, 1));
  workbook.modified = workbook.created;

  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  if (rows.length === 0) {
    worksheet.addRow(["No data"]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  const headers = Object.keys(rows[0]);
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
  }));

  for (const row of rows) {
    worksheet.addRow(row);
  }

  styleHeaderRow(worksheet.getRow(1));
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  autosizeColumns(worksheet);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
