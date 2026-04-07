import { NextResponse } from "next/server";

import { buildSubjectsWorkbookBuffer } from "@/lib/subjects";

export async function GET() {
  try {
    const body = await buildSubjectsWorkbookBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="sujets.xlsx"',
      },
    });
  } catch {
    return new NextResponse("Failed to build sujets workbook.", { status: 500 });
  }
}
