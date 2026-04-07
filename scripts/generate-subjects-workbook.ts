import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSubjectsWorkbookBuffer } from "../src/lib/subjects";

async function main() {
  const outputDir = path.join(process.cwd(), "samples");
  await mkdir(outputDir, { recursive: true });
  const workbook = await buildSubjectsWorkbookBuffer();
  await writeFile(path.join(outputDir, "sujets.xlsx"), workbook);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
