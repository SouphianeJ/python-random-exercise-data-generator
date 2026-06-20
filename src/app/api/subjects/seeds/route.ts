import { NextResponse } from "next/server";

import { getTemplate } from "@/lib/subject-templates/registry";
import { searchSeeds } from "@/lib/subject-templates/seed-search";
import type { ParamValues } from "@/lib/subject-templates/types";

const CONTROL_KEYS = new Set(["template", "from", "to", "limit", "file"]);
const MAX_RANGE = 120;

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("template") ?? "";
  const template = getTemplate(templateId);
  if (!template) {
    return new NextResponse("Unknown template.", { status: 404 });
  }

  const baseParams: ParamValues = {};
  for (const [key, value] of searchParams.entries()) {
    if (!CONTROL_KEYS.has(key)) baseParams[key] = value;
  }

  const from = Number.parseInt(searchParams.get("from") ?? "1", 10) || 1;
  const requestedTo = Number.parseInt(searchParams.get("to") ?? String(from + 49), 10) || from + 49;
  const to = Math.min(requestedTo, from + MAX_RANGE - 1);
  const limit = Number.parseInt(searchParams.get("limit") ?? "5", 10) || 5;

  const candidates = searchSeeds(template, baseParams, { from, to, limit });
  return NextResponse.json({ template: templateId, from, to, candidates });
}
