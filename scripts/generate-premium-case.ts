import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildPremiumCorrigeWorkbookBuffer,
  buildPremiumDataWorkbookBuffer,
  buildPremiumSubjectWorkbookBuffer,
  buildPremiumDataset,
} from "../src/lib/premium-case";

async function main() {
  const outputDir = path.join(process.cwd(), "samples", "premium-comparison");
  await mkdir(outputDir, { recursive: true });

  const dataset = buildPremiumDataset();

  const subject = await buildPremiumSubjectWorkbookBuffer();
  const data = await buildPremiumDataWorkbookBuffer(dataset);
  const corrige = await buildPremiumCorrigeWorkbookBuffer(dataset);

  await writeFile(path.join(outputDir, "premium_sujet.xlsx"), subject);
  await writeFile(path.join(outputDir, "premium_donnees.xlsx"), data);
  await writeFile(path.join(outputDir, "premium_corrige.xlsx"), corrige);

  console.log(`premium-comparison: 3 classeurs écrits dans ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
