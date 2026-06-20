import { NextResponse } from "next/server";

import { listTemplateInfos } from "@/lib/subject-templates/registry";

export function GET() {
  return NextResponse.json({ templates: listTemplateInfos() });
}
