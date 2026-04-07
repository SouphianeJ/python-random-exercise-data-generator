import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseConfig } from "@/lib/generator/config";
import { exportBinaryFile, exportFiles } from "@/lib/generator/export";
import { generateDataset } from "@/lib/generator";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file") ?? "canonical.json";
    const config = parseConfig({
      seed: searchParams.get("seed"),
      year: searchParams.get("year"),
      storeCount: searchParams.get("storeCount"),
      productCount: searchParams.get("productCount"),
      customerCount: searchParams.get("customerCount"),
      targetSaleCount: searchParams.get("targetSaleCount") ?? undefined,
      targetSaleLineCount: searchParams.get("targetSaleLineCount") ?? undefined,
      exportMode: searchParams.get("exportMode") ?? undefined,
      includeAccessories: searchParams.get("includeAccessories"),
      includeInterns: searchParams.get("includeInterns"),
      examScenario: searchParams.get("examScenario") ?? undefined,
      examScenarioStoreId: searchParams.get("examScenarioStoreId") ?? undefined,
      examScenarioStrength: searchParams.get("examScenarioStrength") ?? undefined,
    });
    const dataset = generateDataset(config);
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
