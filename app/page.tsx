"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentIcon } from "@/lib/agent-icons";

interface SkillItem {
  name: string;
  sourceDir: string;
  fullPath: string;
  description: string;
  linkedAgents: string[];
  symlinkedAgents?: string[];
  nativeAgents?: string[];
}

interface AgentInfo {
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

type Page = "installed" | "agents" | "config";

const MENU: { id: Page; label: string; code: string }[] = [
  { id: "installed", label: "技能库仓储与软链接", code: "01 // SKILLS" },
  { id: "agents", label: "支持的 Agent 引擎", code: "02 // AGENTS" },
  { id: "config", label: "源仓储目录配置", code: "03 // SOURCES" },
];

export default function Home() {
  const [page, setPage] = useState<Page>("installed");
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Skill Layout View state: 'grouped' (默认按源仓储路径分组) vs 'grid' (平铺)
  const [skillLayout, setSkillLayout] = useState<"grid" | "grouped">("grouped");

  // Skill Density state: 'normal' (舒适) vs 'compact' (紧凑)
  const [skillDensity, setSkillDensity] = useState<"normal" | "compact">("normal");

  // Collapsed state for groups in Grouped View (默认全收起)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Agent detection state
  const [agentsList, setAgentsList] = useState<AgentInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentFilter, setAgentFilter] = useState<"enabled" | "installed" | "all">("enabled");

  // Config state
  const [sourceDirs, setSourceDirs] = useState<string[]>([]);
  const [newDirInput, setNewDirInput] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);

  // Modal / Drawer state for Symlink Toggle
  const [activeSkillModalName, setActiveSkillModalName] = useState<string | null>(null);
  const [activeAgentDrawer, setActiveAgentDrawer] = useState<AgentInfo | null>(null);
  const [drawerTab, setDrawerTab] = useState<"linked" | "all">("linked");
  const [togglingSymlink, setTogglingSymlink] = useState<string | null>(null);
  const [togglingAgent, setTogglingAgent] = useState<string | null>(null);

  // Drawer Accordion Collapsed State
  const [drawerCollapsedGroups, setDrawerCollapsedGroups] = useState<Record<string, boolean>>({});

  // Secondary Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Batch Symlink Loading State
  const [batchLoading, setBatchLoading] = useState<string | null>(null);

  // Batch Mount/Unmount Agent Selection Modal State
  const [batchMountModal, setBatchMountModal] = useState<{
    isOpen: boolean;
    sourcePath: string;
    groupSkills: SkillItem[];
    selectedAgentKeys: string[];
    mode: "mount" | "unmount";
  }>({
    isOpen: false,
    sourcePath: "",
    groupSkills: [],
    selectedAgentKeys: [],
    mode: "mount",
  });

  // Dynamically derive activeSkillModal from skills array so state is always 100% fresh
  const activeSkillModal = skills.find((s) => s.name === activeSkillModalName) || null;

  const openBatchMountModal = (
    sourcePath: string,
    groupSkills: SkillItem[],
    mode: "mount" | "unmount" = "mount"
  ) => {
    setBatchMountModal({
      isOpen: true,
      sourcePath,
      groupSkills,
      selectedAgentKeys: enabledAgents.map((a) => a.key),
      mode,
    });
  };

  const executeBatchSymlinkForSelectedAgents = async () => {
    const { sourcePath, groupSkills, selectedAgentKeys, mode } = batchMountModal;
    if (selectedAgentKeys.length === 0) return;

    setBatchLoading(sourcePath);
    setBatchMountModal((prev) => ({ ...prev, isOpen: false }));

    try {
      const enable = mode === "mount";
      const tasks: Promise<any>[] = [];
      for (const s of groupSkills) {
        for (const agentKey of selectedAgentKeys) {
          if (!s.nativeAgents?.includes(agentKey)) {
            tasks.push(
              fetch("/api/skills/symlink", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skillName: s.name, agentKey, enable }),
              })
            );
          }
        }
      }
      await Promise.all(tasks);
      await Promise.all([fetchSkills(), fetchAgents()]);
    } catch (e) {
      console.error("Execute batch symlink error:", e);
    } finally {
      setBatchLoading(null);
    }
  };

  const handleBatchSymlinkForDrawer = async (
    sourcePath: string,
    groupSkills: SkillItem[],
    agentKey: string,
    enable: boolean
  ) => {
    setBatchLoading(sourcePath);
    try {
      const manageableSkills = groupSkills.filter(
        (s) => !s.nativeAgents?.includes(agentKey)
      );
      await Promise.all(
        manageableSkills.map((s) =>
          fetch("/api/skills/symlink", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skillName: s.name, agentKey, enable }),
          })
        )
      );
      await Promise.all([fetchSkills(), fetchAgents()]);
    } catch (e) {
      console.error("Batch symlink for drawer error:", e);
    } finally {
      setBatchLoading(null);
    }
  };

  const handleBatchSymlinkForMainRepo = async (
    sourcePath: string,
    groupSkills: SkillItem[],
    enable: boolean
  ) => {
    setBatchLoading(sourcePath);
    try {
      const activeAgents = agentsList.filter((a) => a.enabled);
      const tasks: Promise<any>[] = [];
      for (const s of groupSkills) {
        for (const agent of activeAgents) {
          if (!s.nativeAgents?.includes(agent.key)) {
            tasks.push(
              fetch("/api/skills/symlink", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skillName: s.name, agentKey: agent.key, enable }),
              })
            );
          }
        }
      }
      await Promise.all(tasks);
      await Promise.all([fetchSkills(), fetchAgents()]);
    } catch (e) {
      console.error("Batch symlink for main repo error:", e);
    } finally {
      setBatchLoading(null);
    }
  };

  const fetchSkills = useCallback(async () => {
    setLoadingSkills(true);
    try {
      const res = await fetch(`/api/skills?includeAgentNative=true`);
      const data = await res.json();
      if (data.skills) setSkills(data.skills);
    } catch (e) {
      console.error("Fetch skills error:", e);
    } finally {
      setLoadingSkills(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch(`/api/agents`);
      const data = await res.json();
      if (data.agents) setAgentsList(data.agents);
    } catch (e) {
      console.error("Fetch agents error:", e);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/config`);
      const data = await res.json();
      if (data.sourceDirs) setSourceDirs(data.sourceDirs);
    } catch (e) {
      console.error("Fetch config error:", e);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
    fetchAgents();
    fetchConfig();
  }, [fetchSkills, fetchAgents, fetchConfig]);

  const toggleAgentActivation = async (agentKey: string, enabled: boolean) => {
    setTogglingAgent(agentKey);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setAgentsList((prev) =>
          prev.map((a) => (a.key === agentKey ? { ...a, enabled } : a))
        );
        fetchSkills();
      }
    } catch (e) {
      console.error("Toggle agent activation error:", e);
    } finally {
      setTogglingAgent(null);
    }
  };

  const toggleSymlink = async (skillName: string, agentKey: string, enable: boolean) => {
    const toggleId = `${skillName}-${agentKey}`;
    setTogglingSymlink(toggleId);
    try {
      const res = await fetch("/api/skills/symlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName, agentKey, enable }),
      });
      const data = await res.json();
      if (data.success) {
        setSkills((prev) =>
          prev.map((s) => {
            if (s.name === skillName) {
              const nextAgents = enable
                ? Array.from(new Set([...s.linkedAgents, agentKey]))
                : s.linkedAgents.filter((a) => a !== agentKey);
              const nextSymlinks = enable
                ? Array.from(new Set([...(s.symlinkedAgents || []), agentKey]))
                : (s.symlinkedAgents || []).filter((a) => a !== agentKey);
              return { ...s, linkedAgents: nextAgents, symlinkedAgents: nextSymlinks };
            }
            return s;
          })
        );
        fetchAgents();
      }
    } catch (e) {
      console.error("Toggle symlink error:", e);
    } finally {
      setTogglingSymlink(null);
    }
  };

  const openInFinder = async (folderPath: string) => {
    try {
      await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });
    } catch (e) {
      console.error("Open in Finder error:", e);
    }
  };

  const handleSelectFolder = async () => {
    setSelectingFolder(true);
    try {
      const res = await fetch("/api/select-folder", { method: "POST" });
      const data = await res.json();
      if (data.success && data.folderPath) {
        setNewDirInput(data.folderPath);
      }
    } catch (e) {
      console.error("Select folder error:", e);
    } finally {
      setSelectingFolder(false);
    }
  };

  const handleAddSourceDir = async () => {
    if (!newDirInput.trim()) return;
    const nextDirs = Array.from(new Set([...sourceDirs, newDirInput.trim()]));
    setSavingConfig(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDirs: nextDirs }),
      });
      const data = await res.json();
      if (data.sourceDirs) {
        setSourceDirs(data.sourceDirs);
        setNewDirInput("");
        fetchSkills();
      }
    } catch (e) {
      console.error("Save source dir error:", e);
    } finally {
      setSavingConfig(false);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleRemoveSourceDir = async (dirToRemove: string) => {
    if (dirToRemove.endsWith(".skills-library") || dirToRemove.includes("/.skills-library")) return;
    const nextDirs = sourceDirs.filter((d) => d !== dirToRemove);
    setSavingConfig(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDirs: nextDirs }),
      });
      const data = await res.json();
      if (data.sourceDirs) {
        setSourceDirs(data.sourceDirs);
        fetchSkills();
      }
    } catch (e) {
      console.error("Remove source dir error:", e);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDropSourceDir = async (fromIndex: number, toIndex: number) => {
    const isDefault = (p: string) => p.endsWith(".skills-library") || p.includes("/.skills-library");
    const sorted = [...sourceDirs].sort((a, b) => {
      if (isDefault(a) && !isDefault(b)) return -1;
      if (!isDefault(a) && isDefault(b)) return 1;
      return 0;
    });

    if (fromIndex < 1 || toIndex < 1 || fromIndex >= sorted.length || toIndex >= sorted.length || fromIndex === toIndex) return;

    const nextDirs = [...sorted];
    const [movedItem] = nextDirs.splice(fromIndex, 1);
    nextDirs.splice(toIndex, 0, movedItem);

    setSavingConfig(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDirs: nextDirs }),
      });
      const data = await res.json();
      if (data.sourceDirs) {
        setSourceDirs(data.sourceDirs);
        fetchSkills();
      }
    } catch (e) {
      console.error("Drop reorder source dir error:", e);
    } finally {
      setSavingConfig(false);
    }
  };

  const copyToClipboard = (pathStr: string) => {
    navigator.clipboard.writeText(pathStr);
    setCopiedPath(pathStr);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const toggleGroupCollapse = (sourcePath: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [sourcePath]: prev[sourcePath] === false ? true : false,
    }));
  };

  const expandAllGroups = () => {
    const next: Record<string, boolean> = {};
    for (const [pathStr] of groupedEntries) {
      next[pathStr] = false;
    }
    setCollapsedGroups(next);
  };

  const collapseAllGroups = () => {
    const next: Record<string, boolean> = {};
    for (const [pathStr] of groupedEntries) {
      next[pathStr] = true;
    }
    setCollapsedGroups(next);
  };

  const toggleDrawerGroupCollapse = (sourcePath: string) => {
    setDrawerCollapsedGroups((prev) => ({
      ...prev,
      [sourcePath]: !prev[sourcePath],
    }));
  };

  // User source skills (excluding internal Agent native directories on the main skills library page)
  const mainSkillsOnly = skills.filter((s) =>
    sourceDirs.some((dir) => s.sourceDir === dir || s.sourceDir.startsWith(dir))
  );

  // Search filter for skills
  const filteredSkills = mainSkillsOnly.filter((s) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      s.name.toLowerCase().includes(query) ||
      s.fullPath.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query)
    );
  });

  // Group filteredSkills by sourceDir for Grouped View
  const groupedSkillsMap = new Map<string, SkillItem[]>();
  for (const s of filteredSkills) {
    const dir = s.sourceDir || "其他源目录";
    if (!groupedSkillsMap.has(dir)) {
      groupedSkillsMap.set(dir, []);
    }
    groupedSkillsMap.get(dir)!.push(s);
  }
  const groupedEntries = Array.from(groupedSkillsMap.entries()).sort(([pathA], [pathB]) => {
    const isDefaultA = pathA.endsWith(".skills-library") || pathA.includes("/.skills-library");
    const isDefaultB = pathB.endsWith(".skills-library") || pathB.includes("/.skills-library");
    if (isDefaultA && !isDefaultB) return -1;
    if (!isDefaultA && isDefaultB) return 1;
    const idxA = sourceDirs.indexOf(pathA);
    const idxB = sourceDirs.indexOf(pathB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  // Filter for agents
  const enabledAgents = agentsList.filter((a) => a.enabled);
  const installedAgents = agentsList.filter((a) => a.installed);

  const filteredAgents = agentsList.filter((a) => {
    if (agentFilter === "enabled") return a.enabled;
    if (agentFilter === "installed") return a.installed;
    return true;
  });

  const openAgentDrawer = (agent: AgentInfo) => {
    setActiveAgentDrawer(agent);
    setDrawerTab("linked");
  };

  const drawerSkills = activeAgentDrawer
    ? drawerTab === "linked"
      ? skills.filter((s) => s.linkedAgents.includes(activeAgentDrawer.key))
      : skills.filter((s) => {
          const isUserSource = sourceDirs.some(
            (dir) => s.sourceDir === dir || s.sourceDir.startsWith(dir)
          );
          if (isUserSource) return true;
          return Boolean(s.nativeAgents?.includes(activeAgentDrawer.key));
        })
    : [];

  const renderSkillCard = (s: SkillItem) => {
    if (skillDensity === "compact") {
      return (
        <div
          key={s.name}
          className="glass-panel-interactive rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80 group hover:border-purple-300 shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 glow-emerald shrink-0" />
            <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <h3
                className="font-mono font-bold text-xs text-slate-950 group-hover:text-purple-700 transition truncate shrink-0 max-w-[220px]"
                title={s.name}
              >
                {s.name}
              </h3>
              {s.description && (
                <span className="text-[11px] text-slate-500 font-sans truncate flex-1" title={s.description}>
                  {s.description}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            {s.linkedAgents.length > 0 && (
              <div className="flex items-center -space-x-1.5 shrink-0 mr-1" title={`已关联 ${s.linkedAgents.length} 款 Agent (${s.linkedAgents.join(", ")})`}>
                {s.linkedAgents.slice(0, 4).map((agentKey) => (
                  <div
                    key={agentKey}
                    className="w-5 h-5 rounded-full bg-white p-0.5 border border-purple-300 shadow-sm flex items-center justify-center"
                    title={agentKey}
                  >
                    <AgentIcon agentKey={agentKey} className="w-3.5 h-3.5 object-contain" />
                  </div>
                ))}
                {s.linkedAgents.length > 4 && (
                  <div className="w-5 h-5 rounded-full bg-purple-100 border border-purple-300 text-purple-800 text-[9px] font-bold flex items-center justify-center font-mono">
                    +{s.linkedAgents.length - 4}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => openInFinder(s.fullPath)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg transition flex items-center gap-1"
              title="在访达中打开"
            >
              <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>访达</span>
            </button>

            <button
              onClick={() => setActiveSkillModalName(s.name)}
              className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition whitespace-nowrap"
            >
              配置 ({s.linkedAgents.length})
            </button>
          </div>
        </div>
      );
    }

    // Normal mode card
    return (
      <div
        key={s.name}
        className="glass-panel-interactive rounded-2xl p-5 flex flex-col justify-between space-y-4 group border border-slate-200/80"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 glow-emerald shrink-0" />
              <h3 className="font-mono font-bold text-base text-slate-950 group-hover:text-purple-700 transition truncate" title={s.name}>
                {s.name}
              </h3>
            </div>
            {s.linkedAgents.length === 0 ? (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 whitespace-nowrap shrink-0">
                未关联
              </span>
            ) : (
              <div className="flex items-center -space-x-1.5 shrink-0" title={`已关联 ${s.linkedAgents.length} 款 Agent (${s.linkedAgents.join(", ")})`}>
                {s.linkedAgents.slice(0, 5).map((agentKey) => (
                  <div
                    key={agentKey}
                    className="w-6 h-6 rounded-full bg-white p-0.5 border border-purple-300 shadow-sm flex items-center justify-center transition-transform hover:scale-110 hover:z-10"
                    title={agentKey}
                  >
                    <AgentIcon agentKey={agentKey} className="w-4 h-4 object-contain" />
                  </div>
                ))}
                {s.linkedAgents.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-purple-100 border border-purple-300 text-purple-800 text-[10px] font-bold flex items-center justify-center shadow-sm font-mono">
                    +{s.linkedAgents.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>

          {s.description && (
            <p className="text-xs text-slate-600 font-sans line-clamp-2">
              {s.description}
            </p>
          )}

          {/* 路径与源仓储 */}
          <div className="bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 text-[11px] font-mono space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-700 font-medium truncate flex-1" title={s.fullPath}>
                {s.fullPath}
              </span>
              <button
                onClick={() => copyToClipboard(s.fullPath)}
                className="shrink-0 text-[10px] font-mono font-bold text-purple-700 hover:text-white px-2 py-0.5 bg-white hover:bg-purple-600 border border-purple-200 rounded transition shadow-sm"
              >
                {copiedPath === s.fullPath ? "✓ 已复制" : "复制"}
              </button>
            </div>
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2 font-mono text-xs">
          <button
            onClick={() => openInFinder(s.fullPath)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>在访达中打开</span>
          </button>

          <button
            onClick={() => setActiveSkillModalName(s.name)}
            className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            <span>配置 Agent 软链接 ({s.linkedAgents.length})</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-900 font-sans selection:bg-purple-500 selection:text-white">
      {/* 顶部 Header */}
      <header className="h-16 px-6 flex items-center justify-between shrink-0 glass-panel rounded-b-2xl mx-4 mt-2 z-20">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="SKILLS Logo"
            className="w-8 h-8 rounded-xl object-cover shadow-sm border border-slate-200/80 shrink-0"
          />
          <h1 className="font-mono text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-700 via-indigo-600 to-cyan-600 font-extrabold">
              SKILLS MANAGE
            </span>
          </h1>
        </div>

        {/* 指标 Widget 组 */}
        <div className="hidden md:flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel shadow-sm">
            <span className="text-slate-500 font-medium">源仓储 Skill:</span>
            <span className="text-purple-700 font-extrabold">{skills.length}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel shadow-sm">
            <span className="text-slate-500 font-medium">已激活 AGENT:</span>
            <span className="text-emerald-700 font-extrabold">{enabledAgents.length} / {agentsList.length}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel shadow-sm">
            <span className="text-slate-500 font-medium">源目录数:</span>
            <span className="text-indigo-700 font-extrabold">{sourceDirs.length}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden p-4 gap-4">
        {/* 左侧 固定侧边栏 */}
        <aside className="w-64 h-full glass-panel rounded-2xl flex flex-col justify-between shrink-0 p-4 z-10 shadow-sm overflow-y-auto">
          <div className="space-y-5">
            <div className="px-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-bold text-purple-700/90 tracking-widest">
                // 导航菜单
              </span>
              <div className="w-2 h-2 rounded-full bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.6)]" />
            </div>

            <nav className="space-y-2">
              {MENU.map((m) => {
                const active = page === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPage(m.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-mono text-xs transition-all duration-200 flex flex-col gap-1 ${
                      active
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-[0_4px_16px_rgba(147,51,234,0.3)]"
                        : "text-slate-700 hover:bg-white hover:text-purple-900 border border-transparent shadow-none"
                    }`}
                  >
                    <span className={active ? "text-purple-200 text-[10px]" : "text-slate-400 text-[10px]"}>
                      {m.code}
                    </span>
                    <span className="text-sm font-sans font-semibold">{m.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-3 border-t border-slate-200/80 text-[10px] font-mono text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>环境:</span>
              <span className="text-slate-800 font-semibold">Node.js Native FS</span>
            </div>
            <div className="flex justify-between">
              <span> Agent 激活数:</span>
              <span className="text-purple-700 font-bold">{enabledAgents.length} 款</span>
            </div>
          </div>
        </aside>

        {/* 右侧 主工作区 */}
        <main className="flex-1 h-full overflow-y-auto glass-panel rounded-2xl p-6 lg:p-8 z-10 shadow-sm">
          {page === "installed" && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* 标题 & 工具栏 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-950 tracking-tight">
                    技能库与 Agent 软链接
                  </h2>
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  {/* 维度 1: 布局视图切换选择器 (按源仓储调换在左侧，平铺在右侧) */}
                  <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 font-mono text-xs">
                    <button
                      onClick={() => setSkillLayout("grouped")}
                      className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                        skillLayout === "grouped"
                          ? "bg-white text-purple-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>按源仓储</span>
                    </button>
                    <button
                      onClick={() => setSkillLayout("grid")}
                      className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                        skillLayout === "grid"
                          ? "bg-white text-purple-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span>平铺</span>
                    </button>
                  </div>

                  {/* 维度 2: 新增“紧凑布局”独立切换选择器 */}
                  <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 font-mono text-xs">
                    <button
                      onClick={() => setSkillDensity("normal")}
                      className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                        skillDensity === "normal"
                          ? "bg-white text-purple-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>舒适</span>
                    </button>
                    <button
                      onClick={() => setSkillDensity("compact")}
                      className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1.5 ${
                        skillDensity === "compact"
                          ? "bg-white text-purple-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>紧凑</span>
                    </button>
                  </div>

                  <button
                    onClick={() => fetchSkills()}
                    disabled={loadingSkills}
                    className="px-4 py-2 glass-btn-secondary text-slate-800 text-xs font-mono font-semibold rounded-xl flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <svg className={`w-3.5 h-3.5 ${loadingSkills ? "animate-spin text-purple-600" : "text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{loadingSkills ? "扫描中..." : "重新扫描"}</span>
                  </button>
                </div>
              </div>

              {/* 搜索过滤栏 */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索 Skill 名称、源仓储路径或说明描述..."
                  className="w-full glass-input rounded-xl px-4 py-3 pl-11 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition font-medium"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-2.5 text-xs font-mono text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-white border border-slate-300 rounded-lg shadow-sm"
                  >
                    清空
                  </button>
                )}
              </div>

              {/* Skill 列表为空时的空状态 */}
              {filteredSkills.length === 0 && (
                <div className="p-12 text-center glass-panel rounded-2xl space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 mx-auto flex items-center justify-center text-purple-700 shadow-sm">
                    <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="font-sans text-sm font-bold text-slate-800">
                    {searchQuery ? "未匹配到相关 Skill。" : "已配置源仓储中尚未找到 Skill 文件夹。"}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    可在【源仓储目录配置】中添加本地存放文件夹。
                  </p>
                </div>
              )}

              {/* View 1: 默认平铺网格模式 (根据 skillDensity 控制列数与间距) */}
              {skillLayout === "grid" && filteredSkills.length > 0 && (
                <div className={skillDensity === "compact" ? "space-y-2.5" : "grid grid-cols-1 md:grid-cols-2 gap-5"}>
                  {filteredSkills.map((s) => renderSkillCard(s))}
                </div>
              )}

              {/* View 2: 按源仓储路径分组模式 (默认全部收起状态 + 展开全部/收起全部辅助按钮) */}
              {skillLayout === "grouped" && filteredSkills.length > 0 && (
                <div className="space-y-4">
                  {/* 一键展开/收起全部分组按钮 */}
                  <div className="flex items-center justify-between px-1 font-mono text-xs">
                    <span className="text-slate-500 font-bold">
                      共 {groupedEntries.length} 个源仓储分组 (默认收起)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={expandAllGroups}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition"
                      >
                        展开全部
                      </button>
                      <button
                        onClick={collapseAllGroups}
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition"
                      >
                        收起全部
                      </button>
                    </div>
                  </div>

                  {groupedEntries.map(([sourcePath, groupSkills]) => {
                    // 默认全收起 (Boolean(collapsedGroups[sourcePath] !== false))
                    const isCollapsed = collapsedGroups[sourcePath] !== false;

                    return (
                      <div key={sourcePath} className="space-y-3">
                        {/* 可折叠的 Header 栏 */}
                        <div
                          onClick={() => toggleGroupCollapse(sourcePath)}
                          className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4 border border-purple-200 hover:border-purple-400 shadow-sm cursor-pointer transition group select-none"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* 直接绘制 矢量 SVG 图标 */}
                            <svg className="w-5 h-5 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>

                            <div className="flex items-center gap-2 min-w-0">
                              {/* 旋转 Chevron 箭头 (收起时向左/下 旋转) */}
                              <svg
                                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                                  isCollapsed ? "-rotate-90 text-slate-400" : "rotate-0 text-purple-600"
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>

                              <span className="font-mono text-xs font-bold text-slate-900 truncate" title={sourcePath}>
                                {sourcePath}
                              </span>

                              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                {groupSkills.length} 个 Skill
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              disabled={batchLoading === sourcePath}
                              onClick={(e) => {
                                e.stopPropagation();
                                openBatchMountModal(sourcePath, groupSkills, "mount");
                              }}
                              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-mono font-bold rounded-xl shadow-xs transition flex items-center gap-1 shrink-0"
                              title="选择要批量挂载的 Agent 智能体"
                            >
                              <span>{batchLoading === sourcePath ? "处理中..." : "+ 批量挂载"}</span>
                            </button>

                            <button
                              disabled={batchLoading === sourcePath}
                              onClick={(e) => {
                                e.stopPropagation();
                                openBatchMountModal(sourcePath, groupSkills, "unmount");
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-mono font-bold rounded-xl border border-rose-200 transition shrink-0"
                              title="选择要批量移除软链接的 Agent 智能体"
                            >
                              批量移除
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openInFinder(sourcePath);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono font-bold rounded-xl transition flex items-center gap-1 shrink-0"
                            >
                              <span>📁 访达</span>
                            </button>
                          </div>
                        </div>

                        {/* 该分组下的 Skill Cards 网格 (未折叠时显示，支持 舒适 vs 紧凑) */}
                        {!isCollapsed && (
                          <div
                            className={
                              skillDensity === "compact"
                                ? "space-y-2.5 pl-2"
                                : "grid grid-cols-1 md:grid-cols-2 gap-5 pl-2"
                            }
                          >
                            {groupSkills.map((s) => renderSkillCard(s))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {page === "agents" && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* 标题 & 工具栏 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-950 tracking-tight">
                    支持的 Agent 引擎列表
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 font-mono text-xs">
                    <button
                      onClick={() => setAgentFilter("enabled")}
                      className={`px-3 py-1 rounded-lg transition font-bold ${
                        agentFilter === "enabled"
                          ? "bg-white text-purple-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      已激活 ({enabledAgents.length})
                    </button>
                    <button
                      onClick={() => setAgentFilter("installed")}
                      className={`px-3 py-1 rounded-lg transition font-bold ${
                        agentFilter === "installed"
                          ? "bg-white text-purple-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      已检测到 ({installedAgents.length})
                    </button>
                    <button
                      onClick={() => setAgentFilter("all")}
                      className={`px-3 py-1 rounded-lg transition font-bold ${
                        agentFilter === "all"
                          ? "bg-white text-purple-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      全部 ({agentsList.length})
                    </button>
                  </div>

                  <button
                    onClick={() => fetchAgents()}
                    disabled={loadingAgents}
                    className="px-4 py-2 glass-btn-secondary text-slate-800 text-xs font-mono font-semibold rounded-xl flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <svg className={`w-3.5 h-3.5 ${loadingAgents ? "animate-spin text-purple-600" : "text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{loadingAgents ? "检测中..." : "重新检测"}</span>
                  </button>
                </div>
              </div>

              {/* Agent Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredAgents.map((agent) => {
                  const isActivating = togglingAgent === agent.key;

                  return (
                    <div
                      key={agent.key}
                      className={`glass-panel-interactive rounded-2xl p-5 flex flex-col justify-between space-y-4 border transition ${
                        agent.enabled
                          ? "border-purple-300 bg-white/95 shadow-sm"
                          : "border-slate-200/80 opacity-70 bg-slate-50/50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <AgentIcon agentKey={agent.key} className="w-8 h-8 shrink-0 object-contain" />
                            <div>
                              <h3 className="font-mono font-bold text-base text-slate-950 flex items-center gap-2">
                                <span>{agent.name}</span>
                              </h3>
                              <span className="text-[10px] font-mono text-slate-500">
                                ID: {agent.key}
                              </span>
                            </div>
                          </div>

                          {/* 手动激活开关 */}
                          <button
                            disabled={isActivating}
                            onClick={() => toggleAgentActivation(agent.key, !agent.enabled)}
                            className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                              agent.enabled
                                ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 shadow-sm"
                                : "bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                agent.enabled ? "bg-emerald-500 glow-emerald" : "bg-slate-400"
                              }`}
                            />
                            <span>{agent.enabled ? "✓ 已激活" : "+ 手动激活"}</span>
                          </button>
                        </div>

                        <p className="text-xs text-slate-600 font-sans leading-relaxed">
                          {agent.description}
                        </p>

                        <div className="bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 text-[11px] font-mono space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 font-medium truncate flex-1" title={agent.detectedPath}>
                              {agent.detectedPath}
                            </span>
                            {agent.installed && (
                              <span className="text-[10px] text-emerald-700 font-bold px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                                本机存在
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 底部功能条：静态信息指示 + 单一触发按钮 */}
                      <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                        {agent.enabled ? (
                          <span className="text-xs font-mono font-bold text-purple-800 bg-purple-100/70 px-3 py-1.5 rounded-xl border border-purple-200/80">
                            已关联 {agent.skillCount} 个 Skill
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">
                            未激活 (不参与软链接配置)
                          </span>
                        )}

                        {agent.enabled && (
                          <button
                            onClick={() => openAgentDrawer(agent)}
                            className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition whitespace-nowrap shrink-0"
                          >
                            管理 Skills
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {page === "config" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 标题 */}
              <div className="pb-4 border-b border-slate-200/80">
                <h2 className="text-xl font-bold font-sans text-slate-950 tracking-tight">
                  源仓储目录配置
                </h2>
              </div>

              {/* 添加新源目录 */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <h3 className="font-mono font-bold text-sm text-slate-900">
                  + 添加新的本地 Skill 源仓储文件夹
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newDirInput}
                    onChange={(e) => setNewDirInput(e.target.value)}
                    placeholder="输入绝对路径 (如 /Users/username/my-custom-skills)..."
                    className="flex-1 glass-input rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 outline-none"
                  />

                  <button
                    onClick={handleSelectFolder}
                    disabled={selectingFolder}
                    className="px-4 py-2.5 glass-btn-secondary text-slate-800 hover:text-purple-900 font-mono text-xs font-bold rounded-xl transition flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    <svg className={`w-4 h-4 ${selectingFolder ? "animate-spin text-purple-600" : "text-purple-700"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>{selectingFolder ? "选择中..." : "选择文件夹..."}</span>
                  </button>

                  <button
                    onClick={handleAddSourceDir}
                    disabled={savingConfig || !newDirInput.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-mono text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 shrink-0"
                  >
                    {savingConfig ? "添加中..." : "确认添加"}
                  </button>
                </div>
              </div>

              {/* 已配置的源目录列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 font-mono text-xs">
                  <h3 className="font-mono font-bold text-sm text-slate-900">
                    已添加的源仓储目录 ({sourceDirs.length})
                  </h3>
                  <span className="text-slate-500 font-bold text-[11px] flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    按住图标上下拖动可自由调整仓储分组展示顺序
                  </span>
                </div>

                {(() => {
                  const isDefault = (p: string) => p.endsWith(".skills-library") || p.includes("/.skills-library");
                  const sorted = [...sourceDirs].sort((a, b) => {
                    if (isDefault(a) && !isDefault(b)) return -1;
                    if (!isDefault(a) && isDefault(b)) return 1;
                    return 0;
                  });

                  return sorted.map((dirPath, idx) => {
                    const isDefaultLib = isDefault(dirPath);
                    const isDragging = draggedIndex === idx;
                    const isOver = dragOverIndex === idx;

                    return (
                      <div
                        key={dirPath}
                        draggable={!isDefaultLib && !savingConfig}
                        onDragStart={(e) => {
                          if (isDefaultLib) return;
                          setDraggedIndex(idx);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          if (isDefaultLib || draggedIndex === null || draggedIndex === 0) return;
                          e.preventDefault();
                          setDragOverIndex(idx);
                        }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverIndex(null);
                          if (!isDefaultLib && draggedIndex !== null) {
                            handleDropSourceDir(draggedIndex, idx);
                            setDraggedIndex(null);
                          }
                        }}
                        className={`glass-panel-interactive rounded-2xl p-4 flex items-center justify-between gap-4 border transition-all duration-150 ${
                          isOver
                            ? "border-purple-500 bg-purple-50/90 shadow-md translate-y-[-2px]"
                            : isDragging
                            ? "border-purple-300 opacity-40 bg-purple-50/30 scale-[0.99]"
                            : "border-slate-200/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {!isDefaultLib ? (
                            <div
                              className="text-slate-400 hover:text-purple-600 cursor-grab active:cursor-grabbing shrink-0 p-1.5 rounded-lg hover:bg-purple-100/60 transition flex items-center"
                              title="按住拖拽调整顺序"
                            >
                              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16" />
                              </svg>
                            </div>
                          ) : (
                            <svg className="w-5 h-5 text-purple-600 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          )}

                          <span className="font-mono text-xs text-slate-900 font-bold truncate">
                            {dirPath}
                          </span>
                          {isDefaultLib && (
                            <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200 shrink-0">
                              内置默认
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => openInFinder(dirPath)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono font-bold rounded-xl transition"
                          >
                            在访达中打开
                          </button>
                          {!isDefaultLib && (
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: "确认移除源仓储目录？",
                                  message: `是否确定从配置中移除源仓储目录【${dirPath}】？移除后该目录下的 Skill 将不再出现在技能库中（不会删除磁盘本地文件）。`,
                                  confirmText: "确认移除",
                                  cancelText: "取消",
                                  onConfirm: () => handleRemoveSourceDir(dirPath),
                                });
                              }}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-mono font-bold rounded-xl border border-rose-200 transition"
                            >
                              移除
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal 1: 配置具体 Skill 的已激活 Agent 软链接 */}
      {activeSkillModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-purple-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-mono font-bold text-lg text-slate-950 flex items-center gap-2">
                  <span>配置【{activeSkillModal.name}】的 Agent 软链接</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  只展示已激活的智能体 ({enabledAgents.length} 款)，勾选即可在其目录中创建 Symlink 软链接
                </p>
              </div>
              <button
                onClick={() => setActiveSkillModalName(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enabledAgents.length === 0 && (
                <div className="col-span-2 text-center p-8 text-slate-500 font-mono text-xs">
                  目前尚未激活任何 Agent。请在“支持的 Agent 引擎”中开启激活状态。
                </div>
              )}
              {enabledAgents.map((agent) => {
                const isLinked = activeSkillModal.linkedAgents.includes(agent.key);
                const toggleId = `${activeSkillModal.name}-${agent.key}`;
                const isBusy = togglingSymlink === toggleId;

                return (
                  <label
                    key={agent.key}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                      isLinked
                        ? "bg-purple-50/90 border-purple-300 text-purple-900 font-bold shadow-sm"
                        : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AgentIcon agentKey={agent.key} className="w-6 h-6 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-bold truncate">{agent.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{agent.key}</div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isLinked}
                      disabled={isBusy}
                      onChange={(e) => toggleSymlink(activeSkillModal.name, agent.key, e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Drawer 2: 配置具体 Agent 所关联的 Skills 专属列表 */}
      {activeAgentDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-purple-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <AgentIcon agentKey={activeAgentDrawer.key} className="w-8 h-8 shrink-0" />
                <h3 className="font-mono font-bold text-lg text-slate-950 truncate">
                  {activeAgentDrawer.name} 技能列表
                </h3>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* 视图 Tab 切换: 单行已关联 (N) vs 全部技能 */}
                <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 font-mono text-xs shrink-0">
                  <button
                    onClick={() => setDrawerTab("linked")}
                    className={`px-3.5 py-1.5 rounded-lg transition font-bold whitespace-nowrap shrink-0 ${
                      drawerTab === "linked"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    已关联 ({skills.filter((s) => s.linkedAgents.includes(activeAgentDrawer.key)).length})
                  </button>
                  <button
                    onClick={() => setDrawerTab("all")}
                    className={`px-3.5 py-1.5 rounded-lg transition font-bold whitespace-nowrap shrink-0 ${
                      drawerTab === "all"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    全部技能 ({skills.filter((s) => sourceDirs.some((dir) => s.sourceDir === dir || s.sourceDir.startsWith(dir)) || Boolean(s.nativeAgents?.includes(activeAgentDrawer.key))).length})
                  </button>
                </div>

                <button
                  onClick={() => setActiveAgentDrawer(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* List Body (按仓库源分组 + 手风琴折叠) */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {drawerSkills.length === 0 ? (
                <div className="text-center p-12 text-slate-500 font-mono text-xs space-y-2">
                  <p className="font-bold text-slate-700">
                    {drawerTab === "linked"
                      ? `【${activeAgentDrawer.name}】目前尚未关联任何 Skill。`
                      : "源仓储中尚未找到 Skill。"}
                  </p>
                  {drawerTab === "linked" && (
                    <button
                      onClick={() => setDrawerTab("all")}
                      className="text-purple-700 underline hover:text-purple-900 font-bold"
                    >
                      切换到全部技能列表进行添加 ↗
                    </button>
                  )}
                </div>
              ) : (
                (() => {
                  const drawerGroupedMap = new Map<string, SkillItem[]>();
                  for (const s of drawerSkills) {
                    const dir = s.sourceDir || "其他源目录";
                    if (!drawerGroupedMap.has(dir)) {
                      drawerGroupedMap.set(dir, []);
                    }
                    drawerGroupedMap.get(dir)!.push(s);
                  }

                  const isDefaultPath = (p: string) => p.endsWith(".skills-library") || p.includes("/.skills-library");
                  const drawerGroupedEntries = Array.from(drawerGroupedMap.entries()).sort(([pathA], [pathB]) => {
                    const isDefaultA = isDefaultPath(pathA);
                    const isDefaultB = isDefaultPath(pathB);
                    if (isDefaultA && !isDefaultB) return -1;
                    if (!isDefaultA && isDefaultB) return 1;
                    const idxA = sourceDirs.indexOf(pathA);
                    const idxB = sourceDirs.indexOf(pathB);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return 0;
                  });

                  const expandAllDrawerGroups = () => {
                    const next: Record<string, boolean> = {};
                    for (const [pathStr] of drawerGroupedEntries) {
                      next[pathStr] = false;
                    }
                    setDrawerCollapsedGroups(next);
                  };

                  const collapseAllDrawerGroups = () => {
                    const next: Record<string, boolean> = {};
                    for (const [pathStr] of drawerGroupedEntries) {
                      next[pathStr] = true;
                    }
                    setDrawerCollapsedGroups(next);
                  };

                  return (
                    <div className="space-y-4">
                      {/* 一键展开/收起全部分组按钮 */}
                      <div className="flex items-center justify-between px-1 font-mono text-xs">
                        <span className="text-slate-500 font-bold">
                          按源仓储分组 (共 {drawerGroupedEntries.length} 个组)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={expandAllDrawerGroups}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition"
                          >
                            展开全部
                          </button>
                          <button
                            onClick={collapseAllDrawerGroups}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition"
                          >
                            收起全部
                          </button>
                        </div>
                      </div>

                      {drawerGroupedEntries.map(([sourcePath, groupSkills]) => {
                        const isCollapsed = Boolean(drawerCollapsedGroups[sourcePath]);

                        return (
                          <div key={sourcePath} className="space-y-2.5">
                            {/* 手风琴 Header */}
                            <div
                              onClick={() => toggleDrawerGroupCollapse(sourcePath)}
                              className="glass-panel p-3.5 rounded-2xl flex items-center justify-between gap-4 border border-purple-200 hover:border-purple-400 shadow-xs cursor-pointer transition select-none group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                
                                <svg
                                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                    isCollapsed ? "-rotate-90 text-slate-400" : "rotate-0 text-purple-600"
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>

                                <span className="font-mono text-xs font-bold text-slate-900 truncate" title={sourcePath}>
                                  {sourcePath}
                                </span>

                                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                  {groupSkills.length} 个 Skill
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  disabled={batchLoading === sourcePath}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBatchSymlinkForDrawer(sourcePath, groupSkills, activeAgentDrawer.key, true);
                                  }}
                                  className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 text-[11px] font-mono font-bold rounded-xl transition border border-purple-200 shrink-0"
                                  title="一键为当前 Agent 批量挂载该仓储下的所有 Skill"
                                >
                                  {batchLoading === sourcePath ? "处理中..." : "+ 批量挂载"}
                                </button>

                                <button
                                  disabled={batchLoading === sourcePath}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: "确认批量移除此仓储的软链接？",
                                      message: `是否确定为【${activeAgentDrawer.name}】批量移除仓储【${sourcePath}】下全部 ${groupSkills.length} 个 Skill 的软链接？`,
                                      confirmText: "确认批量移除",
                                      cancelText: "取消",
                                      onConfirm: () => handleBatchSymlinkForDrawer(sourcePath, groupSkills, activeAgentDrawer.key, false),
                                    });
                                  }}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-[11px] font-mono font-bold rounded-xl border border-rose-200 transition shrink-0"
                                  title="一键从当前 Agent 移除该仓储下的所有 Skill 软链接"
                                >
                                  批量移除
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openInFinder(sourcePath);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-mono font-bold rounded-xl transition shrink-0"
                                >
                                  <span>📁 访达</span>
                                </button>
                              </div>
                            </div>

                            {/* 组内 Skills 列表 (未折叠时显示) */}
                            {!isCollapsed && (
                              <div className="space-y-2.5 pl-2">
                                {groupSkills.map((skill) => {
                                  const isSymlinked = skill.symlinkedAgents?.includes(activeAgentDrawer.key);
                                  const isNative = skill.nativeAgents?.includes(activeAgentDrawer.key);
                                  const isLinked = isSymlinked || isNative;
                                  const toggleId = `${skill.name}-${activeAgentDrawer.key}`;
                                  const isBusy = togglingSymlink === toggleId;

                                  return (
                                    <div
                                      key={skill.name}
                                      className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                                        isLinked
                                          ? isNative
                                            ? "bg-indigo-50/90 border-indigo-200 text-indigo-950 font-bold shadow-sm"
                                            : "bg-purple-50/90 border-purple-300 text-purple-900 font-bold shadow-sm"
                                          : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-white"
                                      }`}
                                    >
                                      <div className="space-y-1 min-w-0 pr-4 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`w-2.5 h-2.5 rounded-full ${
                                              isNative
                                                ? "bg-indigo-500"
                                                : isSymlinked
                                                  ? "bg-emerald-500 glow-emerald"
                                                  : "bg-slate-300"
                                            }`}
                                          />
                                          <span className="font-mono text-sm font-bold text-slate-950">
                                            {skill.name}
                                          </span>

                                          {isNative && (
                                            <span className="text-[10px] font-mono text-indigo-800 font-bold px-2 py-0.5 bg-indigo-100 rounded-full border border-indigo-200">
                                              📦 Agent 原生实体技能
                                            </span>
                                          )}

                                          {isSymlinked && (
                                            <span className="text-[10px] font-mono text-emerald-800 font-bold px-2 py-0.5 bg-emerald-100 rounded-full border border-emerald-200">
                                              ✓ 软链接已挂载
                                            </span>
                                          )}
                                        </div>

                                        {skill.description && (
                                          <div className="text-xs font-sans text-slate-600 line-clamp-1">
                                            {skill.description}
                                          </div>
                                        )}
                                        <div className="text-[10px] font-mono text-slate-400 truncate">
                                          源路径: {skill.fullPath}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 shrink-0">
                                        <button
                                          onClick={() => openInFinder(skill.fullPath)}
                                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded-lg border border-slate-200 transition"
                                        >
                                          <span>📁 访达</span>
                                        </button>

                                        {isNative ? (
                                          <span className="px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-indigo-700 bg-indigo-100/80 border border-indigo-200 select-none">
                                            Agent 原生实体目录
                                          </span>
                                        ) : (
                                          <button
                                            disabled={isBusy}
                                            onClick={() => toggleSymlink(skill.name, activeAgentDrawer.key, !isSymlinked)}
                                            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                                              isSymlinked
                                                ? "bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200"
                                                : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                            }`}
                                          >
                                            {isBusy ? "更新中..." : isSymlinked ? "移除软链接" : "+ 挂载软链接"}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-rose-200 shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-sans font-bold text-base text-slate-950">
                {confirmDialog.title}
              </h3>
            </div>

            <p className="text-xs font-mono text-slate-600 leading-relaxed bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-3 font-mono text-xs pt-2">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                {confirmDialog.cancelText || "取消"}
              </button>

              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition"
              >
                {confirmDialog.confirmText || "确认移除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchMountModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-purple-200 shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-mono font-bold text-base text-slate-950 flex items-center gap-2">
                  <span>
                    {batchMountModal.mode === "mount" ? "批量挂载仓储 Skill" : "批量移除仓储 Skill"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1 truncate max-w-md">
                  仓储: {batchMountModal.sourcePath} (共 {batchMountModal.groupSkills.length} 个 Skill)
                </p>
              </div>
              <button
                onClick={() => setBatchMountModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Select Control Sub-bar */}
            <div className="px-6 py-3 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between font-mono text-xs">
              <span className="text-purple-900 font-bold">
                请勾选要同步{batchMountModal.mode === "mount" ? "挂载" : "解绑"}的 Agent 智能体
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setBatchMountModal((prev) => ({
                      ...prev,
                      selectedAgentKeys: enabledAgents.map((a) => a.key),
                    }))
                  }
                  className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white px-2.5 py-1 rounded-lg border border-purple-200 transition"
                >
                  全选
                </button>
                <button
                  onClick={() =>
                    setBatchMountModal((prev) => ({
                      ...prev,
                      selectedAgentKeys: enabledAgents
                        .map((a) => a.key)
                        .filter((k) => !prev.selectedAgentKeys.includes(k)),
                    }))
                  }
                  className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 transition"
                >
                  反选
                </button>
                <button
                  onClick={() =>
                    setBatchMountModal((prev) => ({
                      ...prev,
                      selectedAgentKeys: [],
                    }))
                  }
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 transition"
                >
                  清空
                </button>
              </div>
            </div>

            {/* Agent Checkbox List */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enabledAgents.length === 0 ? (
                <div className="col-span-2 text-center p-8 text-slate-500 font-mono text-xs">
                  暂无已激活的 Agent，请先在【支持的 Agent 引擎】中开启激活状态。
                </div>
              ) : (
                enabledAgents.map((agent) => {
                  const isChecked = batchMountModal.selectedAgentKeys.includes(agent.key);
                  return (
                    <label
                      key={agent.key}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? "bg-purple-50/90 border-purple-300 text-purple-900 font-bold shadow-sm"
                          : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AgentIcon agentKey={agent.key} className="w-6 h-6 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-bold truncate">{agent.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{agent.key}</div>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBatchMountModal((prev) => ({
                              ...prev,
                              selectedAgentKeys: Array.from(new Set([...prev.selectedAgentKeys, agent.key])),
                            }));
                          } else {
                            setBatchMountModal((prev) => ({
                              ...prev,
                              selectedAgentKeys: prev.selectedAgentKeys.filter((k) => k !== agent.key),
                            }));
                          }
                        }}
                        className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                      />
                    </label>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-500">
                已勾选 {batchMountModal.selectedAgentKeys.length} 款 Agent
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBatchMountModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
                >
                  取消
                </button>
                <button
                  disabled={batchMountModal.selectedAgentKeys.length === 0}
                  onClick={executeBatchSymlinkForSelectedAgents}
                  className={`px-5 py-2 font-bold text-white rounded-xl shadow-md transition disabled:opacity-50 ${
                    batchMountModal.mode === "mount"
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {batchMountModal.mode === "mount"
                    ? `确认批量挂载到 ${batchMountModal.selectedAgentKeys.length} 款 Agent`
                    : `确认批量从 ${batchMountModal.selectedAgentKeys.length} 款 Agent 移除`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
