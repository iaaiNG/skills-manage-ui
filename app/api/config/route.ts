import { NextResponse } from "next/server";
import { getSourceDirs, saveConfig } from "@/lib/skills-engine";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sourceDirs = getSourceDirs();
    return NextResponse.json({ sourceDirs });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sourceDirs } = body;
    if (!Array.isArray(sourceDirs)) {
      return NextResponse.json({ error: "sourceDirs must be an array" }, { status: 400 });
    }
    saveConfig({ sourceDirs });
    return NextResponse.json({ success: true, sourceDirs });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
