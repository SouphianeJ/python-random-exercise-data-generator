import { NextResponse } from "next/server";

import { getTemplate } from "@/lib/subject-templates/registry";
import type { ParamValues, SubjectFileKind } from "@/lib/subject-templates/types";

const CONTROL_KEYS = new Set(["template", "from", "to", "limit", "file"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("template") ?? "";
    const template = getTemplate(templateId);
    if (!template) {
      return new NextResponse("Unknown template.", { status: 404 });
    }

    const params: ParamValues = {};
    for (const [key, value] of searchParams.entries()) {
      if (!CONTROL_KEYS.has(key)) params[key] = value;
    }

    const files = await template.buildFiles(params);
    const requestedKind = (searchParams.get("file") ?? "sujet") as SubjectFileKind;
    const file = files.find((entry) => entry.kind === requestedKind);
    if (!file) {
      return new NextResponse("Unknown file kind.", { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.name}"`,
      },
    });
  } catch {
    return new NextResponse("Failed to build subject files.", { status: 500 });
  }
}
