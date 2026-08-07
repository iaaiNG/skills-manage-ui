import React, { useState } from "react";

interface AgentIconProps {
  agentKey: string;
  className?: string;
}

// Complete Icon file mapping for all 76 Agents
const ICON_MAP: Record<string, string> = {
  "antigravity": "/agent-icons/antigravity.png",
  "antigravity-cli": "/agent-icons/antigravity.png",
  "aider-desk": "/agent-icons/aider.svg",
  "amp": "/agent-icons/amp.svg",
  "replit": "/agent-icons/replit.png",
  "universal": "/agent-icons/amp.svg",
  "astrbot": "/agent-icons/astrbot.svg",
  "autohand-code": "/agent-icons/autohand.svg",
  "augment": "/agent-icons/augment.svg",
  "bob": "/agent-icons/bob.png",
  "claude-code": "/agent-icons/claude_code.svg",
  "openclaw": "/agent-icons/openclaw.svg",
  "cline": "/agent-icons/cline.png",
  "dexto": "/agent-icons/dexto.svg",
  "kimi-code-cli": "/agent-icons/kimi.svg",
  "loaf": "/agent-icons/cline.png",
  "warp": "/agent-icons/warp.svg",
  "zed": "/agent-icons/cline.png",
  "codearts-agent": "/agent-icons/codearts.svg",
  "codebuddy": "/agent-icons/codebuddy.svg",
  "codemaker": "/agent-icons/codemaker.svg",
  "codestudio": "/agent-icons/codestudio.svg",
  "codex": "/agent-icons/codex.svg",
  "command-code": "/agent-icons/command_code.svg",
  "continue": "/agent-icons/continue.png",
  "cortex": "/agent-icons/cortex.png",
  "crush": "/agent-icons/crush.png",
  "cursor": "/agent-icons/cursor.png",
  "deepagents": "/agent-icons/deepagents.png",
  "devin": "/agent-icons/devin.svg",
  "droid": "/agent-icons/droid.svg",
  "eve": "/agent-icons/eve.svg",
  "firebender": "/agent-icons/firebender.svg",
  "forgecode": "/agent-icons/forgecode.svg",
  "gemini": "/agent-icons/gemini_cli.svg",
  "gemini-cli": "/agent-icons/gemini_cli.svg",
  "copilot": "/agent-icons/github_copilot.png",
  "github-copilot": "/agent-icons/github_copilot.png",
  "goose": "/agent-icons/goose.png",
  "grok": "/agent-icons/grok.svg",
  "hermes-agent": "/agent-icons/hermes.png",
  "inference-sh": "/agent-icons/inferencesh.svg",
  "jazz": "/agent-icons/jazz.svg",
  "junie": "/agent-icons/junie.png",
  "iflow-cli": "/agent-icons/iflow.png",
  "kilo": "/agent-icons/kilo_code.svg",
  "kimchi": "/agent-icons/kimchi.svg",
  "kiro-cli": "/agent-icons/kiro.svg",
  "kode": "/agent-icons/kode.png",
  "lingma": "/agent-icons/lingma.svg",
  "mcpjam": "/agent-icons/mcpjam.png",
  "minimax-code": "/agent-icons/minimax.svg",
  "mistral-vibe": "/agent-icons/mistral_vibe.svg",
  "moxby": "/agent-icons/moxby.svg",
  "mux": "/agent-icons/mux.png",
  "neovate": "/agent-icons/neovate.png",
  "opencode": "/agent-icons/opencode.png",
  "openhands": "/agent-icons/openhands.png",
  "ona": "/agent-icons/ona.svg",
  "pi": "/agent-icons/pi.svg",
  "pochi": "/agent-icons/pochi.png",
  "qoder": "/agent-icons/qoder.svg",
  "qoder-cn": "/agent-icons/qoder.svg",
  "qwen-code": "/agent-icons/qwen_code.png",
  "reasonix": "/agent-icons/reasonix.svg",
  "rovodev": "/agent-icons/rovodev.svg",
  "roo": "/agent-icons/roo_code.svg",
  "tabnine-cli": "/agent-icons/tabnine.svg",
  "terramind": "/agent-icons/terramind.svg",
  "tinycloud": "/agent-icons/tinycloud.svg",
  "trae": "/agent-icons/trae.svg",
  "trae-cn": "/agent-icons/trae_cn.svg",
  "windsurf": "/agent-icons/windsurf.svg",
  "zcode": "/agent-icons/zcode.svg",
  "zencoder": "/agent-icons/zencoder.png",
  "zenflow": "/agent-icons/zencoder.png",
  "promptscript": "/agent-icons/promptscript.svg",
  "adal": "/agent-icons/adal.png",
};

export function AgentIcon({ agentKey, className = "w-7 h-7" }: AgentIconProps) {
  const [error, setError] = useState(false);
  const iconPath = ICON_MAP[agentKey];

  if (iconPath && !error) {
    return (
      <img
        src={iconPath}
        alt={agentKey}
        className={`${className} object-contain transition-transform duration-200 hover:scale-110`}
        onError={() => setError(true)}
      />
    );
  }

  // 通用兜底图标 (Sparkle / Robot Vector)
  return (
    <svg className={`${className} text-purple-600 shrink-0`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  );
}
