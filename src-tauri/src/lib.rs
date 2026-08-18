mod engine;

use engine::*;
use serde::Deserialize;

#[tauri::command]
fn get_skills(include_agent_native: Option<bool>) -> Result<Vec<SkillItem>, String> {
    Ok(get_all_skills(include_agent_native.unwrap_or(true)))
}

#[tauri::command]
fn get_agents() -> Result<serde_json::Value, String> {
    let enabled_keys = get_enabled_agent_keys();
    let all_skills = get_all_skills(true);
    let agent_defs = get_all_agent_defs();

    let results: Vec<AgentInfo> = agent_defs
        .into_iter()
        .map(|agent| {
            let mut installed = false;
            let mut detected_path = if !agent.global_paths.is_empty() {
                resolve_agent_global_path(&agent.global_paths[0])
            } else {
                format!("Project-only ({})", agent.project_path)
            };

            for rel_path in &agent.global_paths {
                let full_path = resolve_agent_global_path(rel_path);
                if std::path::Path::new(&full_path).exists() {
                    installed = true;
                    detected_path = full_path;
                    break;
                }
            }

            let enabled = enabled_keys.contains(&agent.key);
            let skill_count = all_skills
                .iter()
                .filter(|s| s.linked_agents.contains(&agent.key))
                .count();
            let resolved_global_paths: Vec<String> = agent
                .global_paths
                .iter()
                .map(|p| resolve_agent_global_path(p))
                .collect();

            AgentInfo {
                name: agent.name,
                key: agent.key,
                global_paths: agent.global_paths,
                project_path: agent.project_path,
                icon: agent.icon,
                description: agent.description,
                is_custom: agent.is_custom,
                installed,
                enabled,
                detected_path,
                skill_count,
                resolved_global_paths,
            }
        })
        .collect();

    Ok(serde_json::json!({
        "agents": results,
        "enabledCount": enabled_keys.len()
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToggleAgentPayload {
    agent_key: Option<String>,
    enabled: Option<bool>,
    action: Option<String>,
    custom_agent: Option<AgentDef>,
}

#[tauri::command]
fn update_agent(payload: ToggleAgentPayload) -> Result<serde_json::Value, String> {
    if let Some(action) = &payload.action {
        if action == "addCustom" {
            if let Some(custom) = payload.custom_agent {
                let mut current = get_custom_agents();
                let key = custom.key.clone();
                if let Some(idx) = current.iter().position(|a| a.key == key) {
                    current[idx] = custom;
                } else {
                    current.push(custom);
                }
                let mut cfg = get_config();
                cfg.custom_agents = Some(current);
                save_config(cfg);

                let mut enabled_keys = get_enabled_agent_keys();
                if !enabled_keys.contains(&key) {
                    enabled_keys.push(key);
                    let mut cfg = get_config();
                    cfg.enabled_agent_keys = Some(enabled_keys);
                    save_config(cfg);
                }
                return Ok(serde_json::json!({ "success": true }));
            }
        } else if action == "deleteCustom" {
            if let Some(key) = payload.agent_key {
                let current = get_custom_agents();
                let updated: Vec<_> = current.into_iter().filter(|a| a.key != key).collect();
                let mut cfg = get_config();
                cfg.custom_agents = Some(updated);
                save_config(cfg);

                let enabled = get_enabled_agent_keys();
                let next_enabled: Vec<_> = enabled.into_iter().filter(|k| k != &key).collect();
                let mut cfg = get_config();
                cfg.enabled_agent_keys = Some(next_enabled);
                save_config(cfg);
                return Ok(serde_json::json!({ "success": true }));
            }
        }
    }

    if let (Some(key), Some(enabled)) = (payload.agent_key, payload.enabled) {
        let keys = get_enabled_agent_keys();
        let mut next_keys = keys;
        if enabled {
            if !next_keys.contains(&key) {
                next_keys.push(key.clone());
            }
        } else {
            next_keys.retain(|k| k != &key);
        }
        let mut cfg = get_config();
        cfg.enabled_agent_keys = Some(next_keys.clone());
        save_config(cfg);
        return Ok(serde_json::json!({ "success": true, "enabledKeys": next_keys }));
    }

    Err("Invalid payload".into())
}

#[tauri::command]
fn get_config_cmd() -> Result<serde_json::Value, String> {
    let source_dirs = get_source_dirs();
    Ok(serde_json::json!({ "sourceDirs": source_dirs }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveConfigPayload {
    source_dirs: Option<Vec<String>>,
}

#[tauri::command]
fn save_config_cmd(payload: SaveConfigPayload) -> Result<serde_json::Value, String> {
    if let Some(dirs) = payload.source_dirs {
        let mut cfg = get_config();
        cfg.source_dirs = dirs;
        save_config(cfg);
    }
    let source_dirs = get_source_dirs();
    Ok(serde_json::json!({ "sourceDirs": source_dirs }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SymlinkPayload {
    skill_name: String,
    agent_key: String,
    enable: bool,
}

#[tauri::command]
fn toggle_symlink_cmd(payload: SymlinkPayload) -> Result<serde_json::Value, String> {
    let success = toggle_skill_symlink(&payload.skill_name, &payload.agent_key, payload.enable);
    Ok(serde_json::json!({ "success": success }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_skills,
            get_agents,
            update_agent,
            get_config_cmd,
            save_config_cmd,
            toggle_symlink_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
