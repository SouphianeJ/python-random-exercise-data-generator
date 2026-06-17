import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { defaultConfig } from "../src/lib/generator/config";
import { generateDataset } from "../src/lib/generator";
import { buildSubjectsWorkbookBuffer } from "../src/lib/subjects";

// The exam workbook is built against the same scenario as the versioned
// "exam-underperforming-final" sample so the teacher key matches the data
// students actually receive.
const examConfig = {
  ...defaultConfig,
  seed: 111222,
  storeCount: 8,
  productCount: 100,
  customerCount: 420,
  storePerformancePlan: [
    { storeType: "Discount" as const, performanceStatus: "sous_performant_turnover" as const },
  ],
};

async function main() {
  const outputDir = path.join(process.cwd(), "samples");
  await mkdir(outputDir, { recursive: true });

  const studentWorkbook = await buildSubjectsWorkbookBuffer();
  await writeFile(path.join(outputDir, "sujets.xlsx"), studentWorkbook);

  const dataset = generateDataset(examConfig);
  const teacherWorkbook = await buildSubjectsWorkbookBuffer({ dataset });
  await writeFile(path.join(outputDir, "sujets-corrige.xlsx"), teacherWorkbook);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
