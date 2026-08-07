import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { parseRepoSkillsOutput } from "@/lib/skills";

export const runtime = "nodejs";

// GET /api/repo?repo=owner/name — list skills available in a repository
export async function GET(req: Request) {
  const repo = new URL(req.url).searchParams.get("repo")?.trim();
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return NextResponse.json({ error: "Invalid repo, expected owner/name" }, { status: 400 });
  }
  try {
    const out = await new Promise<string>((resolve, reject) => {
      execFile(
        "npx",
        ["-y", "skills", "add", repo, "-l"],
        { env: { ...process.env, NO_COLOR: "1" }, timeout: 120_000 },
        (err, stdout, stderr) => {
          if (err && !stdout) return reject(new Error(stderr || err.message));
          resolve(stdout + stderr);
        }
      );
    });
    return NextResponse.json({ skills: parseRepoSkillsOutput(out) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
