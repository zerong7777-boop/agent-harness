import type {
  AssetsIndex,
  AccountRecord,
  CreateTaskInput,
  MachineRecord,
  OverviewIndex,
  TabId,
  TaskDetail,
  TaskFilter,
  TaskSummary,
  TopLevelView,
} from "./types";

export type BannerState = { tone: "info" | "success" | "error"; text: string } | null;

export type AppState = {
  currentView: TopLevelView;
  overview: OverviewIndex | null;
  assetsIndex: AssetsIndex | null;
  tasks: TaskSummary[];
  taskDetails: Map<string, TaskDetail>;
  accounts: AccountRecord[];
  machines: MachineRecord[];
  selectedTaskId: string | null;
  selectedTaskTab: TabId;
  taskFilter: TaskFilter;
  showCreateModal: boolean;
  createForm: CreateTaskInput;
  draftMessage: string;
  banner: BannerState;
  expandedAssetCategories: Set<string>;
};

export function createInitialState(): AppState {
  return {
    currentView: "tasks",
    overview: null,
    assetsIndex: null,
    tasks: [],
    taskDetails: new Map(),
    accounts: [],
    machines: [],
    selectedTaskId: null,
    selectedTaskTab: "overview",
    taskFilter: "active",
    showCreateModal: false,
    createForm: {
      title: "",
      summary: "",
      short_name: "",
      priority: "P2",
      account_id: "codex-main",
      machine_id: "",
    },
    draftMessage: "",
    banner: null,
    expandedAssetCategories: new Set(["skills", "guides"]),
  };
}
