import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import os from "node:os";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { folderPath } = await req.json();
    if (!folderPath) {
      return NextResponse.json({ error: "Missing folderPath" }, { status: 400 });
    }

    const platform = os.platform();
    let cmd = "open";
    if (platform === "win32") cmd = "explorer";
    else if (platform === "linux") cmd = "xdg-open";

    execFile(cmd, [folderPath], (err) => {
      if (err) console.error("Error opening folder:", err);
    });

    return NextResponse.json({ success: true, folderPath });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
