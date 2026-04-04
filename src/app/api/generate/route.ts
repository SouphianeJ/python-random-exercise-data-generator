import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseConfig } from "@/lib/generator/config";
import { generateDataset } from "@/lib/generator";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const config = parseConfig(payload);
    const dataset = generateDataset(config);
    return NextResponse.json({ dataset });
  } catch (error) {
    if (error instanceof ZodError) {
      return new NextResponse(error.issues.map((issue) => issue.message).join("\n"), {
        status: 400,
      });
    }

    return new NextResponse("Failed to generate dataset.", { status: 500 });
  }
}
