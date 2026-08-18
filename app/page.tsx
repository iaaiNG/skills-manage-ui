"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AgentIcon } from "@/lib/agent-icons";
import {
  apiGetSkills,
  apiGetAgents,
  apiUpdateAgent,
  apiGetConfig,
  apiSaveConfig,
  apiToggleSymlink,
  apiSelectFolder,
} from "@/lib/tauri-ipc";

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
  isCustom?: boolean;
  resolvedGlobalPaths: string[];
}

type Page = "installed" | "agents" | "config";

const MENU: { id: Page; label: string; code: string }[] = [
  { id: "installed", label: "技能库仓储与软链接", code: "01 // SKILLS" },
  { id: "agents", label: "支持的 Agent 引擎", code: "02 // AGENTS" },
  { id: "config", label: "源仓储目录配置", code: "03 // SOURCES" },
];

function SourceDirOverlayCard({ dirPath }: { dirPath: string }) {
  return (
    <div className="glass-panel-interactive rounded-2xl p-4 flex items-center justify-between gap-4 border border-purple-500 bg-white/95 shadow-2xl scale-[1.02] cursor-grabbing select-none">
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-purple-600 shrink-0 p-1.5 rounded-lg bg-purple-100/80 flex items-center">
          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <span className="font-mono text-xs text-slate-900 font-bold truncate">
          {dirPath}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="px-3 py-1.5 bg-purple-100 text-purple-800 text-xs font-mono font-bold rounded-xl">
          移动中...
        </span>
      </div>
    </div>
  );
}

function DefaultSourceDirItem({
  dirPath,
}: {
  dirPath: string;
}) {
  return (
    <div className="glass-panel-interactive rounded-2xl p-4 flex items-center justify-between gap-4 border border-purple-200/80 bg-purple-50/20">
      <div className="flex items-center gap-3 min-w-0">
        <svg className="w-5 h-5 text-purple-600 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>

        <span className="font-mono text-xs text-slate-900 font-bold truncate">
          {dirPath}
        </span>
        <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200 shrink-0">
          内置默认
        </span>
      </div>
    </div>
  );
}

interface SortableItemProps {
  id: string;
  dirPath: string;
  savingConfig: boolean;
  onRemove: (path: string) => void;
}

function SortableSourceDirItem({
  id,
  dirPath,
  savingConfig,
  onRemove,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: savingConfig,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-panel-interactive rounded-2xl p-4 flex items-center justify-between gap-4 border transition-all duration-150 ${
        isDragging
          ? "opacity-30 border-purple-300 bg-purple-50/20 scale-[0.98]"
          : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          {...attributes}
          {...listeners}
          className="text-slate-400 hover:text-purple-600 cursor-grab active:cursor-grabbing shrink-0 p-1.5 rounded-lg hover:bg-purple-100/60 transition flex items-center select-none touch-none"
          title="按住此图标拖拽调整顺序"
        >
          <svg
            className="w-4 h-4 text-purple-600 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>

        <span className="font-mono text-xs text-slate-900 font-bold truncate">
          {dirPath}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onRemove(dirPath)}
          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-mono font-bold rounded-xl border border-rose-200/80 transition"
        >
          移除
        </button>
      </div>
    </div>
  );
}

// 目录树节点数据类型定义
interface DirNode {
  id: string;
  name: string;
  relPath: string;
  directSkills: SkillItem[];
  subDirs: DirNode[];
  allSkills: SkillItem[];
}

// 递归分析 sourceDir 下各 Skill 路径，构建分层目录树结构
function buildDirTree(sourceDir: string, skills: SkillItem[]): DirNode {
  const cleanSourceDir = sourceDir.replace(/\/+$/, "");

  const createNode = (path: string, name: string, relPath: string) => ({
    id: path,
    name,
    relPath,
    directSkills: [] as SkillItem[],
    subDirsMap: new Map<string, any>(),
    allSkillsMap: new Map<string, SkillItem>(),
  });

  const rootPath = cleanSourceDir;
  const rootName = rootPath.split("/").pop() || rootPath;
  const rootNode = createNode(rootPath, rootName, "");

  for (const skill of skills) {
    const fullPath = skill.fullPath.replace(/\/+$/, "");
    let rel = "";
    if (fullPath.startsWith(cleanSourceDir)) {
      rel = fullPath.slice(cleanSourceDir.length).replace(/^\/+/, "");
    }

    const parts = rel ? rel.split("/") : [];
    // 剔除末尾 Skill 本身目录名，提取上级文件夹层级
    const folderParts = parts.slice(0, parts.length - 1);

    let currentPath = cleanSourceDir;
    let currentNode = rootNode;
    currentNode.allSkillsMap.set(skill.name, skill);

    let currentRel = "";
    for (const part of folderParts) {
      currentPath = `${currentPath}/${part}`;
      currentRel = currentRel ? `${currentRel}/${part}` : part;

      if (!currentNode.subDirsMap.has(part)) {
        const newNode = createNode(currentPath, part, currentRel);
        currentNode.subDirsMap.set(part, newNode);
      }
      currentNode = currentNode.subDirsMap.get(part);
      currentNode.allSkillsMap.set(skill.name, skill);
    }

    currentNode.directSkills.push(skill);
  }

  const toFinalNode = (rawNode: any): DirNode => {
    let subDirs = Array.from(rawNode.subDirsMap.values()).map(toFinalNode);
    subDirs.sort((a: DirNode, b: DirNode) => a.name.localeCompare(b.name));

    return {
      id: rawNode.id,
      name: rawNode.name,
      relPath: rawNode.relPath,
      directSkills: rawNode.directSkills,
      subDirs,
      allSkills: Array.from(rawNode.allSkillsMap.values()),
    };
  };

  const compressNode = (node: DirNode): DirNode => {
    let current = {
      ...node,
      subDirs: node.subDirs.map(compressNode),
    };

    while (current.directSkills.length === 0 && current.subDirs.length === 1 && current.relPath !== "") {
      const child = current.subDirs[0];
      current = {
        id: child.id,
        name: `${current.name} / ${child.name}`,
        relPath: child.relPath,
        directSkills: child.directSkills,
        subDirs: child.subDirs,
        allSkills: child.allSkills,
      };
    }
    return current;
  };

  return compressNode(toFinalNode(rootNode));
}

// 递归渲染文件夹目录树与层级 Skill 列表
interface DirTreeNodeViewProps {
  node: DirNode;
  isBatchMode: boolean;
  selectedSkillPaths: Set<string>;
  skillDensity: "normal" | "compact";
  collapsedGroups: Record<string, boolean>;
  onToggleCollapse: (nodeId: string, defaultCollapsed?: boolean) => void;
  renderSkillCard: (skill: SkillItem) => React.ReactNode;
  onToggleFolderSelection: (folderSkills: SkillItem[]) => void;
}

function DirTreeNodeView({
  node,
  isBatchMode,
  selectedSkillPaths,
  skillDensity,
  collapsedGroups,
  onToggleCollapse,
  renderSkillCard,
  onToggleFolderSelection,
}: DirTreeNodeViewProps) {
  const isSubFolder = node.relPath !== "";
  // 子文件夹默认展开 (defaultCollapsed = false)，除非 collapsedGroups[node.id] === true
  const isCollapsed = isSubFolder ? (collapsedGroups[node.id] ?? false) : false;

  const allSelected = node.allSkills.length > 0 && node.allSkills.every((s) => selectedSkillPaths.has(s.fullPath));
  const someSelected = !allSelected && node.allSkills.some((s) => selectedSkillPaths.has(s.fullPath));

  return (
    <div className="space-y-1.5">
      {/* 子文件夹 Header 栏 */}
      {isSubFolder && (
        <div
          onClick={() => onToggleCollapse(node.id, false)}
          className={`flex items-center justify-between gap-3 py-2 px-3.5 rounded-xl border border-slate-200/90 hover:border-purple-400 bg-white/95 hover:bg-purple-50/60 shadow-2xs transition select-none group cursor-pointer ${
            isBatchMode && (allSelected || someSelected) ? "border-purple-400 bg-purple-50/30" : ""
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
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

            <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>

            <span className="font-mono text-xs font-bold text-slate-900 truncate" title={node.id}>
              {node.name}
            </span>

            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100/90 text-purple-800 border border-purple-200 shrink-0">
              {node.allSkills.length} 个 Skill
            </span>
          </div>

          {/* 仅在批量操作激活模式下显示目录勾选框 */}
          {isBatchMode && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleFolderSelection(node.allSkills);
              }}
              className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-purple-100/80 transition"
              title="按目录全选 / 反选该文件夹下的所有 Skill"
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={() => onToggleFolderSelection(node.allSkills)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <span className="text-[11px] font-mono font-bold text-purple-900 select-none">
                全选目录
              </span>
            </div>
          )}
        </div>
      )}

      {/* 子文件夹内容（展开时显示，左侧包含连贯明显的紫灰色层级竖向线） */}
      {(!isSubFolder || !isCollapsed) && (
        <div className={isSubFolder ? "space-y-1.5 pl-4 border-l-2 border-purple-300/80 ml-3.5 my-1" : "space-y-1.5"}>
          {/* 子文件夹列表 */}
          {node.subDirs.map((child) => (
            <DirTreeNodeView
              key={child.id}
              node={child}
              isBatchMode={isBatchMode}
              selectedSkillPaths={selectedSkillPaths}
              skillDensity={skillDensity}
              collapsedGroups={collapsedGroups}
              onToggleCollapse={onToggleCollapse}
              renderSkillCard={renderSkillCard}
              onToggleFolderSelection={onToggleFolderSelection}
            />
          ))}

          {/* 直属该文件夹层级的 Skill 列表 */}
          {node.directSkills.length > 0 && (
            <div
              className={
                skillDensity === "compact"
                  ? "space-y-2 pt-1"
                  : "grid grid-cols-1 md:grid-cols-2 gap-4 pt-1"
              }
            >
              {node.directSkills.map((s) => renderSkillCard(s))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

  // 批量操作管理模式状态 (Batch Mode)
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<Set<string>>(new Set());

  const toggleSkillSelection = (fullPath: string) => {
    setSelectedSkillPaths((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.add(fullPath);
      }
      return next;
    });
  };

  const toggleFolderSelection = (folderSkills: SkillItem[]) => {
    const allSelected = folderSkills.length > 0 && folderSkills.every((s) => selectedSkillPaths.has(s.fullPath));
    setSelectedSkillPaths((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        folderSkills.forEach((s) => next.delete(s.fullPath));
      } else {
        folderSkills.forEach((s) => next.add(s.fullPath));
      }
      return next;
    });
  };

  const handleSelectAllSkills = () => {
    const next = new Set<string>();
    filteredSkills.forEach((s) => next.add(s.fullPath));
    setSelectedSkillPaths(next);
  };

  const handleInvertSelection = () => {
    const next = new Set<string>();
    filteredSkills.forEach((s) => {
      if (!selectedSkillPaths.has(s.fullPath)) {
        next.add(s.fullPath);
      }
    });
    setSelectedSkillPaths(next);
  };

  const handleBatchActionForSelection = (mode: "mount" | "unmount") => {
    const selectedSkills = skills.filter((s) => selectedSkillPaths.has(s.fullPath));
    if (selectedSkills.length === 0) return;
    openBatchMountModal(`已选中 ${selectedSkills.length} 个 Skill`, selectedSkills, mode);
  };

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

  // Custom Agent Creation Modal State
  const [customAgentModal, setCustomAgentModal] = useState<{
    isOpen: boolean;
    name: string;
    key: string;
    globalPath: string;
    description: string;
  }>({
    isOpen: false,
    name: "",
    key: "",
    globalPath: "",
    description: "",
  });

  // Dynamically derive activeSkillModal from skills array so state is always 100% fresh
  const activeSkillModal = skills.find((s) => s.name === activeSkillModalName) || null;

  const handleAddCustomAgent = async () => {
    if (!customAgentModal.name.trim()) return;
    const agentKey =
      customAgentModal.key.trim() ||
      customAgentModal.name
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-");
    const relPath = customAgentModal.globalPath.trim().replace(/^~\//, "");

    try {
      const data = await apiUpdateAgent({
        action: "addCustom",
        customAgent: {
          name: customAgentModal.name.trim(),
          key: agentKey,
          globalPaths: relPath ? [relPath] : [`.${agentKey}/skills`],
          projectPath: relPath ? `${relPath}/` : `.${agentKey}/skills/`,
          icon: agentKey,
          description: customAgentModal.description.trim() || "自定义 Agent 引擎",
          isCustom: true,
        },
      });
      if (data.success) {
        setCustomAgentModal((prev) => ({
          ...prev,
          isOpen: false,
          name: "",
          key: "",
          globalPath: "",
          description: "",
        }));
        await Promise.all([fetchAgents(), fetchSkills()]);
      }
    } catch (e) {
      console.error("Add custom agent error:", e);
    }
  };

  const handleDeleteCustomAgent = async (agentKey: string, agentName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "确认删除自定义 Agent 引擎？",
      message: `是否确定删除自定义 Agent【${agentName}】？相关已生成的 Symlink 软链接将被安全自动解绑。`,
      confirmText: "确认删除",
      cancelText: "取消",
      onConfirm: async () => {
        try {
          const data = await apiUpdateAgent({
            action: "deleteCustom",
            agentKey,
          });
          if (data.success) {
            await Promise.all([fetchAgents(), fetchSkills()]);
          }
        } catch (e) {
          console.error("Delete custom agent error:", e);
        }
      },
    });
  };

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
            tasks.push(apiToggleSymlink(s.name, agentKey, enable));
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
        manageableSkills.map((s) => apiToggleSymlink(s.name, agentKey, enable))
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
            tasks.push(apiToggleSymlink(s.name, agent.key, enable));
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
      const data = await apiGetSkills(true);
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
      const data = await apiGetAgents();
      if (data.agents) setAgentsList(data.agents);
    } catch (e) {
      console.error("Fetch agents error:", e);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await apiGetConfig();
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
      const data = await apiUpdateAgent({ agentKey, enabled });
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
      const data = await apiToggleSymlink(skillName, agentKey, enable);
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


  const handleSelectFolder = async () => {
    setSelectingFolder(true);
    try {
      const data = await apiSelectFolder();
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
      const data = await apiSaveConfig(nextDirs);
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

  const [activeDndId, setActiveDndId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleRemoveSourceDir = async (dirToRemove: string) => {
    if (dirToRemove.endsWith(".skills-library") || dirToRemove.includes("/.skills-library")) return;
    const nextDirs = sourceDirs.filter((d) => d !== dirToRemove);
    setSavingConfig(true);
    try {
      const data = await apiSaveConfig(nextDirs);
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

  const copyToClipboard = (pathStr: string) => {
    navigator.clipboard.writeText(pathStr);
    setCopiedPath(pathStr);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const toggleGroupCollapse = (pathKey: string, defaultCollapsed: boolean = true) => {
    setCollapsedGroups((prev) => {
      const isCurrentlyCollapsed = prev[pathKey] !== undefined ? prev[pathKey] : defaultCollapsed;
      return {
        ...prev,
        [pathKey]: !isCurrentlyCollapsed,
      };
    });
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
  const mainSkillsOnly = skills.filter((s) => {
    const sDir = s.sourceDir.replace(/\/$/, "");
    return sourceDirs.some((dir) => {
      const d = dir.replace(/\/$/, "");
      return sDir === d || sDir.startsWith(d + "/");
    });
  });

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
    const isSelected = selectedSkillPaths.has(s.fullPath);

    if (skillDensity === "compact") {
      return (
        <div
          key={s.fullPath}
          onClick={() => {
            if (isBatchMode) {
              toggleSkillSelection(s.fullPath);
            }
          }}
          className={`glass-panel-interactive rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition-all duration-150 group shadow-2xs ${
            isBatchMode ? "cursor-pointer" : ""
          } ${
            isBatchMode && isSelected
              ? "border-purple-500 bg-purple-50/50 ring-2 ring-purple-400/80 shadow-xs"
              : "border-slate-200/80 hover:border-purple-300"
          }`}
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

          <div className="flex items-center gap-2.5 shrink-0 font-mono text-xs">
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
              disabled={isBatchMode}
              onClick={(e) => {
                if (isBatchMode) {
                  e.stopPropagation();
                  return;
                }
                setActiveSkillModalName(s.name);
              }}
              title={isBatchMode ? "批量管理模式下，请直接勾选卡片在底部工具栏统一配置" : ""}
              className={`px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition whitespace-nowrap ${
                isBatchMode ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
              }`}
            >
              配置 ({s.linkedAgents.length})
            </button>

            {isBatchMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSkillSelection(s.fullPath);
                }}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0 ml-1"
              />
            )}
          </div>
        </div>
      );
    }

    // Normal mode card
    return (
      <div
        key={s.fullPath}
        onClick={() => {
          if (isBatchMode) {
            toggleSkillSelection(s.fullPath);
          }
        }}
        className={`glass-panel-interactive rounded-2xl p-5 flex flex-col justify-between space-y-4 group border transition-all duration-150 ${
          isBatchMode ? "cursor-pointer" : ""
        } ${
          isBatchMode && isSelected
            ? "border-purple-500 bg-purple-50/50 ring-2 ring-purple-400/80 shadow-md"
            : "border-slate-200/80"
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 glow-emerald shrink-0" />
              <h3 className="font-mono font-bold text-base text-slate-950 group-hover:text-purple-700 transition truncate" title={s.name}>
                {s.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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

              {isBatchMode && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSkillSelection(s.fullPath);
                  }}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0 ml-1"
                />
              )}
            </div>
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
                onClick={(e) => {
                  if (isBatchMode) e.stopPropagation();
                  copyToClipboard(s.fullPath);
                }}
                className="shrink-0 text-[10px] font-mono font-bold text-purple-700 hover:text-white px-2 py-0.5 bg-white hover:bg-purple-600 border border-purple-200 rounded transition shadow-sm"
              >
                {copiedPath === s.fullPath ? "✓ 已复制" : "复制"}
              </button>
            </div>
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-end font-mono text-xs">
          <button
            disabled={isBatchMode}
            onClick={(e) => {
              if (isBatchMode) {
                e.stopPropagation();
                return;
              }
              setActiveSkillModalName(s.name);
            }}
            title={isBatchMode ? "批量管理模式下，请直接勾选卡片在底部工具栏统一配置" : ""}
            className={`px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 ${
              isBatchMode ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
            }`}
          >
            <span>配置 Agent 软链接 ({s.linkedAgents.length})</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-900 font-sans selection:bg-purple-500 selection:text-white bg-slate-100/80">
      {/* 左侧 macOS 原生风格 Sidebar */}
      <aside
        className="w-64 h-full bg-slate-50/90 backdrop-blur-2xl border-r border-slate-200/80 flex flex-col justify-between shrink-0 p-3.5 z-20 select-none"
      >
        <div className="space-y-6">
          {/* 顶端为 macOS 标题栏红绿灯预留 Padding & 可拖拽 */}
          <div
            data-tauri-drag-region
            onMouseDown={async (e) => {
              const target = e.target as HTMLElement;
              if (target.tagName === "BUTTON" || target.closest("button") || target.tagName === "INPUT") {
                return;
              }
              try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                await getCurrentWindow().startDragging();
              } catch (err) {
                console.error("startDragging error:", err);
              }
            }}
            className="pt-10 pb-1 px-1 flex items-center gap-3.5 cursor-default"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <img
              src="/logo.png"
              alt="SKILLS Logo"
              className="w-10 h-10 rounded-2xl object-cover shadow-md shadow-purple-900/10 border border-slate-200/90 shrink-0"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            />
            <div
              className="space-y-1 min-w-0"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <h1 className="font-mono text-base font-black tracking-tight text-slate-900 leading-none truncate">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900">
                  SKILLS MANAGER
                </span>
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-100/80 border border-purple-200 px-1.5 py-0.2 rounded-md leading-tight">
                  v0.2.0
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-medium">
                  Desktop
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="px-2.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                MAIN MENU
              </span>
              {isBatchMode ? (
                <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                  🔒 已锁定
                </span>
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-purple-600 shadow-[0_0_6px_rgba(147,51,234,0.6)]" />
              )}
            </div>

            <nav className="space-y-1">
              {MENU.map((m) => {
                const active = page === m.id;
                return (
                  <button
                    key={m.id}
                    disabled={isBatchMode}
                    onClick={() => {
                      if (!isBatchMode) setPage(m.id);
                    }}
                    title={isBatchMode ? "批量管理模式运行中，请先退出批量模式" : ""}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl font-mono text-xs transition-all duration-150 flex items-center justify-between ${
                      isBatchMode
                        ? active
                          ? "bg-purple-600/70 text-white font-bold opacity-60 cursor-not-allowed"
                          : "text-slate-400 opacity-40 cursor-not-allowed"
                        : active
                          ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-500/20"
                          : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          active ? "bg-white" : "bg-slate-300"
                        }`}
                      />
                      <span className="text-xs font-sans">{m.label}</span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-normal opacity-70 ${
                        active ? "text-purple-100" : "text-slate-400"
                      }`}
                    >
                      {m.code.replace("// ", "")}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar 底部状态与环境说明 */}
        <div className="p-3 bg-white/60 rounded-xl border border-slate-200/60 text-[10px] font-mono text-slate-500 space-y-1.5 shadow-2xs">
          <div className="flex justify-between items-center">
            <span>引擎架构:</span>
            <span className="text-purple-700 font-bold px-1.5 py-0.5 rounded bg-purple-50 border border-purple-100 font-mono">
              Tauri 2.0 Rust Native
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>已激活 Agent:</span>
            <span className="text-purple-700 font-bold px-1.5 py-0.5 rounded bg-purple-50 border border-purple-100">
              {enabledAgents.length} / {agentsList.length}
            </span>
          </div>
        </div>
      </aside>

      {/* 右侧 Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-100/60">
        {/* 原生 macOS 窗口 Toolbar / Header */}
        <header
          data-tauri-drag-region
          onMouseDown={async (e) => {
            const target = e.target as HTMLElement;
            // 如果点到的是按钮/输入框或交互组件，不触发拖拽
            if (target.tagName === "BUTTON" || target.closest("button") || target.tagName === "INPUT") {
              return;
            }
            try {
              const { getCurrentWindow } = await import("@tauri-apps/api/window");
              await getCurrentWindow().startDragging();
            } catch (err) {
              console.error("startDragging error:", err);
            }
          }}
          className="h-12 px-6 flex items-center justify-end shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-md z-10 select-none cursor-default"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >

          {/* 指标 Status Badges 组 */}
          <div
            className="flex items-center gap-2 font-mono text-xs"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200/60 text-slate-700 text-[11px] font-semibold border border-slate-300/40">
              <span className="text-slate-400">Skill 库:</span>
              <span className="text-purple-700 font-extrabold">{skills.length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200/60 text-slate-700 text-[11px] font-semibold border border-slate-300/40">
              <span className="text-slate-400">Agent:</span>
              <span className="text-emerald-700 font-extrabold">{enabledAgents.length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200/60 text-slate-700 text-[11px] font-semibold border border-slate-300/40">
              <span className="text-slate-400">源目录:</span>
              <span className="text-indigo-700 font-extrabold">{sourceDirs.length}</span>
            </div>
          </div>
        </header>

        {/* 内容画布区域 */}
        <main className={`flex-1 overflow-y-auto p-6 lg:p-8 transition-all duration-200 ${isBatchMode ? "pb-32 lg:pb-36" : ""}`}>
          {page === "installed" && (
            <div className="w-full max-w-7xl mx-auto space-y-6">
              {/* 工具栏 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  {/* 维度 1: 布局视图切换选择器 */}
                  <div className={`flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 font-mono text-xs ${isBatchMode ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
                    <button
                      disabled={isBatchMode}
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
                      disabled={isBatchMode}
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

                  {/* 维度 2: 紧凑布局切换选择器 */}
                  <div className={`flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 font-mono text-xs ${isBatchMode ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
                    <button
                      disabled={isBatchMode}
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
                      disabled={isBatchMode}
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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchSkills()}
                      disabled={loadingSkills || isBatchMode}
                      className="px-4 py-2 glass-btn-secondary text-slate-800 text-xs font-mono font-semibold rounded-xl flex items-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg className={`w-3.5 h-3.5 ${loadingSkills ? "animate-spin text-purple-600" : "text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{loadingSkills ? "扫描中..." : "重新扫描"}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (isBatchMode) {
                          setIsBatchMode(false);
                          setSelectedSkillPaths(new Set());
                        } else {
                          setIsBatchMode(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 shadow-xs ${
                        isBatchMode
                          ? "bg-purple-700 text-white shadow-purple-200 ring-2 ring-purple-300"
                          : "bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span>{isBatchMode ? "退出批量" : "批量操作"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 搜索过滤栏 */}
              <div className="relative">
                <input
                  type="text"
                  disabled={isBatchMode}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBatchMode ? "批量管理模式运行中（搜索功能暂时锁定）..." : "搜索 Skill 名称、源仓储路径或说明描述..."}
                  className="w-full glass-input rounded-xl px-4 py-3 pl-11 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {/* 可折叠的 Header 栏 (高度与样式与子目录结构统一) */}
                        <div
                          onClick={() => toggleGroupCollapse(sourcePath)}
                          className={`flex items-center justify-between gap-3 py-2 px-3.5 rounded-xl border border-purple-200/90 hover:border-purple-400 bg-white/95 hover:bg-purple-50/60 shadow-2xs transition select-none group cursor-pointer ${
                            isBatchMode && groupSkills.length > 0 && groupSkills.every((s) => selectedSkillPaths.has(s.fullPath))
                              ? "border-purple-500 bg-purple-50/40"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* 旋转 Chevron 箭头 */}
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

                            <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>

                            <span className="font-mono text-xs font-bold text-slate-900 truncate" title={sourcePath}>
                              {sourcePath}
                            </span>

                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                              {groupSkills.length} 个 Skill
                            </span>
                          </div>

                          {/* 仅在批量操作模式下显示全选仓储 Checkbox */}
                          {isBatchMode && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderSelection(groupSkills);
                              }}
                              className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-purple-100/80 transition"
                              title="按仓储全选 / 反选该仓储下的所有 Skill"
                            >
                              <input
                                type="checkbox"
                                checked={groupSkills.length > 0 && groupSkills.every((s) => selectedSkillPaths.has(s.fullPath))}
                                ref={(el) => {
                                  if (el) {
                                    const allSel = groupSkills.length > 0 && groupSkills.every((s) => selectedSkillPaths.has(s.fullPath));
                                    const someSel = !allSel && groupSkills.some((s) => selectedSkillPaths.has(s.fullPath));
                                    el.indeterminate = someSel;
                                  }
                                }}
                                onChange={() => toggleFolderSelection(groupSkills)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                              <span className="text-[11px] font-mono font-bold text-purple-900 select-none">
                                全选仓储
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 该分组下的层级目录树与 Skill Cards (未折叠时显示) */}
                        {!isCollapsed && (
                          <div className="border-l-2 border-purple-300/80 ml-3.5 pl-4 my-1.5 space-y-1.5">
                            {(() => {
                              const treeRoot = buildDirTree(sourcePath, groupSkills);
                              return (
                                <DirTreeNodeView
                                  node={treeRoot}
                                  isBatchMode={isBatchMode}
                                  selectedSkillPaths={selectedSkillPaths}
                                  skillDensity={skillDensity}
                                  collapsedGroups={collapsedGroups}
                                  onToggleCollapse={toggleGroupCollapse}
                                  renderSkillCard={(s) => renderSkillCard(s)}
                                  onToggleFolderSelection={toggleFolderSelection}
                                />
                              );
                            })()}
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
            <div className="w-full max-w-7xl mx-auto space-y-6">
              {/* 工具栏 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">

                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setCustomAgentModal({
                        isOpen: true,
                        name: "",
                        key: "",
                        globalPath: "",
                        description: "",
                      })
                    }
                    className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-mono font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <span>+ 添加自定义 Agent</span>
                  </button>

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
                          <div className="flex items-center gap-3 min-w-0">
                            <AgentIcon agentKey={agent.key} name={agent.name} className="w-8 h-8 shrink-0" />
                            <div className="min-w-0">
                              <h3 className="font-mono font-bold text-base text-slate-950 flex items-center gap-2 truncate">
                                <span className="truncate">{agent.name}</span>
                                {agent.isCustom && (
                                  <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 shrink-0">
                                    自定义
                                  </span>
                                )}
                              </h3>
                              <span className="text-[10px] font-mono text-slate-500">
                                ID: {agent.key}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {agent.isCustom && (
                              <button
                                onClick={() => handleDeleteCustomAgent(agent.key, agent.name)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-mono font-bold rounded-xl border border-rose-200 transition"
                                title="删除自定义 Agent"
                              >
                                删除
                              </button>
                            )}

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
            <div className="w-full max-w-7xl mx-auto space-y-6">

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
                  const defaultDirs = sourceDirs.filter((d) => isDefault(d));
                  const customDirs = sourceDirs.filter((d) => !isDefault(d));

                  const handleDndDragStart = (event: DragStartEvent) => {
                    setActiveDndId(event.active.id as string);
                  };

                  const handleDndDragEnd = (event: DragEndEvent) => {
                    const { active, over } = event;
                    setActiveDndId(null);
                    if (!over || active.id === over.id) return;

                    const oldIndex = customDirs.indexOf(active.id as string);
                    const newIndex = customDirs.indexOf(over.id as string);

                    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                      const reorderedCustom = arrayMove(customDirs, oldIndex, newIndex);
                      const nextDirs = [...defaultDirs, ...reorderedCustom];

                      // 乐观 UI 更新
                      setSourceDirs(nextDirs);

                      setSavingConfig(true);
                      apiSaveConfig(nextDirs)
                        .then((data) => {
                          if (data.sourceDirs) {
                            setSourceDirs(data.sourceDirs);
                            fetchSkills();
                          }
                        })
                        .catch((e) => {
                          console.error("Dnd save config error:", e);
                        })
                        .finally(() => {
                          setSavingConfig(false);
                        });
                    }
                  };

                  return (
                    <div className="space-y-3">
                      {/* 1. 固定的内置默认仓储（置顶且固定第一，不可拖拽与不可移除） */}
                      {defaultDirs.map((dirPath) => (
                        <DefaultSourceDirItem
                          key={dirPath}
                          dirPath={dirPath}
                        />
                      ))}

                      {/* 2. 用户自定义仓储目录列表（可在下方自由平滑拖拽排序） */}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDndDragStart}
                        onDragEnd={handleDndDragEnd}
                        onDragCancel={() => setActiveDndId(null)}
                      >
                        <SortableContext items={customDirs} strategy={verticalListSortingStrategy}>
                          <div className="space-y-3">
                            {customDirs.map((dirPath) => (
                              <SortableSourceDirItem
                                key={dirPath}
                                id={dirPath}
                                dirPath={dirPath}
                                savingConfig={savingConfig}
                                onRemove={(dirToRemove) => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: "确认移除源仓储目录？",
                                    message: `是否确定从配置中移除源仓储目录【${dirToRemove}】？移除后该目录下的 Skill 将不再出现在技能库中（不会删除磁盘本地文件）。`,
                                    confirmText: "确认移除",
                                    cancelText: "取消",
                                    onConfirm: () => handleRemoveSourceDir(dirToRemove),
                                  });
                                }}
                              />
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay dropAnimation={null}>
                          {activeDndId ? <SourceDirOverlayCard dirPath={activeDndId} /> : null}
                        </DragOverlay>
                      </DndContext>
                    </div>
                  );
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

                  // Agent 自身原生 global skills 路径集合（服务端已解析为绝对路径）
                  const agentNativePaths = new Set<string>(activeAgentDrawer.resolvedGlobalPaths || []);
                  const isAgentNativePath = (p: string) => agentNativePaths.has(p);
                  const isDefaultPath = (p: string) => p.endsWith(".skills-library") || p.includes("/.skills-library");

                  const drawerGroupedEntries = Array.from(drawerGroupedMap.entries()).sort(([pathA], [pathB]) => {
                    // Agent 原生路径置顶
                    const isNativeA = isAgentNativePath(pathA);
                    const isNativeB = isAgentNativePath(pathB);
                    if (isNativeA && !isNativeB) return -1;
                    if (!isNativeA && isNativeB) return 1;
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
                        const isNativeGroup = isAgentNativePath(sourcePath);

                        return (
                          <div key={sourcePath} className="space-y-2.5">
                            {/* 手风琴 Header (高度与样式与子目录结构统一) */}
                            <div
                              onClick={() => toggleDrawerGroupCollapse(sourcePath)}
                              className={`py-2 px-3.5 rounded-xl flex items-center justify-between gap-3 border shadow-2xs cursor-pointer transition select-none group ${
                                isNativeGroup
                                  ? "bg-indigo-50/80 border-indigo-200 hover:border-indigo-400"
                                  : "bg-white/95 border-purple-200/90 hover:border-purple-400"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {isNativeGroup ? (
                                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                  </svg>
                                )}
                                
                                <svg
                                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                    isCollapsed ? "-rotate-90 text-slate-400" : `rotate-0 ${isNativeGroup ? "text-indigo-600" : "text-purple-600"}`
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>

                                <span className={`font-mono text-xs font-bold truncate ${isNativeGroup ? "text-indigo-900" : "text-slate-900"}`} title={sourcePath}>
                                  {sourcePath}
                                </span>

                                {isNativeGroup ? (
                                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                                    {groupSkills.length} 个 · Agent 自有技能
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                    {groupSkills.length} 个 Skill
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {!isNativeGroup && (
                                  <>
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
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 组内层级目录树 (未折叠时显示) */}
                            {!isCollapsed && (
                              <div className="border-l-2 border-purple-300/80 ml-3.5 pl-4 my-1.5 space-y-1.5">
                                {(() => {
                                  const treeRoot = buildDirTree(sourcePath, groupSkills);
                                  return (
                                    <DirTreeNodeView
                                      node={treeRoot}
                                      isBatchMode={isBatchMode}
                                      selectedSkillPaths={selectedSkillPaths}
                                      skillDensity="compact"
                                      collapsedGroups={collapsedGroups}
                                      onToggleCollapse={toggleGroupCollapse}
                                      renderSkillCard={(skill) => {
                                        const isSymlinked = skill.symlinkedAgents?.includes(activeAgentDrawer.key);
                                        const isNative = skill.nativeAgents?.includes(activeAgentDrawer.key);
                                        const isLinked = isSymlinked || isNative;
                                        const toggleId = `${skill.name}-${activeAgentDrawer.key}`;
                                        const isBusy = togglingSymlink === toggleId;

                                        return (
                                          <div
                                            key={skill.name}
                                            className={`rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition select-none shadow-2xs ${
                                              isLinked
                                                ? isNative
                                                  ? "bg-indigo-50/90 border-indigo-200 text-indigo-950 font-bold"
                                                  : "bg-purple-50/90 border-purple-300 text-purple-900 font-bold"
                                                : "bg-white/95 border-slate-200/90 text-slate-700 hover:bg-purple-50/40 hover:border-purple-300"
                                            }`}
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                              <span
                                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                                  isNative
                                                    ? "bg-indigo-500"
                                                    : isSymlinked
                                                      ? "bg-emerald-500 glow-emerald"
                                                      : "bg-slate-300"
                                                }`}
                                              />
                                              <h3 className="font-mono font-bold text-xs text-slate-950 truncate shrink-0 max-w-[200px]" title={skill.name}>
                                                {skill.name}
                                              </h3>

                                              {isNative && (
                                                <span className="text-[10px] font-mono text-indigo-800 font-bold px-2 py-0.5 bg-indigo-100/90 rounded-md border border-indigo-200 shrink-0">
                                                  原生
                                                </span>
                                              )}

                                              {isSymlinked && (
                                                <span className="text-[10px] font-mono text-emerald-800 font-bold px-2 py-0.5 bg-emerald-100/90 rounded-md border border-emerald-200 shrink-0">
                                                  ✓ 已挂载
                                                </span>
                                              )}

                                              {skill.description && (
                                                <span className="text-[11px] text-slate-500 font-sans truncate flex-1" title={skill.description}>
                                                  {skill.description}
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                                              {isNative ? (
                                                <span className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold text-indigo-700 bg-indigo-100/80 border border-indigo-200 select-none shrink-0">
                                                  Agent 原生实体
                                                </span>
                                              ) : (
                                                <button
                                                  disabled={isBusy}
                                                  onClick={() => toggleSymlink(skill.name, activeAgentDrawer.key, !isSymlinked)}
                                                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition shrink-0 ${
                                                    isSymlinked
                                                      ? "bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200"
                                                      : "bg-purple-600 hover:bg-purple-700 text-white shadow-2xs"
                                                  }`}
                                                >
                                                  {isBusy ? "更新中..." : isSymlinked ? "移除软链接" : "+ 挂载软链接"}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }}
                                      onToggleFolderSelection={toggleFolderSelection}
                                    />
                                  );
                                })()}
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

      {customAgentModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-purple-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-mono font-bold text-base text-slate-950 flex items-center gap-2">
                  <span>添加自定义 Agent 引擎</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  手动添加非内置支持的自定义智能体 CLI 或 IDE 专属 Skill 目录
                </p>
              </div>
              <button
                onClick={() => setCustomAgentModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Agent 名称 *</label>
                <input
                  type="text"
                  placeholder="例如: Custom AI Agent"
                  value={customAgentModal.name}
                  onChange={(e) =>
                    setCustomAgentModal((prev) => ({
                      ...prev,
                      name: e.target.value,
                      key: prev.key || e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-purple-600 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Agent 标识 Key *</label>
                <input
                  type="text"
                  placeholder="例如: custom-agent"
                  value={customAgentModal.key}
                  onChange={(e) => setCustomAgentModal((prev) => ({ ...prev, key: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-purple-600 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Global Skill 软链接相对路径 (相对于用户主目录 ~)</label>
                <input
                  type="text"
                  placeholder="例如: .custom-agent/skills"
                  value={customAgentModal.globalPath}
                  onChange={(e) => setCustomAgentModal((prev) => ({ ...prev, globalPath: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-purple-600 bg-white"
                />
                <p className="text-[10px] text-slate-400">
                  如留空，默认将使用 `.~/{customAgentModal.key || "agent-key"}/skills`
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">描述说明 (可选)</label>
                <input
                  type="text"
                  placeholder="例如: 自定义 AI Agent 引擎"
                  value={customAgentModal.description}
                  onChange={(e) => setCustomAgentModal((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-purple-600 bg-white"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <AgentIcon
                  agentKey={customAgentModal.key || "custom"}
                  name={customAgentModal.name || "Custom"}
                  className="w-7 h-7 shrink-0"
                />
                <span className="text-slate-500 font-bold">
                  Logo 预检: 首字母【{(customAgentModal.name || customAgentModal.key || "C").trim().charAt(0).toUpperCase()}】
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCustomAgentModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
                >
                  取消
                </button>
                <button
                  disabled={!customAgentModal.name.trim()}
                  onClick={handleAddCustomAgent}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition"
                >
                  确认添加 Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 底部悬浮批量操作管理工具栏 (完美居中于主视图 + 单行不换行) */}
      {isBatchMode && (
        <div className="fixed bottom-6 left-[calc(50%+8rem)] -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="glass-panel px-6 py-3.5 rounded-2xl shadow-2xl border border-purple-300 bg-white/95 backdrop-blur-xl flex items-center gap-5 whitespace-nowrap">
            <div className="flex items-center gap-2 pr-4 border-r border-slate-200 font-mono text-xs whitespace-nowrap shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse shrink-0" />
              <span className="font-bold text-slate-800 whitespace-nowrap">
                已选择 <span className="text-purple-700 font-extrabold text-sm">{selectedSkillPaths.size}</span> / {filteredSkills.length} 个 Skill
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs whitespace-nowrap shrink-0">
              <button
                onClick={handleSelectAllSkills}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition whitespace-nowrap shrink-0"
              >
                全选
              </button>
              <button
                onClick={handleInvertSelection}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition whitespace-nowrap shrink-0"
              >
                反选
              </button>
              <button
                disabled={selectedSkillPaths.size === 0}
                onClick={() => setSelectedSkillPaths(new Set())}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 font-bold rounded-xl transition whitespace-nowrap shrink-0"
              >
                清空
              </button>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

            <div className="flex items-center gap-2 font-mono text-xs whitespace-nowrap shrink-0">
              <button
                disabled={selectedSkillPaths.size === 0}
                onClick={() => handleBatchActionForSelection("mount")}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>+ 批量挂载软链接</span>
              </button>

              <button
                disabled={selectedSkillPaths.size === 0}
                onClick={() => handleBatchActionForSelection("unmount")}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-bold rounded-xl border border-rose-200 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                批量移除软链接
              </button>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

            <button
              onClick={() => {
                setIsBatchMode(false);
                setSelectedSkillPaths(new Set());
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-mono text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
