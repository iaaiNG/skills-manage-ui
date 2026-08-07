import { NextResponse } from "next/server";
import { toggleSkillSymlink } from "@/lib/skills-engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { skillName, agentKey, enable } = body;

    if (!skillName || !agentKey || typeof enable !== "boolean") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const success = toggleSkillSymlink(skillName, agentKey, enable);
    if (!success) {
      return NextResponse.json({ error: "Failed to toggle symlink" }, { status: 500 });
    }

    return NextResponse.json({ success: true, skillName, agentKey, enable });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
