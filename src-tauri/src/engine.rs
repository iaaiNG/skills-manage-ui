use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentDef {
    pub name: String,
    pub key: String,
    pub global_paths: Vec<String>,
    pub project_path: String,
    pub icon: String,
    pub description: String,
    pub is_custom: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub name: String,
    pub key: String,
    pub global_paths: Vec<String>,
    pub project_path: String,
    pub icon: String,
    pub description: String,
    pub is_custom: Option<bool>,
    pub installed: bool,
    pub enabled: bool,
    pub detected_path: String,
    pub skill_count: usize,
    pub resolved_global_paths: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillItem {
    pub name: String,
    pub source_dir: String,
    pub full_path: String,
    pub description: String,
    pub linked_agents: Vec<String>,
    pub symlinked_agents: Vec<String>,
    pub native_agents: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub source_dirs: Vec<String>,
    pub enabled_agent_keys: Option<Vec<String>>,
    pub custom_agents: Option<Vec<AgentDef>>,
}

fn get_home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
}

fn get_default_library() -> PathBuf {
    get_home_dir().join(".skills-library")
}

fn get_config_path() -> PathBuf {
    get_default_library().join("config.json")
}

pub fn resolve_agent_global_path(raw_path: &str) -> String {
    let home = get_home_dir();
    let p = raw_path.trim();
    if p.is_empty() {
        return home.to_string_lossy().to_string();
    }
    let pb = PathBuf::from(p);
    if pb.is_absolute() {
        return p.to_string();
    }
    if p.starts_with("~/") || p == "~" {
        let sub = if p.starts_with("~/") { &p[2..] } else { "" };
        return home.join(sub).to_string_lossy().to_string();
    }
    if p.starts_with("Users/") || p.starts_with("home/") {
        return format!("/{}", p);
    }
    home.join(p).to_string_lossy().to_string()
}

pub fn get_supported_agents() -> Vec<AgentDef> {
    vec![
        AgentDef { name: "Antigravity CLI".into(), key: "antigravity-cli".into(), project_path: ".agents/skills/".into(), global_paths: vec![".gemini/antigravity-cli/skills".into()], icon: "antigravity-cli".into(), description: "Google Antigravity Agent CLI framework".into(), is_custom: None },
        AgentDef { name: "Antigravity".into(), key: "antigravity".into(), project_path: ".agents/skills/".into(), global_paths: vec![".gemini/antigravity/skills".into()], icon: "antigravity".into(), description: "Google Antigravity Desktop & Agent platform".into(), is_custom: None },
        AgentDef { name: "AiderDesk".into(), key: "aider-desk".into(), project_path: ".aider-desk/skills/".into(), global_paths: vec![".aider-desk/skills".into()], icon: "aider".into(), description: "AiderDesk Skill-driven AI Agent".into(), is_custom: None },
        AgentDef { name: "Amp".into(), key: "amp".into(), project_path: ".agents/skills/".into(), global_paths: vec![".config/agents/skills".into()], icon: "amp".into(), description: "Amp AI coding assistant".into(), is_custom: None },
        AgentDef { name: "Replit".into(), key: "replit".into(), project_path: ".agents/skills/".into(), global_paths: vec![".config/agents/skills".into()], icon: "replit".into(), description: "Replit Agent workspace".into(), is_custom: None },
        AgentDef { name: "Universal".into(), key: "universal".into(), project_path: ".agents/skills/".into(), global_paths: vec![".config/agents/skills".into()], icon: "amp".into(), description: "Universal Agent shared engine".into(), is_custom: None },
        AgentDef { name: "AstrBot".into(), key: "astrbot".into(), project_path: "data/skills/".into(), global_paths: vec![".astrbot/data/skills".into()], icon: "astrbot".into(), description: "AstrBot AI bot skill engine".into(), is_custom: None },
        AgentDef { name: "Autohand Code CLI".into(), key: "autohand-code".into(), project_path: ".autohand/skills/".into(), global_paths: vec![".autohand/skills".into()], icon: "autohand-code".into(), description: "Autohand Automated Code CLI".into(), is_custom: None },
        AgentDef { name: "Augment".into(), key: "augment".into(), project_path: ".augment/skills/".into(), global_paths: vec![".augment/skills".into()], icon: "augment".into(), description: "Augment Code assistant agent".into(), is_custom: None },
        AgentDef { name: "IBM Bob".into(), key: "bob".into(), project_path: ".bob/skills/".into(), global_paths: vec![".bob/skills".into()], icon: "bob".into(), description: "IBM Bob AI code assistant".into(), is_custom: None },
        AgentDef { name: "Claude Code".into(), key: "claude-code".into(), project_path: ".claude/skills/".into(), global_paths: vec![".claude/skills".into()], icon: "claude-code".into(), description: "Anthropic Claude Code CLI Agent".into(), is_custom: None },
        AgentDef { name: "OpenClaw".into(), key: "openclaw".into(), project_path: "skills/".into(), global_paths: vec![".openclaw/skills".into()], icon: "openclaw".into(), description: "OpenClaw open-source Agent framework".into(), is_custom: None },
        AgentDef { name: "Cline".into(), key: "cline".into(), project_path: ".agents/skills/".into(), global_paths: vec![".cline/skills".into(), ".agents/skills".into()], icon: "cline".into(), description: "Cline VSCode AI Agent".into(), is_custom: None },
        AgentDef { name: "Dexto".into(), key: "dexto".into(), project_path: ".agents/skills/".into(), global_paths: vec![".agents/skills".into()], icon: "cline".into(), description: "Dexto Agent framework".into(), is_custom: None },
        AgentDef { name: "Kimi Code CLI".into(), key: "kimi-code-cli".into(), project_path: ".agents/skills/".into(), global_paths: vec![".agents/skills".into()], icon: "kimi".into(), description: "Moonshot Kimi Code CLI Agent".into(), is_custom: None },
        AgentDef { name: "Loaf".into(), key: "loaf".into(), project_path: ".agents/skills/".into(), global_paths: vec![".agents/skills".into()], icon: "cline".into(), description: "Loaf AI coding assistant".into(), is_custom: None },
        AgentDef { name: "Warp".into(), key: "warp".into(), project_path: ".agents/skills/".into(), global_paths: vec![".agents/skills".into()], icon: "warp".into(), description: "Warp terminal Agent engine".into(), is_custom: None },
        AgentDef { name: "Zed".into(), key: "zed".into(), project_path: ".agents/skills/".into(), global_paths: vec![".agents/skills".into()], icon: "cline".into(), description: "Zed editor AI agent".into(), is_custom: None },
        AgentDef { name: "CodeArts Agent".into(), key: "codearts-agent".into(), project_path: ".codeartsdoer/skills/".into(), global_paths: vec![".codeartsdoer/skills".into()], icon: "codearts-agent".into(), description: "Huawei CodeArts Doer AI Agent".into(), is_custom: None },
        AgentDef { name: "CodeBuddy".into(), key: "codebuddy".into(), project_path: ".codebuddy/skills/".into(), global_paths: vec![".codebuddy/skills".into()], icon: "codebuddy".into(), description: "CodeBuddy AI pair programming assistant".into(), is_custom: None },
        AgentDef { name: "Codemaker".into(), key: "codemaker".into(), project_path: ".codemaker/skills/".into(), global_paths: vec![".codemaker/skills".into()], icon: "codemaker".into(), description: "Codemaker AI Agent".into(), is_custom: None },
        AgentDef { name: "Code Studio".into(), key: "codestudio".into(), project_path: ".codestudio/skills/".into(), global_paths: vec![".codestudio/skills".into()], icon: "codestudio".into(), description: "Code Studio AI workstation".into(), is_custom: None },
        AgentDef { name: "Codex".into(), key: "codex".into(), project_path: ".agents/skills/".into(), global_paths: vec![".codex/skills".into()], icon: "codex".into(), description: "OpenAI Codex code generation engine".into(), is_custom: None },
        AgentDef { name: "Command Code".into(), key: "command-code".into(), project_path: ".commandcode/skills/".into(), global_paths: vec![".commandcode/skills".into()], icon: "commandcode".into(), description: "Command Code terminal tool".into(), is_custom: None },
        AgentDef { name: "Continue".into(), key: "continue".into(), project_path: ".continue/skills/".into(), global_paths: vec![".continue/skills".into()], icon: "continue".into(), description: "Continue open-source AI coding extension".into(), is_custom: None },
        AgentDef { name: "Cortex Code".into(), key: "cortex".into(), project_path: ".cortex/skills/".into(), global_paths: vec![".snowflake/cortex/skills".into()], icon: "cortex".into(), description: "Snowflake Cortex Code AI agent".into(), is_custom: None },
        AgentDef { name: "Crush".into(), key: "crush".into(), project_path: ".crush/skills/".into(), global_paths: vec![".config/crush/skills".into()], icon: "crush".into(), description: "Crush AI toolset".into(), is_custom: None },
        AgentDef { name: "Cursor".into(), key: "cursor".into(), project_path: ".agents/skills/".into(), global_paths: vec![".cursor/skills".into()], icon: "cursor".into(), description: "Cursor AI IDE Agent engine".into(), is_custom: None },
        AgentDef { name: "Deep Agents".into(), key: "deepagents".into(), project_path: ".agents/skills/".into(), global_paths: vec![".deepagents/agent/skills".into()], icon: "deepagents".into(), description: "Deep Agents intelligent agent".into(), is_custom: None },
        AgentDef { name: "Devin for Terminal".into(), key: "devin".into(), project_path: ".devin/skills/".into(), global_paths: vec![".config/devin/skills".into()], icon: "devin".into(), description: "Devin for Terminal software engineering agent".into(), is_custom: None },
        AgentDef { name: "Droid".into(), key: "droid".into(), project_path: ".factory/skills/".into(), global_paths: vec![".factory/skills".into()], icon: "droid".into(), description: "Factory Droid agent".into(), is_custom: None },
        AgentDef { name: "Eve".into(), key: "eve".into(), project_path: "agent/skills/".into(), global_paths: vec![], icon: "eve".into(), description: "Eve Project-only dedicated Agent".into(), is_custom: None },
        AgentDef { name: "Firebender".into(), key: "firebender".into(), project_path: ".agents/skills/".into(), global_paths: vec![".firebender/skills".into()], icon: "firebender".into(), description: "Firebender programming agent".into(), is_custom: None },
        AgentDef { name: "ForgeCode".into(), key: "forgecode".into(), project_path: ".forge/skills/".into(), global_paths: vec![".forge/skills".into()], icon: "forgecode".into(), description: "ForgeCode industrial agent".into(), is_custom: None },
        AgentDef { name: "Gemini CLI".into(), key: "gemini-cli".into(), project_path: ".agents/skills/".into(), global_paths: vec![".gemini/skills".into()], icon: "gemini".into(), description: "Google Gemini CLI official agent".into(), is_custom: None },
        AgentDef { name: "GitHub Copilot".into(), key: "github-copilot".into(), project_path: ".agents/skills/".into(), global_paths: vec![".copilot/skills".into()], icon: "copilot".into(), description: "GitHub Copilot Workspace & Agent".into(), is_custom: None },
        AgentDef { name: "Goose".into(), key: "goose".into(), project_path: ".goose/skills/".into(), global_paths: vec![".config/goose/skills".into()], icon: "goose".into(), description: "Block Goose open-source agent".into(), is_custom: None },
        AgentDef { name: "Grok Build".into(), key: "grok".into(), project_path: ".grok/skills/".into(), global_paths: vec![".grok/skills".into()], icon: "grok".into(), description: "xAI Grok Build code assistant".into(), is_custom: None },
        AgentDef { name: "Hermes Agent".into(), key: "hermes-agent".into(), project_path: ".hermes/skills/".into(), global_paths: vec![".hermes/skills".into()], icon: "hermes".into(), description: "Hermes Autonomous Agent".into(), is_custom: None },
        AgentDef { name: "inference.sh".into(), key: "inference-sh".into(), project_path: ".inferencesh/skills/".into(), global_paths: vec![".inferencesh/skills".into()], icon: "inference-sh".into(), description: "inference.sh cloud agent".into(), is_custom: None },
        AgentDef { name: "Jazz".into(), key: "jazz".into(), project_path: ".jazz/skills/".into(), global_paths: vec![".jazz/skills".into()], icon: "jazz".into(), description: "Jazz programming agent".into(), is_custom: None },
        AgentDef { name: "Junie".into(), key: "junie".into(), project_path: ".junie/skills/".into(), global_paths: vec![".junie/skills".into()], icon: "junie".into(), description: "Junie programming agent".into(), is_custom: None },
        AgentDef { name: "iFlow CLI".into(), key: "iflow-cli".into(), project_path: ".iflow/skills/".into(), global_paths: vec![".iflow/skills".into()], icon: "iflow".into(), description: "iFlow workflow AI agent".into(), is_custom: None },
        AgentDef { name: "Kilo Code".into(), key: "kilo".into(), project_path: ".kilocode/skills/".into(), global_paths: vec![".kilocode/skills".into()], icon: "kilo".into(), description: "Kilo Code development agent".into(), is_custom: None },
        AgentDef { name: "Kimchi".into(), key: "kimchi".into(), project_path: ".kimchi/skills/".into(), global_paths: vec![".config/kimchi/harness/skills".into()], icon: "kimchi".into(), description: "Kimchi testing & harness agent".into(), is_custom: None },
        AgentDef { name: "Kiro CLI".into(), key: "kiro-cli".into(), project_path: ".kiro/skills/".into(), global_paths: vec![".kiro/skills".into()], icon: "kiro".into(), description: "AWS Kiro CLI agent".into(), is_custom: None },
        AgentDef { name: "Kode".into(), key: "kode".into(), project_path: ".kode/skills/".into(), global_paths: vec![".kode/skills".into()], icon: "kode".into(), description: "Kode code agent".into(), is_custom: None },
        AgentDef { name: "Lingma".into(), key: "lingma".into(), project_path: ".lingma/skills/".into(), global_paths: vec![".lingma/skills".into()], icon: "lingma".into(), description: "Alibaba Tongyi Lingma agent".into(), is_custom: None },
        AgentDef { name: "MCPJam".into(), key: "mcpjam".into(), project_path: ".mcpjam/skills/".into(), global_paths: vec![".mcpjam/skills".into()], icon: "mcpjam".into(), description: "MCPJam Model Context Protocol agent".into(), is_custom: None },
        AgentDef { name: "MiniMax Code".into(), key: "minimax-code".into(), project_path: ".minimax/skills/".into(), global_paths: vec![".minimax/skills".into()], icon: "minimax".into(), description: "MiniMax Code LLM agent".into(), is_custom: None },
        AgentDef { name: "Mistral Vibe".into(), key: "mistral-vibe".into(), project_path: ".vibe/skills/".into(), global_paths: vec![".vibe/skills".into()], icon: "mistral-vibe".into(), description: "Mistral Vibe coding agent".into(), is_custom: None },
        AgentDef { name: "Moxby".into(), key: "moxby".into(), project_path: ".moxby/skills/".into(), global_paths: vec![".moxby/skills".into()], icon: "moxby".into(), description: "Moxby AI assistant".into(), is_custom: None },
        AgentDef { name: "Mux".into(), key: "mux".into(), project_path: ".mux/skills/".into(), global_paths: vec![".mux/skills".into()], icon: "mux".into(), description: "Mux multi-channel AI assistant".into(), is_custom: None },
        AgentDef { name: "OpenCode".into(), key: "opencode".into(), project_path: ".agents/skills/".into(), global_paths: vec![".config/opencode/skills".into()], icon: "opencode".into(), description: "OpenCode open-source agent framework".into(), is_custom: None },
        AgentDef { name: "OpenHands".into(), key: "openhands".into(), project_path: ".openhands/skills/".into(), global_paths: vec![".openhands/skills".into()], icon: "openhands".into(), description: "OpenHands (All-Hands AI) software agent".into(), is_custom: None },
        AgentDef { name: "Ona".into(), key: "ona".into(), project_path: ".ona/skills/".into(), global_paths: vec![".ona/skills".into()], icon: "ona".into(), description: "Ona intelligent agent".into(), is_custom: None },
        AgentDef { name: "Pi".into(), key: "pi".into(), project_path: ".pi/skills/".into(), global_paths: vec![".pi/agent/skills".into()], icon: "pi".into(), description: "Inflection Pi / Pi agent".into(), is_custom: None },
        AgentDef { name: "Qoder".into(), key: "qoder".into(), project_path: ".qoder/skills/".into(), global_paths: vec![".qoder/skills".into()], icon: "qoder".into(), description: "Qoder AI agent".into(), is_custom: None },
        AgentDef { name: "Qoder CN".into(), key: "qoder-cn".into(), project_path: ".qoder/skills/".into(), global_paths: vec![".qoder-cn/skills".into()], icon: "qoder-cn".into(), description: "Qoder China agent".into(), is_custom: None },
        AgentDef { name: "Qwen Code".into(), key: "qwen-code".into(), project_path: ".qwen/skills/".into(), global_paths: vec![".qwen/skills".into()], icon: "qwen-code".into(), description: "Tongyi Qwen Code agent".into(), is_custom: None },
        AgentDef { name: "Reasonix".into(), key: "reasonix".into(), project_path: ".reasonix/skills/".into(), global_paths: vec![".reasonix/skills".into()], icon: "reasonix".into(), description: "Reasonix reasoning agent".into(), is_custom: None },
        AgentDef { name: "Rovo Dev".into(), key: "rovodev".into(), project_path: ".rovodev/skills/".into(), global_paths: vec![".rovodev/skills".into()], icon: "rovodev".into(), description: "Atlassian Rovo Dev agent".into(), is_custom: None },
        AgentDef { name: "Roo Code".into(), key: "roo".into(), project_path: ".roo/skills/".into(), global_paths: vec![".roo/skills".into()], icon: "roo".into(), description: "Roo Code (Roo Cline) AI extension".into(), is_custom: None },
        AgentDef { name: "Tabnine CLI".into(), key: "tabnine-cli".into(), project_path: ".tabnine/agent/skills/".into(), global_paths: vec![".tabnine/agent/skills".into()], icon: "tabnine".into(), description: "Tabnine CLI agent engine".into(), is_custom: None },
        AgentDef { name: "Terramind".into(), key: "terramind".into(), project_path: ".terramind/skills/".into(), global_paths: vec![".terramind/skills".into()], icon: "terramind".into(), description: "Terramind intelligent agent".into(), is_custom: None },
        AgentDef { name: "Tinycloud".into(), key: "tinycloud".into(), project_path: ".tinycloud/skills/".into(), global_paths: vec![".tinycloud/skills".into()], icon: "tinycloud".into(), description: "Tinycloud microservice agent".into(), is_custom: None },
        AgentDef { name: "Trae".into(), key: "trae".into(), project_path: ".trae/skills/".into(), global_paths: vec![".trae/skills".into()], icon: "trae".into(), description: "ByteDance Trae IDE AI agent".into(), is_custom: None },
        AgentDef { name: "Trae CN".into(), key: "trae-cn".into(), project_path: ".trae/skills/".into(), global_paths: vec![".trae-cn/skills".into()], icon: "trae-cn".into(), description: "Trae China AI agent".into(), is_custom: None },
        AgentDef { name: "Windsurf".into(), key: "windsurf".into(), project_path: ".windsurf/skills/".into(), global_paths: vec![".codeium/windsurf/skills".into(), ".windsurf/skills".into()], icon: "windsurf".into(), description: "Codeium Windsurf IDE AI agent".into(), is_custom: None },
        AgentDef { name: "ZCode".into(), key: "zcode".into(), project_path: ".zcode/skills/".into(), global_paths: vec![".zcode/skills".into()], icon: "zcode".into(), description: "ZCode code agent".into(), is_custom: None },
        AgentDef { name: "Zencoder".into(), key: "zencoder".into(), project_path: ".zencoder/skills/".into(), global_paths: vec![".zencoder/skills".into()], icon: "zencoder".into(), description: "Zencoder AI coding agent".into(), is_custom: None },
        AgentDef { name: "Zenflow".into(), key: "zenflow".into(), project_path: ".zencoder/skills/".into(), global_paths: vec![".zencoder/skills".into()], icon: "zencoder".into(), description: "Zenflow workflow agent".into(), is_custom: None },
        AgentDef { name: "Neovate".into(), key: "neovate".into(), project_path: ".neovate/skills/".into(), global_paths: vec![".neovate/skills".into()], icon: "neovate".into(), description: "Neovate AI development engine".into(), is_custom: None },
        AgentDef { name: "Pochi".into(), key: "pochi".into(), project_path: ".pochi/skills/".into(), global_paths: vec![".pochi/skills".into()], icon: "pochi".into(), description: "Pochi intelligent agent".into(), is_custom: None },
        AgentDef { name: "PromptScript".into(), key: "promptscript".into(), project_path: ".agents/skills/".into(), global_paths: vec![], icon: "promptscript".into(), description: "PromptScript Project-only dedicated agent".into(), is_custom: None },
        AgentDef { name: "AdaL".into(), key: "adal".into(), project_path: ".adal/skills/".into(), global_paths: vec![".adal/skills".into()], icon: "adal".into(), description: "AdaL intelligent agent".into(), is_custom: None },
    ]
}

pub fn get_config() -> AppConfig {
    let p = get_config_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(&content) {
                return cfg;
            }
        }
    }
    AppConfig {
        source_dirs: vec![get_default_library().to_string_lossy().to_string()],
        enabled_agent_keys: None,
        custom_agents: None,
    }
}

pub fn save_config(mut cfg: AppConfig) {
    let p = get_config_path();
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if cfg.source_dirs.is_empty() {
        cfg.source_dirs.push(get_default_library().to_string_lossy().to_string());
    }
    if let Ok(json) = serde_json::to_string_pretty(&cfg) {
        let _ = fs::write(p, json);
    }
    cleanup_orphaned_symlinks();
}

pub fn get_custom_agents() -> Vec<AgentDef> {
    let cfg = get_config();
    cfg.custom_agents.unwrap_or_default().into_iter().map(|mut a| {
        a.is_custom = Some(true);
        a
    }).collect()
}

pub fn get_all_agent_defs() -> Vec<AgentDef> {
    let mut all = get_supported_agents();
    all.extend(get_custom_agents());
    all
}

pub fn get_source_dirs() -> Vec<String> {
    let cfg = get_config();
    let default_lib_str = get_default_library().to_string_lossy().to_string();
    let raw_list = if cfg.source_dirs.is_empty() {
        vec![default_lib_str.clone()]
    } else {
        cfg.source_dirs
    };
    if !get_default_library().exists() {
        let _ = fs::create_dir_all(get_default_library());
    }

    let is_default = |p: &str| p.ends_with(".skills-library") || p.contains("/.skills-library");
    let mut defaults: Vec<String> = raw_list.iter().filter(|p| is_default(p)).cloned().collect();
    let others: Vec<String> = raw_list.iter().filter(|p| !is_default(p)).cloned().collect();

    if defaults.is_empty() {
        defaults.push(default_lib_str);
    }

    let mut result = Vec::new();
    for d in defaults.into_iter().chain(others.into_iter()) {
        if !result.contains(&d) {
            result.push(d);
        }
    }
    result
}

pub fn get_enabled_agent_keys() -> Vec<String> {
    let cfg = get_config();
    if let Some(keys) = cfg.enabled_agent_keys {
        return keys;
    }
    let mut default_enabled = Vec::new();
    for agent in get_all_agent_defs() {
        for rel in &agent.global_paths {
            let full = resolve_agent_global_path(rel);
            if Path::new(&full).exists() {
                default_enabled.push(agent.key.clone());
                break;
            }
        }
    }
    if default_enabled.is_empty() {
        default_enabled.push("antigravity-cli".into());
        default_enabled.push("claude-code".into());
    }
    default_enabled
}

pub fn parse_skill_description(content: &str) -> String {
    for line in content.lines() {
        if line.to_lowercase().starts_with("description:") {
            let val = line[12..].trim().trim_matches('"').trim_matches('\'');
            if !val.is_empty() && !val.starts_with('>') && !val.starts_with('|') {
                return val.to_string();
            }
        }
    }
    for line in content.lines() {
        if line.starts_with("# ") {
            return line[2..].trim().to_string();
        }
    }
    "".to_string()
}

fn safe_remove(target_path: &Path) -> bool {
    if !target_path.exists() && fs::symlink_metadata(target_path).is_err() {
        return true;
    }
    if let Ok(meta) = fs::symlink_metadata(target_path) {
        if meta.file_type().is_symlink() {
            return fs::remove_file(target_path).is_ok();
        }
        if meta.is_dir() {
            return fs::remove_dir_all(target_path).is_ok();
        }
        return fs::remove_file(target_path).is_ok();
    }
    false
}

fn find_skills_recursively(dir: &Path, source_dir: &str, depth: usize, out: &mut Vec<(String, PathBuf, String)>) {
    if depth > 10 || !dir.exists() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" || name == "dist" || name == "build" || name == "vendor" {
                continue;
            }
            let path = entry.path();
            if path.is_dir() {
                let has_md = path.join("SKILL.md").exists() || path.join("skill.md").exists();
                if has_md {
                    out.push((name, path, source_dir.to_string()));
                } else {
                    find_skills_recursively(&path, source_dir, depth + 1, out);
                }
            }
        }
    }
}

pub fn get_all_skills(include_agent_native_dirs: bool) -> Vec<SkillItem> {
    cleanup_orphaned_symlinks();
    let configured_dirs = get_source_dirs();
    let enabled_keys = get_enabled_agent_keys();
    let mut all_dirs: Vec<String> = configured_dirs;

    if include_agent_native_dirs {
        for agent in get_all_agent_defs() {
            for rel in &agent.global_paths {
                let full = resolve_agent_global_path(rel);
                if Path::new(&full).exists() && !all_dirs.contains(&full) {
                    all_dirs.push(full);
                }
            }
        }
    }

    let mut found = Vec::new();
    for src_dir in &all_dirs {
        let p = Path::new(src_dir);
        find_skills_recursively(p, src_dir, 0, &mut found);
    }

    let mut map: std::collections::HashMap<String, SkillItem> = std::collections::HashMap::new();

    for (name, full_path, source_dir) in found {
        let md_path = full_path.join("SKILL.md");
        let lower_md_path = full_path.join("skill.md");
        let description = if md_path.exists() {
            fs::read_to_string(&md_path).map(|c| parse_skill_description(&c)).unwrap_or_default()
        } else if lower_md_path.exists() {
            fs::read_to_string(&lower_md_path).map(|c| parse_skill_description(&c)).unwrap_or_default()
        } else {
            "".to_string()
        };

        let mut symlinked_agents = Vec::new();
        let mut native_agents = Vec::new();
        let mut linked_agents = Vec::new();

        for agent in get_all_agent_defs() {
            if !enabled_keys.contains(&agent.key) {
                continue;
            }
            for rel in &agent.global_paths {
                let agent_skill_path = Path::new(&resolve_agent_global_path(rel)).join(&name);
                if let Ok(meta) = fs::symlink_metadata(&agent_skill_path) {
                    linked_agents.push(agent.key.clone());
                    if meta.file_type().is_symlink() {
                        symlinked_agents.push(agent.key.clone());
                    } else if meta.is_dir() {
                        native_agents.push(agent.key.clone());
                    }
                    break;
                }
            }
        }

        let full_path_str = full_path.to_string_lossy().to_string();

        if let Some(existing) = map.get_mut(&name) {
            for k in linked_agents {
                if !existing.linked_agents.contains(&k) { existing.linked_agents.push(k); }
            }
            for k in symlinked_agents {
                if !existing.symlinked_agents.contains(&k) { existing.symlinked_agents.push(k); }
            }
            for k in native_agents {
                if !existing.native_agents.contains(&k) { existing.native_agents.push(k); }
            }
            if existing.description.is_empty() {
                existing.description = description;
            }
        } else {
            map.insert(name.clone(), SkillItem {
                name,
                source_dir,
                full_path: full_path_str,
                description,
                linked_agents,
                symlinked_agents,
                native_agents,
            });
        }
    }

    map.into_values().collect()
}

pub fn toggle_skill_symlink(skill_name: &str, agent_key: &str, enable: bool) -> bool {
    let agents = get_all_agent_defs();
    let agent = match agents.iter().find(|a| a.key == agent_key) {
        Some(a) if !a.global_paths.is_empty() => a,
        _ => return false,
    };

    let target_agent_dir = resolve_agent_global_path(&agent.global_paths[0]);
    let target_dir_path = Path::new(&target_agent_dir);
    let symlink_path = target_dir_path.join(skill_name);

    if enable {
        let skills = get_all_skills(false);
        let skill = match skills.iter().find(|s| s.name == skill_name) {
            Some(s) => s,
            None => return false,
        };

        if !target_dir_path.exists() {
            let _ = fs::create_dir_all(target_dir_path);
        }
        if symlink_path.to_string_lossy() == skill.full_path {
            return true;
        }
        safe_remove(&symlink_path);
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            return symlink(&skill.full_path, &symlink_path).is_ok();
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::symlink_dir;
            return symlink_dir(&skill.full_path, &symlink_path).is_ok();
        }
    } else {
        safe_remove(&symlink_path)
    }
}

pub fn cleanup_orphaned_symlinks() {
    let valid_source_dirs = get_source_dirs();
    for agent in get_all_agent_defs() {
        for rel in &agent.global_paths {
            let agent_dir = resolve_agent_global_path(rel);
            let agent_path = Path::new(&agent_dir);
            if !agent_path.exists() { continue; }
            if let Ok(entries) = fs::read_dir(agent_path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if let Ok(meta) = fs::symlink_metadata(&entry_path) {
                        if meta.file_type().is_symlink() {
                            if let Ok(target) = fs::read_link(&entry_path) {
                                let abs_target = if target.is_relative() {
                                    agent_path.join(&target)
                                } else {
                                    target
                                };
                                let abs_target_str = abs_target.to_string_lossy().to_string();
                                let is_broken = !abs_target.exists();
                                let is_valid = valid_source_dirs.iter().any(|dir| {
                                    abs_target_str == *dir || abs_target_str.starts_with(&(dir.to_string() + "/"))
                                });
                                if is_broken || !is_valid {
                                    safe_remove(&entry_path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
