import test from "node:test";
import assert from "node:assert/strict";

import { defaultConfig } from "../src/lib/generator/config";
import { exportFiles } from "../src/lib/generator/export";
import { generateDataset } from "../src/lib/generator/index";

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
  assert.ok(files["articles.csv"].includes("product_kind"));
  assert.ok(files["canonical.json"].includes("\"saleLines\""));
});
