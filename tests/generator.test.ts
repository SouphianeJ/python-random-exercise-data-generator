import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import { defaultConfig } from "../src/lib/generator/config";
import { exportBinaryFile, exportFiles } from "../src/lib/generator/export";
import { generateDataset } from "../src/lib/generator/index";
import { buildSubjectsWorkbookBuffer, subjectPrompts } from "../src/lib/subjects";

test("generator is deterministic for a given seed", () => {
  const config = { ...defaultConfig, targetSaleLineCount: 250, customerCount: 120 };
  const first = generateDataset(config);
  const second = generateDataset(config);

  assert.deepEqual(first.stores, second.stores);
  assert.deepEqual(first.saleLines, second.saleLines);
});

test("coherence checks hold for dates and foreign keys", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 99,
    storeCount: 4,
    productCount: 60,
    customerCount: 220,
    targetSaleLineCount: 400,
  });

  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const products = new Set(dataset.products.map((product) => product.id));

  for (const sale of dataset.sales) {
    const employee = employees.get(sale.employeeId);
    assert.ok(employee);
    assert.ok(new Date(employee!.hireDate) <= new Date(`${sale.date}T${sale.time}:00.000Z`));
  }

  for (const line of dataset.saleLines) {
    assert.ok(products.has(line.productId));
    assert.ok(line.priceSold >= 0);
  }

  assert.equal(
    dataset.summary.validationResults.filter((issue) => issue.severity === "error").length,
    0,
  );
});

test("legacy-compatible exports stay stable and line-oriented", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 7,
    storeCount: 3,
    productCount: 36,
    customerCount: 150,
    targetSaleLineCount: 220,
  });
  const files = exportFiles(dataset);

  assert.ok(files["ventes.csv"].includes("sale_id;line_id;date;time"));
  assert.ok(files["ventes_filtre.csv"].includes("sale_id;line_id;date;time"));
  assert.ok(files["ventes_exam.csv"].includes("sale_id;date;time;store_id;employee_id;customer_id;line_count"));
  assert.ok(files["ventes_exam.csv"].includes("product_1_id"));
  assert.ok(files["articles.csv"].includes("product_kind"));
  assert.ok(files["store_month_costs.csv"].includes("year_month;store_id;rent_month"));
  assert.ok(files["canonical.json"].includes("\"saleLines\""));
  assert.ok(!files["ventes_exam.csv"].includes("open_to_clients_hours"));
  assert.ok(!files["ventes_exam.csv"].includes("tva_rate"));
  assert.ok(!files["ventes_exam.csv"].includes("line_id"));
});

test("xlsx exports keep the same tables as csv exports", async () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 1234,
    storeCount: 3,
    productCount: 30,
    customerCount: 120,
    targetSaleLineCount: 180,
  });

  const examWorkbookBuffer = await exportBinaryFile(dataset, "ventes_exam.xlsx");
  assert.ok(examWorkbookBuffer);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(examWorkbookBuffer!);
  const worksheet = workbook.getWorksheet("ventes_exam");
  assert.ok(worksheet);
  assert.equal(worksheet!.getRow(1).getCell(1).value, "sale_id");
  assert.equal(worksheet!.getRow(2).getCell(1).value !== null, true);
  assert.ok(String(worksheet!.getRow(1).values).includes("product_1_id"));
});

test("subjects workbook is structured and student-ready", async () => {
  const workbookBuffer = await buildSubjectsWorkbookBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer);

  const guide = workbook.getWorksheet("Consignes");
  const answers = workbook.getWorksheet("Reponses");

  assert.ok(guide);
  assert.ok(answers);
  assert.equal(guide!.getCell("A1").value, "Sujets Excel");
  assert.equal(answers!.getRow(1).getCell(1).value, "theme");
  assert.equal(answers!.rowCount, subjectPrompts.length + 1);
  assert.equal(answers!.getRow(2).getCell(6).value, "");
  assert.equal(answers!.getColumn(6).width, 22);
});

test("vat and store-month charges are coherent", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 6060,
    storeCount: 6,
    productCount: 80,
    customerCount: 260,
    targetSaleLineCount: 600,
  });

  for (const line of dataset.saleLines) {
    assert.equal(line.tvaRate, 0.2);
    assert.ok(Math.abs((line.priceHt + line.tvaAmount) - line.priceSold) <= 0.02);
    assert.ok(Math.abs(line.priceHt - Number((line.priceSold / 1.2).toFixed(2))) <= 0.02);
  }

  const linesByStoreMonth = new Map<string, { ttc: number; ht: number; count: number }>();
  for (const line of dataset.saleLines) {
    const key = `${line.storeId}:${line.yearMonth}`;
    const bucket = linesByStoreMonth.get(key) ?? { ttc: 0, ht: 0, count: 0 };
    bucket.ttc += line.priceSold;
    bucket.ht += line.priceHt;
    bucket.count += 1;
    linesByStoreMonth.set(key, bucket);
  }

  for (const cost of dataset.storeMonthCosts) {
    const key = `${cost.storeId}:${cost.yearMonth}`;
    const aggregate = linesByStoreMonth.get(key);
    assert.ok(aggregate);
    assert.ok(Math.abs(cost.caTtc - Number(aggregate!.ttc.toFixed(2))) <= 0.05);
    assert.ok(Math.abs(cost.caHt - Number(aggregate!.ht.toFixed(2))) <= 0.05);
    assert.equal(cost.nbLines, aggregate!.count);
    assert.ok(cost.totalStoreCost >= cost.grossPayroll);
    assert.ok(cost.employerContrib > 0);
  }
});

test("exam scenarios remain optional and expose metadata when active", () => {
  const baseline = generateDataset({
    ...defaultConfig,
    seed: 3030,
    storeCount: 6,
    productCount: 80,
    customerCount: 260,
    targetSaleLineCount: 700,
  });
  assert.equal(baseline.examScenarioApplied, undefined);

  const withScenario = generateDataset({
    ...defaultConfig,
    seed: 3030,
    storeCount: 6,
    productCount: 80,
    customerCount: 260,
    targetSaleLineCount: 700,
    examScenario: "underperforming_sales_execution",
    examScenarioStrength: "medium",
  });

  assert.ok(withScenario.examScenarioApplied);
  assert.equal(withScenario.summary.examScenarioApplied?.presetId, "underperforming_sales_execution");
  assert.ok(withScenario.summary.warnings.some((warning) => warning.includes("Exam scenario active")));
});
