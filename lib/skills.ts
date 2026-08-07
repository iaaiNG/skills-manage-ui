// Shared helpers: ANSI stripping + parsing `npx skills` CLI text output.

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;?]*[a-zA-Z]/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

export interface InstalledSkill {
  name: string;
  path: string;
  agents: string;
  source: string;
  scope: "global" | "project";
}

/**
 * Parse `skills ls [-g]` output. Format after stripping ANSI:
 *
 *   Global Skills
 *
 *   agent-reach   ~/.agents/skills/agent-reach
 *     Agents: Amp, Codex +2 more  Source: local
 */
export function parseListOutput(raw: string, scope: "global" | "project"): InstalledSkill[] {
  const text = stripAnsi(raw);
  const skills: InstalledSkill[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.includes("Skills") && !/^\S+\s{2,}/.test(line)) continue;
    const m = /^(\S+)\s{2,}(\S+)\s*$/.exec(line);
    if (!m) continue;
    const skill: InstalledSkill = { name: m[1], path: m[2], agents: "", source: "", scope };
    // look ahead for the Agents:/Source: detail line
    const next = lines[i + 1] ?? "";
    if (/Agents:/.test(next)) {
      const am = /Agents:\s*(.+?)(?:\s{2,}|$)/.exec(next);
      const sm = /Source:\s*(\S+)/.exec(next);
      if (am) skill.agents = am[1].trim();
      if (sm) skill.source = sm[1].trim();
      i++;
    }
    skills.push(skill);
  }
  return skills;
}

export interface RepoSkill {
  name: string;
  description: string;
}

/**
 * Parse `skills add <repo> -l` output. Format:
 *
 *   │    vercel-optimize
 *   │
 *   │      Use for Vercel cost and performance optimization...
 */
export function parseRepoSkillsOutput(raw: string): RepoSkill[] {
  const text = stripAnsi(raw);
  const skills: RepoSkill[] = [];
  let current: RepoSkill | null = null;
  for (const line of text.split("\n")) {
    const nameM = /^│\s{4}(\S+)\s*$/.exec(line);
    if (nameM) {
      current = { name: nameM[1], description: "" };
      skills.push(current);
      continue;
    }
    const descM = /^│\s{6}(.+)$/.exec(line);
    if (descM && current) {
      current.description = current.description
        ? current.description + " " + descM[1].trim()
        : descM[1].trim();
    }
  }
  return skills;
}

/** Commands the UI is allowed to execute. */
export const ALLOWED_COMMANDS = new Set([
  "add", "a",
  "remove", "rm",
  "update", "upgrade",
  "list", "ls",
  "find",
  "use",
  "init",
]);
