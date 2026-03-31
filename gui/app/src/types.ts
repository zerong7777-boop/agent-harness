export type TopLevelView = "tasks" | "assets" | "accounts" | "knowledge";

export type TabId = "overview" | "plan" | "runtime" | "experiment" | "session";

export type TaskFilter = "active" | "all" | "archived";

export type AssetCategoryId = "skills" | "guides" | "rules" | "templates" | "knowledge_links";

export type AssetItem = {
  asset_id: string;
  category: AssetCategoryId;
  title: string;
  summary?: string;
  source_path?: string;
  status?: string;
  phase_hints?: string[];
  tags?: string[];
};

export type AssetCategory = {
  id: AssetCategoryId;
  title: string;
  description?: string;
  count: number;
  default_expanded: boolean;
  items: AssetItem[];
};

export type AssetsIndex = {
  generated_at?: string;
  categories: AssetCategory[];
  task_recommendations?: Record<string, AssetItem[]>;
};

export type OverviewIndex = {
  generated_at?: string;
  counts?: {
    tasks?: number;
    active_tasks?: number;
    knowledge_entries?: number;
    accounts?: number;
    machines?: number;
    pending_decisions?: number;
  };
};

export type TaskSummary = {
  task_id: string;
  title: string;
  stage?: string;
  terminal_state?: string;
  priority?: string;
  blocked?: boolean;
  blocker_kinds?: string[];
  machine_ids?: string[];
  memory_summary?: string;
  recommended_next_step?: string;
  active_phase_kind?: string;
  active_phase_status?: string;
  active_phase_title?: string;
  runtime_status?: string;
  runtime_adapter?: string;
  app_server_probe_status?: string;
  app_server_attach_status?: string;
  app_server_bridge_status?: string;
  primary_session_id?: string;
  pending_decision_count?: number;
  experiment_count?: number;
  finding_count?: number;
  updated_at?: string;
};

export type TaskRecord = Record<string, unknown> & {
  title?: string;
  summary?: string;
  stage?: string;
  task_id?: string;
  priority?: string;
  blocked?: boolean;
  blocker_kinds?: string[];
  terminal_state?: string;
};

export type PlanRecord = {
  summary?: string;
  status?: string;
};

export type PhaseRecord = Record<string, unknown> & {
  phase_kind?: string;
  status?: string;
  title?: string;
  summary?: string;
};

export type ExperimentRecord = Record<string, unknown> & {
  title?: string;
  status?: string;
  summary?: string;
};

export type FindingRecord = Record<string, unknown> & {
  title?: string;
  summary?: string;
};

export type SessionSummaryRecord = {
  summary?: string;
  recommended_next_step?: string;
};

export type SessionEvent = {
  timestamp?: string;
  kind?: string;
  scope?: string;
  summary?: string;
};

export type SessionRecord = {
  object_kind?: string;
  session_id?: string;
  status?: string;
  mode?: string;
  current_focus?: string;
  summary?: string;
  latest_assistant_text?: string;
  latest_assistant_at?: string;
  latest_turn_status?: string;
  external_thread_id?: string;
};

export type SessionBundle = {
  session?: SessionRecord;
  event_log?: {
    summary?: string;
    events?: SessionEvent[];
  };
  summary?: SessionSummaryRecord;
  handoff?: {
    summary?: string;
  };
};

export type RuntimeIndex = {
  runtime_status?: string;
  runtime_adapter?: string;
  current_mode?: string;
  current_focus?: string;
  primary_session_id?: string;
  last_event_at?: string;
  last_error_summary?: string;
  app_server_probe_status?: string;
  app_server_attach_status?: string;
  app_server_bridge_status?: string;
  app_server_thread_id?: string;
  app_server_ws_url?: string;
  app_server_port?: number;
};

export type RuntimeStatus = {
  runtime_status?: string;
  session_status?: string;
  waiting_for_user?: boolean;
  last_event_summary?: string;
  last_message_summary?: string;
  last_error_detail?: string;
  allowed_actions?: string[];
  app_server_probe_status?: string;
  app_server_attach_status?: string;
  app_server_bridge_status?: string;
  app_server_thread_id?: string;
  app_server_thread_path?: string;
  app_server_ready?: boolean;
  app_server_healthy?: boolean;
  app_server_port?: number;
  app_server_ws_url?: string;
  app_server_ready_url?: string;
  app_server_health_url?: string;
  app_server_pid?: number;
  app_server_bridge_pid?: number;
  app_server_bridge_last_seen_at?: string;
};

export type RuntimeBundle = {
  index?: RuntimeIndex;
  status?: RuntimeStatus;
  launch?: Record<string, unknown>;
  history?: {
    events?: SessionEvent[];
    summary?: string;
  };
};

export type MemoryIndex = {
  summary?: string;
  current_stage?: string;
  current_phase_kind?: string;
  current_phase_status?: string;
  current_blockers?: string[];
  recommended_next_step?: string;
  pending_decision_count?: number;
  pending_verification_count?: number;
  active_session_ids?: string[];
};

export type MemoryBlock = {
  block_kind?: string;
  summary?: string;
  path?: string;
};

export type MemoryBundle = {
  index?: MemoryIndex;
  blocks?: MemoryBlock[];
};

export type TaskDetail = {
  task?: TaskRecord;
  plan?: PlanRecord;
  phases?: PhaseRecord[];
  experiments?: ExperimentRecord[];
  findings?: FindingRecord[];
  sessions?: SessionBundle[];
  runtime?: RuntimeBundle;
  memory?: MemoryBundle | null;
};

export type AccountRecord = {
  account_id: string;
  title?: string;
  summary?: string;
  is_default?: boolean;
};

export type MachineRecord = {
  machine_id: string;
  title?: string;
  host?: string;
  platform?: string;
  summary?: string;
};

export type AccountsIndex = {
  accounts: AccountRecord[];
};

export type MachinesIndex = {
  machines: MachineRecord[];
};

export type CreateTaskInput = {
  title: string;
  summary: string;
  short_name: string;
  priority: string;
  account_id: string;
  machine_id: string;
};

export type RecommendedAsset = Pick<AssetItem, "asset_id" | "title" | "category" | "summary">;

export type MutationResult = {
  ok?: boolean;
  error?: string;
  task_id?: string;
  primary_session_id?: string;
  thread_id?: string;
  terminal_state?: string;
  next_stage?: string;
};
