import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SUPPORTED_AGENTS, getEnabledAgentKeys, getAllSkills } from "@/lib/skills-engine";

export const runtime = "nodejs";

export interface AgentInfo {
  name: string;
  key: string;
  globalPaths: string[];
  projectPath: string;
  icon: string;
  description: string;
  installed: boolean;
  enabled: boolean;
  detectedPath: string;
  skillCount: number;
}

export async function GET() {
  try {
    const home = os.homedir();
    const enabledKeys = getEnabledAgentKeys();
    const allSkills = getAllSkills(true);

    const results: AgentInfo[] = SUPPORTED_AGENTS.map((agent) => {
      let installed = false;
      let detectedPath = agent.globalPaths.length > 0 
        ? path.join(home, agent.globalPaths[0])
        : `Project-only (${agent.projectPath})`;

      for (const relPath of agent.globalPaths) {
        const fullPath = path.join(home, relPath);
        if (fs.existsSync(fullPath)) {
          installed = true;
          detectedPath = fullPath;
          break;
        }
      }

      const enabled = enabledKeys.includes(agent.key);
      const skillCount = allSkills.filter((s) => s.linkedAgents.includes(agent.key)).length;

      return {
        ...agent,
        installed,
        enabled,
        detectedPath,
        skillCount,
      };
    });

    return NextResponse.json({ agents: results, enabledCount: enabledKeys.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentKey, enabled } = body;
    if (!agentKey || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing agentKey or enabled" }, { status: 400 });
    }

    const { toggleAgentEnabled } = require("@/lib/skills-engine");
    const enabledKeys = toggleAgentEnabled(agentKey, enabled);
    return NextResponse.json({ success: true, agentKey, enabled, enabledKeys });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
