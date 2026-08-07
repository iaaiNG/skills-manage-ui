import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";

/**
 * Resolve an agent globalPath entry to an absolute filesystem path.
 * Handles:
 *   - Already-absolute paths: /Users/iaaing/.qclaw/skills  -> unchanged
 *   - ~/... paths: ~/.qclaw/skills -> /Users/iaaing/.qclaw/skills
 *   - Relative-to-home paths: .qclaw/skills -> /Users/iaaing/.qclaw/skills
 *   - Incorrectly stripped paths: Users/iaaing/.qclaw/skills -> /Users/iaaing/.qclaw/skills
 */
export function resolveAgentGlobalPath(rawPath: string): string {
  const home = os.homedir();
  const p = rawPath.trim();
  if (!p) return home;
  if (path.isAbsolute(p)) return p;
  if (p.startsWith("~/") || p === "~") return path.join(home, p.slice(p.startsWith("~/") ? 2 : 1));
  // Handle accidentally-stripped leading slash (e.g. "Users/iaaing/.qclaw/skills")
  if (p.startsWith("Users/") || p.startsWith("home/")) return "/" + p;
  return path.join(home, p);
}

const DEFAULT_LIBRARY = path.join(os.homedir(), ".skills-library");
const CONFIG_PATH = path.join(DEFAULT_LIBRARY, "config.json");
const OLD_CONFIG_PATH = path.join(os.homedir(), ".skills-manage-ui", "config.json");

export interface SkillItem {
  name: string;
  sourceDir: string;
  fullPath: string;
  description: string;
  linkedAgents: string[];     // All linked or native agent keys
  symlinkedAgents?: string[];  // Agent keys where it is a Symlink
  nativeAgents?: string[];     // Agent keys where it is a Native physical directory
}

export interface AgentDef {
  name: string;
  key: string;
  globalPaths: string[];
  projectPath: string;
  icon: string;
  description: string;
  isCustom?: boolean;
}

export const SUPPORTED_AGENTS: AgentDef[] = [
  { name: "Antigravity CLI", key: "antigravity-cli", projectPath: ".agents/skills/", globalPaths: [".gemini/antigravity-cli/skills"], icon: "antigravity-cli", description: "Google Antigravity Agent CLI framework" },
  { name: "Antigravity", key: "antigravity", projectPath: ".agents/skills/", globalPaths: [".gemini/antigravity/skills"], icon: "antigravity", description: "Google Antigravity Desktop & Agent platform" },
  { name: "AiderDesk", key: "aider-desk", projectPath: ".aider-desk/skills/", globalPaths: [".aider-desk/skills"], icon: "aider", description: "AiderDesk Skill-driven AI Agent" },
  { name: "Amp", key: "amp", projectPath: ".agents/skills/", globalPaths: [".config/agents/skills"], icon: "amp", description: "Amp AI coding assistant" },
  { name: "Replit", key: "replit", projectPath: ".agents/skills/", globalPaths: [".config/agents/skills"], icon: "replit", description: "Replit Agent workspace" },
  { name: "Universal", key: "universal", projectPath: ".agents/skills/", globalPaths: [".config/agents/skills"], icon: "amp", description: "Universal Agent shared engine" },
  { name: "AstrBot", key: "astrbot", projectPath: "data/skills/", globalPaths: [".astrbot/data/skills"], icon: "astrbot", description: "AstrBot AI bot skill engine" },
  { name: "Autohand Code CLI", key: "autohand-code", projectPath: ".autohand/skills/", globalPaths: [".autohand/skills"], icon: "autohand-code", description: "Autohand Automated Code CLI" },
  { name: "Augment", key: "augment", projectPath: ".augment/skills/", globalPaths: [".augment/skills"], icon: "augment", description: "Augment Code assistant agent" },
  { name: "IBM Bob", key: "bob", projectPath: ".bob/skills/", globalPaths: [".bob/skills"], icon: "bob", description: "IBM Bob AI code assistant" },
  { name: "Claude Code", key: "claude-code", projectPath: ".claude/skills/", globalPaths: [".claude/skills"], icon: "claude-code", description: "Anthropic Claude Code CLI Agent" },
  { name: "OpenClaw", key: "openclaw", projectPath: "skills/", globalPaths: [".openclaw/skills"], icon: "openclaw", description: "OpenClaw open-source Agent framework" },
  { name: "Cline", key: "cline", projectPath: ".agents/skills/", globalPaths: [".cline/skills", ".agents/skills"], icon: "cline", description: "Cline VSCode AI Agent" },
  { name: "Dexto", key: "dexto", projectPath: ".agents/skills/", globalPaths: [".agents/skills"], icon: "cline", description: "Dexto Agent framework" },
  { name: "Kimi Code CLI", key: "kimi-code-cli", projectPath: ".agents/skills/", globalPaths: [".agents/skills"], icon: "kimi", description: "Moonshot Kimi Code CLI Agent" },
  { name: "Loaf", key: "loaf", projectPath: ".agents/skills/", globalPaths: [".agents/skills"], icon: "cline", description: "Loaf AI coding assistant" },
  { name: "Warp", key: "warp", projectPath: ".agents/skills/", globalPaths: [".agents/skills"], icon: "warp", description: "Warp terminal Agent engine" },
  { name: "Zed", key: "zed", projectPath: ".agents/skills/", globalPaths: [".agents/skills"], icon: "cline", description: "Zed editor AI agent" },
  { name: "CodeArts Agent", key: "codearts-agent", projectPath: ".codeartsdoer/skills/", globalPaths: [".codeartsdoer/skills"], icon: "codearts-agent", description: "Huawei CodeArts Doer AI Agent" },
  { name: "CodeBuddy", key: "codebuddy", projectPath: ".codebuddy/skills/", globalPaths: [".codebuddy/skills"], icon: "codebuddy", description: "CodeBuddy AI pair programming assistant" },
  { name: "Codemaker", key: "codemaker", projectPath: ".codemaker/skills/", globalPaths: [".codemaker/skills"], icon: "codemaker", description: "Codemaker AI Agent" },
  { name: "Code Studio", key: "codestudio", projectPath: ".codestudio/skills/", globalPaths: [".codestudio/skills"], icon: "codestudio", description: "Code Studio AI workstation" },
  { name: "Codex", key: "codex", projectPath: ".agents/skills/", globalPaths: [".codex/skills"], icon: "codex", description: "OpenAI Codex code generation engine" },
  { name: "Command Code", key: "command-code", projectPath: ".commandcode/skills/", globalPaths: [".commandcode/skills"], icon: "commandcode", description: "Command Code terminal tool" },
  { name: "Continue", key: "continue", projectPath: ".continue/skills/", globalPaths: [".continue/skills"], icon: "continue", description: "Continue open-source AI coding extension" },
  { name: "Cortex Code", key: "cortex", projectPath: ".cortex/skills/", globalPaths: [".snowflake/cortex/skills"], icon: "cortex", description: "Snowflake Cortex Code AI agent" },
  { name: "Crush", key: "crush", projectPath: ".crush/skills/", globalPaths: [".config/crush/skills"], icon: "crush", description: "Crush AI toolset" },
  { name: "Cursor", key: "cursor", projectPath: ".agents/skills/", globalPaths: [".cursor/skills"], icon: "cursor", description: "Cursor AI IDE Agent engine" },
  { name: "Deep Agents", key: "deepagents", projectPath: ".agents/skills/", globalPaths: [".deepagents/agent/skills"], icon: "deepagents", description: "Deep Agents intelligent agent" },
  { name: "Devin for Terminal", key: "devin", projectPath: ".devin/skills/", globalPaths: [".config/devin/skills"], icon: "devin", description: "Devin for Terminal software engineering agent" },
  { name: "Droid", key: "droid", projectPath: ".factory/skills/", globalPaths: [".factory/skills"], icon: "droid", description: "Factory Droid agent" },
  { name: "Eve", key: "eve", projectPath: "agent/skills/", globalPaths: [], icon: "eve", description: "Eve Project-only dedicated Agent" },
  { name: "Firebender", key: "firebender", projectPath: ".agents/skills/", globalPaths: [".firebender/skills"], icon: "firebender", description: "Firebender programming agent" },
  { name: "ForgeCode", key: "forgecode", projectPath: ".forge/skills/", globalPaths: [".forge/skills"], icon: "forgecode", description: "ForgeCode industrial agent" },
  { name: "Gemini CLI", key: "gemini-cli", projectPath: ".agents/skills/", globalPaths: [".gemini/skills"], icon: "gemini", description: "Google Gemini CLI official agent" },
  { name: "GitHub Copilot", key: "github-copilot", projectPath: ".agents/skills/", globalPaths: [".copilot/skills"], icon: "copilot", description: "GitHub Copilot Workspace & Agent" },
  { name: "Goose", key: "goose", projectPath: ".goose/skills/", globalPaths: [".config/goose/skills"], icon: "goose", description: "Block Goose open-source agent" },
  { name: "Grok Build", key: "grok", projectPath: ".grok/skills/", globalPaths: [".grok/skills"], icon: "grok", description: "xAI Grok Build code assistant" },
  { name: "Hermes Agent", key: "hermes-agent", projectPath: ".hermes/skills/", globalPaths: [".hermes/skills"], icon: "hermes", description: "Hermes Autonomous Agent" },
  { name: "inference.sh", key: "inference-sh", projectPath: ".inferencesh/skills/", globalPaths: [".inferencesh/skills"], icon: "inference-sh", description: "inference.sh cloud agent" },
  { name: "Jazz", key: "jazz", projectPath: ".jazz/skills/", globalPaths: [".jazz/skills"], icon: "jazz", description: "Jazz programming agent" },
  { name: "Junie", key: "junie", projectPath: ".junie/skills/", globalPaths: [".junie/skills"], icon: "junie", description: "Junie programming agent" },
  { name: "iFlow CLI", key: "iflow-cli", projectPath: ".iflow/skills/", globalPaths: [".iflow/skills"], icon: "iflow", description: "iFlow workflow AI agent" },
  { name: "Kilo Code", key: "kilo", projectPath: ".kilocode/skills/", globalPaths: [".kilocode/skills"], icon: "kilo", description: "Kilo Code development agent" },
  { name: "Kimchi", key: "kimchi", projectPath: ".kimchi/skills/", globalPaths: [".config/kimchi/harness/skills"], icon: "kimchi", description: "Kimchi testing & harness agent" },
  { name: "Kiro CLI", key: "kiro-cli", projectPath: ".kiro/skills/", globalPaths: [".kiro/skills"], icon: "kiro", description: "AWS Kiro CLI agent" },
  { name: "Kode", key: "kode", projectPath: ".kode/skills/", globalPaths: [".kode/skills"], icon: "kode", description: "Kode code agent" },
  { name: "Lingma", key: "lingma", projectPath: ".lingma/skills/", globalPaths: [".lingma/skills"], icon: "lingma", description: "Alibaba Tongyi Lingma agent" },
  { name: "MCPJam", key: "mcpjam", projectPath: ".mcpjam/skills/", globalPaths: [".mcpjam/skills"], icon: "mcpjam", description: "MCPJam Model Context Protocol agent" },
  { name: "MiniMax Code", key: "minimax-code", projectPath: ".minimax/skills/", globalPaths: [".minimax/skills"], icon: "minimax", description: "MiniMax Code LLM agent" },
  { name: "Mistral Vibe", key: "mistral-vibe", projectPath: ".vibe/skills/", globalPaths: [".vibe/skills"], icon: "mistral-vibe", description: "Mistral Vibe coding agent" },
  { name: "Moxby", key: "moxby", projectPath: ".moxby/skills/", globalPaths: [".moxby/skills"], icon: "moxby", description: "Moxby AI assistant" },
  { name: "Mux", key: "mux", projectPath: ".mux/skills/", globalPaths: [".mux/skills"], icon: "mux", description: "Mux multi-channel AI assistant" },
  { name: "OpenCode", key: "opencode", projectPath: ".agents/skills/", globalPaths: [".config/opencode/skills"], icon: "opencode", description: "OpenCode open-source agent framework" },
  { name: "OpenHands", key: "openhands", projectPath: ".openhands/skills/", globalPaths: [".openhands/skills"], icon: "openhands", description: "OpenHands (All-Hands AI) software agent" },
  { name: "Ona", key: "ona", projectPath: ".ona/skills/", globalPaths: [".ona/skills"], icon: "ona", description: "Ona intelligent agent" },
  { name: "Pi", key: "pi", projectPath: ".pi/skills/", globalPaths: [".pi/agent/skills"], icon: "pi", description: "Inflection Pi / Pi agent" },
  { name: "Qoder", key: "qoder", projectPath: ".qoder/skills/", globalPaths: [".qoder/skills"], icon: "qoder", description: "Qoder AI agent" },
  { name: "Qoder CN", key: "qoder-cn", projectPath: ".qoder/skills/", globalPaths: [".qoder-cn/skills"], icon: "qoder-cn", description: "Qoder China agent" },
  { name: "Qwen Code", key: "qwen-code", projectPath: ".qwen/skills/", globalPaths: [".qwen/skills"], icon: "qwen-code", description: "Tongyi Qwen Code agent" },
  { name: "Reasonix", key: "reasonix", projectPath: ".reasonix/skills/", globalPaths: [".reasonix/skills"], icon: "reasonix", description: "Reasonix reasoning agent" },
  { name: "Rovo Dev", key: "rovodev", projectPath: ".rovodev/skills/", globalPaths: [".rovodev/skills"], icon: "rovodev", description: "Atlassian Rovo Dev agent" },
  { name: "Roo Code", key: "roo", projectPath: ".roo/skills/", globalPaths: [".roo/skills"], icon: "roo", description: "Roo Code (Roo Cline) AI extension" },
  { name: "Tabnine CLI", key: "tabnine-cli", projectPath: ".tabnine/agent/skills/", globalPaths: [".tabnine/agent/skills"], icon: "tabnine", description: "Tabnine CLI agent engine" },
  { name: "Terramind", key: "terramind", projectPath: ".terramind/skills/", globalPaths: [".terramind/skills"], icon: "terramind", description: "Terramind intelligent agent" },
  { name: "Tinycloud", key: "tinycloud", projectPath: ".tinycloud/skills/", globalPaths: [".tinycloud/skills"], icon: "tinycloud", description: "Tinycloud microservice agent" },
  { name: "Trae", key: "trae", projectPath: ".trae/skills/", globalPaths: [".trae/skills"], icon: "trae", description: "ByteDance Trae IDE AI agent" },
  { name: "Trae CN", key: "trae-cn", projectPath: ".trae/skills/", globalPaths: [".trae-cn/skills"], icon: "trae-cn", description: "Trae China AI agent" },
  { name: "Windsurf", key: "windsurf", projectPath: ".windsurf/skills/", globalPaths: [".codeium/windsurf/skills", ".windsurf/skills"], icon: "windsurf", description: "Codeium Windsurf IDE AI agent" },
  { name: "ZCode", key: "zcode", projectPath: ".zcode/skills/", globalPaths: [".zcode/skills"], icon: "zcode", description: "ZCode code agent" },
  { name: "Zencoder", key: "zencoder", projectPath: ".zencoder/skills/", globalPaths: [".zencoder/skills"], icon: "zencoder", description: "Zencoder AI coding agent" },
  { name: "Zenflow", key: "zenflow", projectPath: ".zencoder/skills/", globalPaths: [".zencoder/skills"], icon: "zencoder", description: "Zenflow workflow agent" },
  { name: "Neovate", key: "neovate", projectPath: ".neovate/skills/", globalPaths: [".neovate/skills"], icon: "neovate", description: "Neovate AI development engine" },
  { name: "Pochi", key: "pochi", projectPath: ".pochi/skills/", globalPaths: [".pochi/skills"], icon: "pochi", description: "Pochi intelligent agent" },
  { name: "PromptScript", key: "promptscript", projectPath: ".agents/skills/", globalPaths: [], icon: "promptscript", description: "PromptScript Project-only dedicated agent" },
  { name: "AdaL", key: "adal", projectPath: ".adal/skills/", globalPaths: [".adal/skills"], icon: "adal", description: "AdaL intelligent agent" },
];

export function getConfig(): { sourceDirs: string[]; enabledAgentKeys?: string[] } {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
    if (fs.existsSync(OLD_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(OLD_CONFIG_PATH, "utf8"));
      saveConfig(data);
      try {
        fs.unlinkSync(OLD_CONFIG_PATH);
        const oldDir = path.dirname(OLD_CONFIG_PATH);
        if (fs.readdirSync(oldDir).length === 0) {
          fs.rmdirSync(oldDir);
        }
      } catch {}
      return data;
    }
  } catch (e) {
    console.error("Error reading config:", e);
  }
  return { sourceDirs: [DEFAULT_LIBRARY] };
}

export function saveConfig(config: { sourceDirs?: string[]; enabledAgentKeys?: string[]; customAgents?: AgentDef[] }) {
  const current = getConfig();
  const next = { ...current, ...config };
  const dirPath = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  if (config.sourceDirs) {
    cleanupOrphanedSymlinks();
  }
}

export function getCustomAgents(): AgentDef[] {
  const conf = getConfig();
  if (Array.isArray((conf as any).customAgents)) {
    return ((conf as any).customAgents as AgentDef[]).map((a) => ({ ...a, isCustom: true }));
  }
  return [];
}

export function getAllAgentDefs(): AgentDef[] {
  const custom = getCustomAgents();
  return [...SUPPORTED_AGENTS, ...custom];
}

export function saveCustomAgent(agent: AgentDef): AgentDef[] {
  const currentCustom = getCustomAgents();
  const index = currentCustom.findIndex((a) => a.key === agent.key);
  const newAgent = { ...agent, isCustom: true };
  let updated: AgentDef[];
  if (index >= 0) {
    updated = [...currentCustom];
    updated[index] = newAgent;
  } else {
    updated = [...currentCustom, newAgent];
  }
  saveConfig({ customAgents: updated });

  const enabledKeys = getEnabledAgentKeys();
  if (!enabledKeys.includes(agent.key)) {
    toggleAgentEnabled(agent.key, true);
  }
  return updated;
}

export function deleteCustomAgent(agentKey: string): AgentDef[] {
  const currentCustom = getCustomAgents();
  const updated = currentCustom.filter((a) => a.key !== agentKey);
  saveConfig({ customAgents: updated });

  const currentEnabled = getEnabledAgentKeys();
  if (currentEnabled.includes(agentKey)) {
    toggleAgentEnabled(agentKey, false);
  }
  cleanupOrphanedSymlinks();
  return updated;
}

export function getSourceDirs(): string[] {
  const conf = getConfig();
  let list: string[] = [];
  if (Array.isArray(conf.sourceDirs) && conf.sourceDirs.length > 0) {
    list = conf.sourceDirs;
  } else {
    list = [DEFAULT_LIBRARY];
  }

  if (!fs.existsSync(DEFAULT_LIBRARY)) {
    try { fs.mkdirSync(DEFAULT_LIBRARY, { recursive: true }); } catch {}
  }

  // Ensure DEFAULT_LIBRARY is present and pinned as item #0
  const isDefault = (p: string) => p.endsWith(".skills-library") || p.includes("/.skills-library");
  const defaults = list.filter(isDefault);
  const others = list.filter((p) => !isDefault(p));

  if (defaults.length === 0) {
    defaults.push(DEFAULT_LIBRARY);
  }

  return Array.from(new Set([...defaults, ...others]));
}

export function getEnabledAgentKeys(): string[] {
  const conf = getConfig();
  if (Array.isArray(conf.enabledAgentKeys)) {
    return conf.enabledAgentKeys;
  }
  const home = os.homedir();
  const defaultEnabled: string[] = [];
  for (const agent of getAllAgentDefs()) {
    for (const relPath of agent.globalPaths) {
      if (fs.existsSync(resolveAgentGlobalPath(relPath))) {
        defaultEnabled.push(agent.key);
        break;
      }
    }
  }
  if (defaultEnabled.length === 0) {
    defaultEnabled.push("antigravity-cli", "claude-code");
  }
  return defaultEnabled;
}

export function toggleAgentEnabled(agentKey: string, enabled: boolean): string[] {
  const currentKeys = getEnabledAgentKeys();
  let nextKeys: string[];
  if (enabled) {
    nextKeys = Array.from(new Set([...currentKeys, agentKey]));
  } else {
    nextKeys = currentKeys.filter((k) => k !== agentKey);
  }
  saveConfig({ enabledAgentKeys: nextKeys });
  return nextKeys;
}

export function parseSkillDescription(content: string): string {
  const descIndex = content.search(/^description:\s*/m);
  if (descIndex !== -1) {
    const afterDesc = content.slice(descIndex);
    const lines = afterDesc.split("\n");
    let descLines: string[] = [];
    let isBlock = false;

    const firstLine = lines[0].replace(/^description:\s*/, "").trim();
    if (/^([>|][+-]?)$/.test(firstLine) || firstLine === "") {
      isBlock = true;
    } else {
      descLines.push(firstLine);
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "---" || /^#\s/.test(line)) break;
      if (/^[a-zA-Z0-9_-]+:/.test(line) && !line.startsWith(" ")) break;
      if (isBlock) {
        if (line.startsWith(" ") || line.startsWith("\t") || line.trim() === "") {
          if (line.trim()) descLines.push(line.trim());
        } else break;
      } else {
        if (line.startsWith(" ") || line.startsWith("\t")) {
          if (line.trim()) descLines.push(line.trim());
        } else break;
      }
    }
    if (descLines.length > 0) {
      return descLines.join(" ").replace(/^["']|["']$/g, "").trim();
    }
  }

  const singleMatch = content.match(/description:\s*(.+)/i);
  if (singleMatch && !/^([>|][+-]?)$/.test(singleMatch[1].trim())) {
    return singleMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  const headingMatch = content.match(/^#\s*(.+)/m);
  if (headingMatch) return headingMatch[1].trim();
  return "";
}

function safeLstat(targetPath: string) {
  try {
    return fs.lstatSync(targetPath);
  } catch {
    return null;
  }
}

function safeRemove(targetPath: string) {
  const stat = safeLstat(targetPath);
  if (!stat) return true;
  try {
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return true;
  } catch (e) {
    console.error(`Failed to remove path ${targetPath}:`, e);
    return false;
  }
}

/**
 * Recursively find directories containing SKILL.md under srcDir
 */
function findSkillsRecursively(
  dir: string,
  sourceDir: string,
  skillsList: { name: string; fullPath: string; sourceDir: string }[] = [],
  depth = 0
): { name: string; fullPath: string; sourceDir: string }[] {
  if (!fs.existsSync(dir) || depth > 10) return skillsList;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === "vendor"
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const hasSkillMd =
          fs.existsSync(path.join(fullPath, "SKILL.md")) ||
          fs.existsSync(path.join(fullPath, "skill.md"));

        if (hasSkillMd) {
          skillsList.push({ name: entry.name, fullPath, sourceDir });
        } else {
          findSkillsRecursively(fullPath, sourceDir, skillsList, depth + 1);
        }
      }
    }
  } catch (e) {
    console.error(`Error traversing directory ${dir}:`, e);
  }
  return skillsList;
}

export function getAllSkills(includeAgentNativeDirs: boolean = false): SkillItem[] {
  cleanupOrphanedSymlinks();
  const home = os.homedir();
  const configuredSourceDirs = getSourceDirs();
  const enabledAgentKeys = getEnabledAgentKeys();

  const allDirsToScan = new Set<string>(configuredSourceDirs);

  if (includeAgentNativeDirs) {
    for (const agent of getAllAgentDefs()) {
      for (const relPath of agent.globalPaths) {
        const fullAgentPath = resolveAgentGlobalPath(relPath);
        if (fs.existsSync(fullAgentPath)) {
          allDirsToScan.add(fullAgentPath);
        }
      }
    }
  }

  const skillsMap = new Map<string, SkillItem>();

  for (const srcDir of allDirsToScan) {
    if (!fs.existsSync(srcDir)) continue;
    const foundSkillDirs = findSkillsRecursively(srcDir, srcDir);

    for (const item of foundSkillDirs) {
      const skillName = item.name;
      const fullPath = item.fullPath;

      let description = "";
      const mdPath = path.join(fullPath, "SKILL.md");
      const lowerMdPath = path.join(fullPath, "skill.md");
      const targetMd = fs.existsSync(mdPath) ? mdPath : fs.existsSync(lowerMdPath) ? lowerMdPath : null;

      if (targetMd) {
        try {
          const content = fs.readFileSync(targetMd, "utf8");
          description = parseSkillDescription(content);
        } catch {}
      }

      const symlinkedAgents: string[] = [];
      const nativeAgents: string[] = [];
      const linkedAgents: string[] = [];

      for (const agent of getAllAgentDefs()) {
        if (!enabledAgentKeys.includes(agent.key)) continue;
        for (const relPath of agent.globalPaths) {
          const agentSkillPath = path.join(resolveAgentGlobalPath(relPath), skillName);
          const agentStat = safeLstat(agentSkillPath);
          if (agentStat) {
            linkedAgents.push(agent.key);
            if (agentStat.isSymbolicLink()) {
              symlinkedAgents.push(agent.key);
            } else if (agentStat.isDirectory()) {
              nativeAgents.push(agent.key);
            }
            break;
          }
        }
      }

      if (skillsMap.has(skillName)) {
        const existing = skillsMap.get(skillName)!;
        const mergedLinked = Array.from(new Set([...existing.linkedAgents, ...linkedAgents]));
        const mergedSymlinked = Array.from(new Set([...(existing.symlinkedAgents || []), ...symlinkedAgents]));
        const mergedNative = Array.from(new Set([...(existing.nativeAgents || []), ...nativeAgents]));
        const mergedDesc = existing.description || description;
        skillsMap.set(skillName, {
          ...existing,
          description: mergedDesc,
          linkedAgents: mergedLinked,
          symlinkedAgents: mergedSymlinked,
          nativeAgents: mergedNative,
        });
      } else {
        skillsMap.set(skillName, {
          name: skillName,
          sourceDir: item.sourceDir,
          fullPath,
          description,
          linkedAgents,
          symlinkedAgents,
          nativeAgents,
        });
      }
    }
  }

  return Array.from(skillsMap.values());
}

export function toggleSkillSymlink(skillName: string, agentKey: string, enable: boolean): boolean {
  const home = os.homedir();
  const agent = getAllAgentDefs().find((a) => a.key === agentKey);
  if (!agent || agent.globalPaths.length === 0) return false;

  const skills = getAllSkills(false);
  const skill = skills.find((s) => s.name === skillName);

  const targetAgentDir = resolveAgentGlobalPath(agent.globalPaths[0]);
  const symlinkPath = path.join(targetAgentDir, skillName);

  try {
    if (enable) {
      if (!skill) return false;
      if (!fs.existsSync(targetAgentDir)) {
        fs.mkdirSync(targetAgentDir, { recursive: true });
      }
      if (symlinkPath === skill.fullPath) return true;
      safeRemove(symlinkPath);
      fs.symlinkSync(skill.fullPath, symlinkPath, "dir");
      return true;
    } else {
      return safeRemove(symlinkPath);
    }
  } catch (e) {
    console.error(`Error toggling symlink for ${skillName} -> ${agentKey}:`, e);
    return false;
  }
}

/**
 * Scans all supported agents' global skills directories and automatically removes any symlinks
 * whose target paths belong to a source directory that is no longer in configured sourceDirs,
 * or whose target no longer exists on disk (broken symlink).
 */
export function cleanupOrphanedSymlinks() {
  const home = os.homedir();
  const validSourceDirs = getSourceDirs();

  for (const agent of getAllAgentDefs()) {
    for (const relPath of agent.globalPaths) {
      const agentDir = resolveAgentGlobalPath(relPath);
      if (!fs.existsSync(agentDir)) continue;

      try {
        const entries = fs.readdirSync(agentDir);
        for (const entry of entries) {
          const entryPath = path.join(agentDir, entry);
          const stat = safeLstat(entryPath);
          if (!stat || !stat.isSymbolicLink()) continue;

          try {
            const rawTarget = fs.readlinkSync(entryPath);
            const absTarget = path.resolve(agentDir, rawTarget);

            // Check if link target is broken or points to a path NOT in validSourceDirs
            const isBroken = !fs.existsSync(absTarget);
            const isTargetInValidDir = validSourceDirs.some(
              (dir) => absTarget === dir || absTarget.startsWith(dir + path.sep)
            );

            if (isBroken || !isTargetInValidDir) {
              console.log(`Auto cleaning orphaned/removed symlink: ${entryPath} -> ${rawTarget}`);
              safeRemove(entryPath);
            }
          } catch (e) {
            console.error(`Error inspecting symlink ${entryPath}:`, e);
          }
        }
      } catch (e) {
        console.error(`Error scanning agent directory ${agentDir}:`, e);
      }
    }
  }
}
