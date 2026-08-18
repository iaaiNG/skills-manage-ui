import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

export async function apiGetSkills(includeAgentNative: boolean = true) {
  try {
    const skills = await invoke<any[]>("get_skills", { includeAgentNative });
    return { skills };
  } catch (e) {
    console.error("apiGetSkills error:", e);
    return { skills: [] };
  }
}

export async function apiGetAgents() {
  try {
    const res = await invoke<any>("get_agents");
    return res;
  } catch (e) {
    console.error("apiGetAgents error:", e);
    return { agents: [], enabledCount: 0 };
  }
}

export async function apiUpdateAgent(payload: {
  agentKey?: string;
  enabled?: boolean;
  action?: string;
  customAgent?: any;
}) {
  try {
    const res = await invoke<any>("update_agent", { payload });
    return res;
  } catch (e) {
    console.error("apiUpdateAgent error:", e);
    return { error: String(e) };
  }
}

export async function apiGetConfig() {
  try {
    const res = await invoke<any>("get_config_cmd");
    return res;
  } catch (e) {
    console.error("apiGetConfig error:", e);
    return { sourceDirs: [] };
  }
}

export async function apiSaveConfig(sourceDirs: string[]) {
  try {
    const res = await invoke<any>("save_config_cmd", { payload: { sourceDirs } });
    return res;
  } catch (e) {
    console.error("apiSaveConfig error:", e);
    return { error: String(e) };
  }
}

export async function apiToggleSymlink(skillName: string, agentKey: string, enable: boolean) {
  try {
    const res = await invoke<any>("toggle_symlink_cmd", {
      payload: { skillName, agentKey, enable },
    });
    return res;
  } catch (e) {
    console.error("apiToggleSymlink error:", e);
    return { success: false };
  }
}


export async function apiSelectFolder() {
  try {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "选择技能库仓储文件夹",
    });
    if (selected && typeof selected === "string") {
      return { success: true, folderPath: selected };
    }
    return { success: false };
  } catch (e) {
    console.error("apiSelectFolder error:", e);
    return { success: false };
  }
}
