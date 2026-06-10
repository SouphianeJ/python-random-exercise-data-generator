import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import { defaultConfig, parseConfig } from "../src/lib/generator/config";
import { exportBinaryFile, exportFiles } from "../src/lib/generator/export";
import { generateDataset } from "../src/lib/generator/index";
import { LOYALTY_POINT_VALUE_EUR } from "../src/lib/generator/economics";
import type { GeneratorConfig } from "../src/lib/generator/types";
import { buildSubjectsWorkbookBuffer, subjectPrompts } from "../src/lib/subjects";

test("generator is deterministic for a given seed", () => {
  const config: GeneratorConfig = {
    ...defaultConfig,
    seed: 321,
    storeCount: 4,
    customerCount: 220,
    storePerformancePlan: [{ storeType: "Discount", performanceStatus: "sous_performant_turnover" }],
  };
  const first = generateDataset(config);
  const second = generateDataset(config);

  assert.deepEqual(first.stores, second.stores);
  assert.deepEqual(first.sales, second.sales);
  assert.deepEqual(first.saleLines, second.saleLines);
  assert.deepEqual(first.storeMonthCosts, second.storeMonthCosts);
});

test("coherence checks hold for dates and foreign keys", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 99,
    storeCount: 4,
    productCount: 60,
    customerCount: 220,
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
  });
  const files = exportFiles(dataset);

  assert.ok(files["ventes.csv"].includes("sale_id;line_id;date;time"));
  assert.ok(files["ventes_filtre.csv"].includes("sale_id;line_id;date;time"));
  assert.ok(
    files["ventes_exam.csv"].includes(
      "sale_id;date;time;store_id;employee_id;customer_id;article_count",
    ),
  );
  assert.ok(files["ventes_exam.csv"].includes("product_1_id"));
  assert.ok(files["ventes_exam.csv"].includes("sale_total_ht;sale_total_ttc;sale_total_discount"));
  assert.ok(files["ventes_exam.csv"].includes("product_1_price_ht"));
  assert.ok(!files["ventes_exam.csv"].includes("product_1_price_sold"));
  assert.ok(!files["ventes_exam.csv"].includes("product_1_category"));
  assert.ok(!files["ventes_exam.csv"].includes("product_1_size"));
  assert.ok(!files["ventes_exam.csv"].includes("product_1_color"));
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
  });

  const examWorkbookBuffer = await exportBinaryFile(dataset, "ventes_exam.xlsx");
  assert.ok(examWorkbookBuffer);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(examWorkbookBuffer! as unknown as ArrayBuffer);
  const worksheet = workbook.getWorksheet("ventes_exam");
  assert.ok(worksheet);
  assert.equal(worksheet!.getRow(1).getCell(1).value, "sale_id");
  assert.equal(worksheet!.getRow(2).getCell(1).value !== null, true);
  assert.ok(String(worksheet!.getRow(1).values).includes("product_1_id"));
  assert.ok(String(worksheet!.getRow(1).values).includes("product_1_price_ht"));
  assert.equal(worksheet!.getRow(2).getCell(8).value, "");
  assert.equal(worksheet!.getRow(2).getCell(9).value, "");
});

test("subjects workbook is structured and student-ready", async () => {
  const workbookBuffer = await buildSubjectsWorkbookBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer as unknown as ArrayBuffer);

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
  });

  for (const line of dataset.saleLines) {
    assert.equal(line.tvaRate, 0.2);
    assert.ok(Math.abs(line.priceHt + line.tvaAmount - line.priceSold) <= 0.02);
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
    const aggregate = linesByStoreMonth.get(key) ?? { ttc: 0, ht: 0, count: 0 };
    assert.ok(Math.abs(cost.caTtc - Number(aggregate.ttc.toFixed(2))) <= 0.05);
    assert.ok(Math.abs(cost.caHt - Number(aggregate.ht.toFixed(2))) <= 0.05);
    assert.equal(cost.nbLines, aggregate.count);
    assert.ok(cost.totalStoreCost >= cost.grossPayroll);
    if (cost.grossPayroll > 0) {
      assert.ok(cost.employerContrib > 0);
    }
  }
});

test("query-string booleans parse correctly in both directions", () => {
  const unchecked = parseConfig({ seed: "32", includeAccessories: "false", includeInterns: "false" });
  assert.equal(unchecked.includeAccessories, false);
  assert.equal(unchecked.includeInterns, false);

  const checked = parseConfig({ seed: "32", includeAccessories: "true", includeInterns: "true" });
  assert.equal(checked.includeAccessories, true);
  assert.equal(checked.includeInterns, true);

  const missing = parseConfig({ seed: "32", includeAccessories: null, includeInterns: undefined });
  assert.equal(missing.includeAccessories, true);
  assert.equal(missing.includeInterns, true);

  const jsonBooleans = parseConfig({ seed: 32, includeAccessories: false, includeInterns: true });
  assert.equal(jsonBooleans.includeAccessories, false);
  assert.equal(jsonBooleans.includeInterns, true);
});

test("every store has exactly 12 cost months, sales or not", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 606060,
    storeCount: 9,
    productCount: 110,
    customerCount: 900,
    storePerformancePlan: [
      { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
      { storeType: "Discount", performanceStatus: "critique_turnover" },
    ],
  });

  const monthsByStore = new Map<string, Set<string>>();
  for (const cost of dataset.storeMonthCosts) {
    const months = monthsByStore.get(cost.storeId) ?? new Set<string>();
    months.add(cost.yearMonth);
    monthsByStore.set(cost.storeId, months);
  }
  for (const store of dataset.stores) {
    assert.equal(monthsByStore.get(store.id)?.size, 12);
  }
});

test("payroll is prorated on hire and departure dates", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 606060,
    storeCount: 9,
    productCount: 110,
    customerCount: 900,
    storePerformancePlan: [
      { storeType: "Discount", performanceStatus: "critique_turnover" },
    ],
  });

  const turnoverStoreId = dataset.storePerformanceApplied[0]!.targetStoreId;
  const team = dataset.employees.filter((employee) => employee.storeId === turnoverStoreId);
  assert.ok(team.some((employee) => employee.endDate !== null));
  assert.ok(team.some((employee) => employee.hireDate >= `${dataset.config.year}-01-01`));

  const fullRoster = team.reduce((sum, employee) => sum + employee.salaryMonthly, 0);
  const payrolls = dataset.storeMonthCosts
    .filter((row) => row.storeId === turnoverStoreId)
    .map((row) => row.grossPayroll);
  assert.equal(payrolls.length, 12);
  // The full roster never works the entire year at the same time, so monthly
  // payroll must always stay below the naive sum of all salaries.
  for (const payroll of payrolls) {
    assert.ok(payroll < fullRoster);
  }
  assert.ok(new Set(payrolls).size > 1);
});

test("loyalty points used always match the applied fidelity discount", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 90210,
    storeCount: 7,
    productCount: 96,
    customerCount: 320,
  });

  const fidelityBySale = new Map<string, number>();
  for (const line of dataset.saleLines) {
    fidelityBySale.set(
      line.saleId,
      (fidelityBySale.get(line.saleId) ?? 0) + line.discountValueFidelity,
    );
  }
  let redemptions = 0;
  for (const sale of dataset.sales) {
    const applied = fidelityBySale.get(sale.id) ?? 0;
    assert.ok(Math.abs(applied - sale.loyaltyPointsUsed * LOYALTY_POINT_VALUE_EUR) <= 0.01);
    if (sale.loyaltyPointsUsed > 0) redemptions += 1;
  }
  assert.ok(redemptions > 0);
});

test("customers never hold loyalty points without a card", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 880088,
    storeCount: 6,
    productCount: 90,
    customerCount: 700,
  });

  for (const customer of dataset.customers) {
    if (!customer.hasLoyaltyCard) {
      assert.equal(customer.loyaltyPoints, 0);
    }
  }
});

test("store estimate columns stay coherent with each other and with sales", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 4242,
    storeCount: 6,
    productCount: 90,
    customerCount: 450,
  });

  const realizedByStore = new Map<string, number>();
  for (const line of dataset.saleLines) {
    realizedByStore.set(
      line.storeId,
      (realizedByStore.get(line.storeId) ?? 0) + line.priceSold,
    );
  }

  for (const store of dataset.stores) {
    // internal coherence: traffic_conversion == daily_foot_traffic x conversion_rate
    const impliedTickets = store.dailyFootTraffic * store.conversionRate;
    assert.ok(Math.abs(impliedTickets - store.trafficConversion) <= 1);

    // external coherence: the revenue estimate stays within a plausible band
    const realizedMonthly = (realizedByStore.get(store.id) ?? 0) / 12;
    const ratio = realizedMonthly / Math.max(1, store.monthlyRevenueEstimate);
    assert.ok(ratio > 0.7 && ratio < 1.4, `store ${store.id} ratio ${ratio.toFixed(2)}`);
  }
});

test("sales never happen before hire or after departure", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 321,
    storeCount: 6,
    productCount: 80,
    customerCount: 300,
    storePerformancePlan: [
      { storeType: "Discount", performanceStatus: "critique_turnover" },
    ],
  });

  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  for (const sale of dataset.sales) {
    const employee = employees.get(sale.employeeId)!;
    const saleMoment = new Date(`${sale.date}T${sale.time}:00.000Z`);
    assert.ok(new Date(employee.hireDate) <= saleMoment);
    if (employee.endDate) {
      assert.ok(saleMoment <= new Date(`${employee.endDate}T23:59:59.999Z`));
    }
  }
});

test("store performance plan remains optional and exposes metadata when active", () => {
  const baseline = generateDataset({
    ...defaultConfig,
    seed: 3030,
    storeCount: 6,
    productCount: 80,
    customerCount: 260,
  });
  assert.equal(baseline.storePerformanceApplied.length, 0);

  const withPlan = generateDataset({
    ...defaultConfig,
    seed: 3030,
    storeCount: 6,
    productCount: 80,
    customerCount: 260,
    storePerformancePlan: [
      { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
    ],
  });

  assert.ok(withPlan.storePerformanceApplied.length > 0);
  assert.equal(
    withPlan.summary.storePerformanceApplied[0]?.performanceStatus,
    "sous_performant_turnover",
  );
  assert.ok(withPlan.summary.warnings.some((warning) => warning.includes("performance plan")));
});

test("store type rules ignore stale incompatible store ids", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 4040,
    storeCount: 6,
    productCount: 80,
    customerCount: 260,
    storePerformancePlan: [
      { storeId: "S01", storeType: "Discount", performanceStatus: "viable" },
      { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
    ],
  });

  const applied = dataset.storePerformanceApplied;
  assert.equal(applied.length, 2);

  for (const rule of applied) {
    const store = dataset.stores.find((entry) => entry.id === rule.targetStoreId);
    assert.ok(store);
    assert.equal(store!.type, "Discount");
  }
});
