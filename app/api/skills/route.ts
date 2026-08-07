import { NextResponse } from "next/server";
import { getAllSkills } from "@/lib/skills-engine";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAgentNative = searchParams.get("includeAgentNative") === "true";
    const skills = getAllSkills(includeAgentNative);
    return NextResponse.json({ skills });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
