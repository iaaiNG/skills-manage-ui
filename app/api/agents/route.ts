import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import {
  getAllAgentDefs,
  getEnabledAgentKeys,
  getAllSkills,
  toggleAgentEnabled,
  saveCustomAgent,
  deleteCustomAgent,
  resolveAgentGlobalPath,
  AgentDef,
} from "@/lib/skills-engine";

export const runtime = "nodejs";

export interface AgentInfo extends AgentDef {
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
    const agentDefs = getAllAgentDefs();

    const results: AgentInfo[] = agentDefs.map((agent) => {
      let installed = false;
      let detectedPath = agent.globalPaths.length > 0 
        ? resolveAgentGlobalPath(agent.globalPaths[0])
        : `Project-only (${agent.projectPath})`;

      for (const relPath of agent.globalPaths) {
        const fullPath = resolveAgentGlobalPath(relPath);
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
    const { action, agentKey, enabled, customAgent } = body;

    if (action === "addCustom") {
      if (!customAgent || !customAgent.name || !customAgent.key) {
        return NextResponse.json({ error: "Missing customAgent parameters" }, { status: 400 });
      }
      saveCustomAgent(customAgent);
      return NextResponse.json({ success: true, customAgent });
    }

    if (action === "deleteCustom") {
      if (!agentKey) {
        return NextResponse.json({ error: "Missing agentKey" }, { status: 400 });
      }
      deleteCustomAgent(agentKey);
      return NextResponse.json({ success: true, agentKey });
    }

    if (!agentKey || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing agentKey or enabled" }, { status: 400 });
    }

    const enabledKeys = toggleAgentEnabled(agentKey, enabled);
    return NextResponse.json({ success: true, agentKey, enabled, enabledKeys });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
