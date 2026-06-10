import fs from "node:fs";
import path from "node:path";

import { defaultConfig } from "../src/lib/generator/config";
import { exportBinaryFile, exportFiles } from "../src/lib/generator/export";
import { generateDataset } from "../src/lib/generator";
import type { GeneratorConfig } from "../src/lib/generator/types";

// Every versioned sample batch is declared here so it can always be
// regenerated after an engine change (npm run sample).
const batches: Array<{
  directory: string;
  config: GeneratorConfig;
  xlsxFiles: string[];
  writeSummary: boolean;
}> = [
  {
    directory: "representative-batch",
    config: {
      ...defaultConfig,
      seed: 20260404,
      storeCount: 6,
      productCount: 72,
      customerCount: 260,
    },
    xlsxFiles: [],
    writeSummary: true,
  },
  {
    directory: "exam-underperforming-final",
    config: {
      ...defaultConfig,
      seed: 111222,
      storeCount: 8,
      productCount: 100,
      customerCount: 420,
      storePerformancePlan: [
        { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
      ],
    },
    xlsxFiles: ["employes.xlsx", "magasins.xlsx", "store_month_costs.xlsx", "ventes_exam.xlsx"],
    writeSummary: false,
  },
];

async function writeBatch(batch: (typeof batches)[number]) {
  const dataset = generateDataset(batch.config);
  const files = exportFiles(dataset);
  const outputDir = path.join(process.cwd(), "samples", batch.directory);

  fs.mkdirSync(outputDir, { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outputDir, filename), content, "utf8");
  }

  for (const filename of batch.xlsxFiles) {
    const buffer = await exportBinaryFile(dataset, filename);
    if (!buffer) throw new Error(`Unknown xlsx export: ${filename}`);
    fs.writeFileSync(path.join(outputDir, filename), buffer);
  }

  if (batch.writeSummary) {
    const summary = {
      config: batch.config,
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
  }

  const anomalyCount = dataset.summary.anomalyCount;
  console.log(`${batch.directory}: written to ${outputDir} (anomalies: ${anomalyCount})`);
  if (anomalyCount > 0) {
    for (const issue of dataset.summary.validationResults) {
      console.log(`  ${issue.severity}: ${issue.code} ${issue.message}`);
    }
    process.exitCode = 1;
  }
}

async function main() {
  for (const batch of batches) {
    await writeBatch(batch);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
