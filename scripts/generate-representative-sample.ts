import fs from "node:fs";
import path from "node:path";

import { defaultConfig } from "../src/lib/generator/config";
import { exportFiles } from "../src/lib/generator/export";
import { generateDataset } from "../src/lib/generator";

const config = {
  ...defaultConfig,
  seed: 20260404,
  storeCount: 6,
  productCount: 72,
  customerCount: 260,
  targetSaleLineCount: 480,
};

const dataset = generateDataset(config);
const files = exportFiles(dataset);
const outputDir = path.join(process.cwd(), "samples", "representative-batch");

fs.mkdirSync(outputDir, { recursive: true });

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(outputDir, filename), content, "utf8");
}

const summary = {
  config,
  storeTypes: dataset.stores.map((store) => ({
    id: store.id,
    type: store.type,
    zone: store.zone,
    surface: store.surface,
    employeeCount: store.employeeCount,
    footTrafficByHour: store.footTrafficByHour,
    avgBasketValue: store.avgBasketValue,
  })),
  monthlyRevenueTotals: dataset.summary.monthlyRevenueTotals,
  validationResults: dataset.summary.validationResults,
  anomalyCount: dataset.summary.anomalyCount,
};

fs.writeFileSync(
  path.join(outputDir, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(`Representative batch written to ${outputDir}`);
