import { spawn } from "node:child_process";
import { ALLOWED_COMMANDS, stripAnsi } from "@/lib/skills";

export const runtime = "nodejs";

/**
 * POST /api/exec  { argv: string[], cwd?: string }
 * Streams `npx skills <argv...>` output back as SSE:
 *   data: {"type":"out"|"err","data":"..."}
 *   data: {"type":"exit","code":0}
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const argv: unknown = body?.argv;
  const cwd: string | undefined = typeof body?.cwd === "string" ? body.cwd : undefined;
  if (!Array.isArray(argv) || argv.length === 0 || !argv.every((a) => typeof a === "string")) {
    return new Response("argv must be a non-empty string array", { status: 400 });
  }
  if (!ALLOWED_COMMANDS.has(argv[0])) {
    return new Response(`command not allowed: ${argv[0]}`, { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const child = spawn("npx", ["-y", "skills", ...(argv as string[])], {
        env: { ...process.env, NO_COLOR: "1", CI: "1" },
        cwd,
      });

      const onData = (type: "out" | "err") => (chunk: Buffer) =>
        send({ type, data: stripAnsi(chunk.toString("utf8")) });

      child.stdout.on("data", onData("out"));
      child.stderr.on("data", onData("err"));
      child.on("error", (e) => {
        send({ type: "err", data: String(e) });
        send({ type: "exit", code: -1 });
        controller.close();
      });
      child.on("close", (code) => {
        send({ type: "exit", code });
        controller.close();
      });

      req.signal.addEventListener("abort", () => child.kill("SIGTERM"));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
