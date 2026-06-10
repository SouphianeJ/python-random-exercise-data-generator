import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseConfig } from "@/lib/generator/config";
import { exportBinaryFile, exportFiles } from "@/lib/generator/export";
import { generateDataset } from "@/lib/generator";
import type { GeneratedDataset, GeneratorConfig } from "@/lib/generator/types";

// Generation is deterministic per config, and downloading the full file set
// hits this route once per file. A small LRU avoids regenerating the dataset
// for every download of the same configuration.
const datasetCache = new Map<string, GeneratedDataset>();
const DATASET_CACHE_LIMIT = 4;

function datasetForConfig(config: GeneratorConfig) {
  const key = JSON.stringify(config);
  const cached = datasetCache.get(key);
  if (cached) {
    datasetCache.delete(key);
    datasetCache.set(key, cached);
    return cached;
  }
  const dataset = generateDataset(config);
  datasetCache.set(key, dataset);
  if (datasetCache.size > DATASET_CACHE_LIMIT) {
    const oldest = datasetCache.keys().next().value;
    if (oldest !== undefined) datasetCache.delete(oldest);
  }
  return dataset;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file") ?? "canonical.json";
    const rawPlan = searchParams.get("storePerformancePlan");
    let storePerformancePlan: unknown;
    if (rawPlan) {
      try {
        storePerformancePlan = JSON.parse(rawPlan);
      } catch {
        return new NextResponse("Invalid storePerformancePlan JSON.", { status: 400 });
      }
    }
    const config = parseConfig({
      seed: searchParams.get("seed"),
      year: searchParams.get("year"),
      storeCount: searchParams.get("storeCount"),
      productCount: searchParams.get("productCount"),
      customerCount: searchParams.get("customerCount"),
      includeAccessories: searchParams.get("includeAccessories"),
      includeInterns: searchParams.get("includeInterns"),
      storePerformancePlan,
    });
    const dataset = datasetForConfig(config);
    const files = exportFiles(dataset);
    const body = files[file as keyof typeof files] ?? (await exportBinaryFile(dataset, file));

    if (!body) {
      return new NextResponse("Unknown export file.", { status: 404 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.endsWith(".json")
          ? "application/json; charset=utf-8"
          : file.endsWith(".xlsx")
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new NextResponse(error.issues.map((issue) => issue.message).join("\n"), {
        status: 400,
      });
    }

    return new NextResponse("Failed to export dataset.", { status: 500 });
  }
}
