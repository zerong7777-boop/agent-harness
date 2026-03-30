import "./styles.css";

type OverviewIndex = {
  generated_at?: string;
};

type TaskSummary = {
  task_id: string;
  title: string;
  stage?: string;
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
  updated_at?: string;
};

type TaskDetail = {
  task?: Record<string, unknown> & { summary?: string };
  plan?: { summary?: string; status?: string };
  phases?: Array<Record<string, unknown> & { phase_kind?: string; status?: string; title?: string; summary?: string }>;
  experiments?: Array<Record<string, unknown> & { title?: string; status?: string; summary?: string }>;
  findings?: Array<Record<string, unknown> & { title?: string; summary?: string }>;
  sessions?: Array<{
    session?: {
      session_id?: string;
      latest_assistant_text?: string;
      latest_assistant_at?: string;
      latest_turn_status?: string;
      status?: string;
      summary?: string;
    };
    event_log?: { summary?: string };
    summary?: { summary?: string };
  }>;
  runtime?: {
    index?: {
      runtime_status?: string;
      runtime_adapter?: string;
      current_mode?: string;
      current_focus?: string;
      primary_session_id?: string;
      last_event_at?: string;
      app_server_probe_status?: string;
      app_server_attach_status?: string;
      app_server_bridge_status?: string;
    };
  };
  memory?: {
    index?: {
      summary?: string;
      current_stage?: string;
      current_phase_kind?: string;
      current_phase_status?: string;
      current_blockers?: string[];
      recommended_next_step?: string;
    };
  };
};

const STAGE_LABELS: Record<string, string> = {
  clarification: "澄清",
  planning: "计划",
  execution: "执行",
  verification: "验证",
  "knowledge-review": "知识审核",
};

const STATUS_LABELS: Record<string, string> = {
  open: "已开启",
  planned: "已计划",
  running: "运行中",
  completed: "已完成",
  waiting: "等待中",
  ready: "就绪",
  attached: "已附加",
  "not-attached": "未附加",
  stopped: "已停止",
  idle: "空闲",
  "waiting-user": "等待你处理",
  error: "异常",
};

type TabId = "overview" | "plan" | "runtime" | "experiment" | "session";

const state: {
  overview: OverviewIndex | null;
  tasks: TaskSummary[];
  taskDetails: Map<string, TaskDetail>;
  selectedTaskId: string | null;
  selectedTab: TabId;
} = {
  overview: null,
  tasks: [],
  taskDetails: new Map(),
  selectedTaskId: null,
  selectedTab: "plan",
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function localizeStage(value?: string): string {
  if (!value) return "-";
  return STAGE_LABELS[value] ?? value;
}

function localizeStatus(value?: string): string {
  if (!value) return "-";
  return STATUS_LABELS[value] ?? value;
}

function runtimeBadge(task: TaskSummary): { label: string; tone: string } {
  const live =
    task.app_server_probe_status === "ready" &&
    task.app_server_attach_status === "attached" &&
    task.app_server_bridge_status === "running";
  if (live) return { label: "LIVE", tone: "live" };
  if ((task.runtime_adapter ?? "").includes("stub")) return { label: "STUB", tone: "stub" };
  return { label: "OFFLINE", tone: "offline" };
}

function currentTask(): TaskSummary | undefined {
  return state.tasks.find((task) => task.task_id === state.selectedTaskId);
}

function currentDetail(): TaskDetail | undefined {
  return state.selectedTaskId ? state.taskDetails.get(state.selectedTaskId) : undefined;
}

async function ensureTaskDetail(taskId: string): Promise<TaskDetail> {
  const cached = state.taskDetails.get(taskId);
  if (cached) return cached;
  const detail = await fetchJson<TaskDetail>(`/indexes/task-details/${taskId}.json`);
  state.taskDetails.set(taskId, detail);
  return detail;
}

async function loadApp(): Promise<void> {
  state.overview = await fetchJson<OverviewIndex>("/indexes/overview.json");
  const taskIndex = await fetchJson<{ tasks: TaskSummary[] }>("/indexes/tasks.json");
  state.tasks = taskIndex.tasks ?? [];
  if (!state.selectedTaskId && state.tasks.length) {
    state.selectedTaskId = state.tasks[0].task_id;
  }
  if (state.selectedTaskId) {
    await ensureTaskDetail(state.selectedTaskId);
  }
}

function renderTaskStrip(): string {
  return state.tasks
    .map((task) => {
      const badge = runtimeBadge(task);
      const active = task.task_id === state.selectedTaskId ? "is-active" : "";
      return `
        <button class="task-chip-card ${active}" data-task-id="${task.task_id}" type="button">
          <span class="task-chip-card-head">
            <strong>${task.title}</strong>
            <span class="badge badge-${badge.tone}">${badge.label}</span>
          </span>
          <span class="task-chip-card-meta">${localizeStage(task.stage)} · ${formatDate(task.updated_at)}</span>
        </button>
      `;
    })
    .join("");
}

function renderOverviewTab(task: TaskSummary, detail?: TaskDetail): string {
  const memory = detail?.memory?.index;
  const latestSession = detail?.sessions?.[0]?.session;
  return `
    <section class="panel-block">
      <h3>当前摘要</h3>
      <p>${memory?.summary ?? task.memory_summary ?? (detail?.task?.summary as string | undefined) ?? "-"}</p>
    </section>
    <section class="info-grid">
      <article class="mini-panel">
        <span class="label">主阶段</span>
        <strong>${localizeStage(memory?.current_stage ?? task.stage)}</strong>
      </article>
      <article class="mini-panel">
        <span class="label">当前 phase</span>
        <strong>${localizeStage(memory?.current_phase_kind ?? task.active_phase_kind)} / ${localizeStatus(memory?.current_phase_status ?? task.active_phase_status)}</strong>
      </article>
      <article class="mini-panel">
        <span class="label">下一步</span>
        <strong>${memory?.recommended_next_step ?? task.recommended_next_step ?? "-"}</strong>
      </article>
      <article class="mini-panel">
        <span class="label">最新回复</span>
        <strong>${latestSession?.latest_assistant_text ? "已有" : "暂无"}</strong>
      </article>
    </section>
  `;
}

function renderPlanTab(detail?: TaskDetail): string {
  const phases = detail?.phases ?? [];
  return `
    <section class="panel-block">
      <h3>计划摘要</h3>
      <p>${detail?.plan?.summary ?? "-"}</p>
    </section>
    <section class="panel-block">
      <h3>阶段</h3>
      <div class="list-stack">
        ${phases.length
          ? phases
              .map(
                (phase) => `
                  <article class="list-card">
                    <strong>${phase.title ?? "-"}</strong>
                    <span>${localizeStage(phase.phase_kind)} / ${localizeStatus(phase.status)}</span>
                    <p>${phase.summary ?? "-"}</p>
                  </article>
                `,
              )
              .join("")
          : '<p class="empty-line">还没有阶段记录。</p>'}
      </div>
    </section>
  `;
}

function renderRuntimeTab(task: TaskSummary, detail?: TaskDetail): string {
  const runtime = detail?.runtime?.index;
  const latestSession = detail?.sessions?.[0]?.session;
  return `
    <section class="info-grid">
      <article class="mini-panel">
        <span class="label">运行时状态</span>
        <strong>${localizeStatus(runtime?.runtime_status ?? task.runtime_status)}</strong>
      </article>
      <article class="mini-panel">
        <span class="label">主会话</span>
        <strong>${runtime?.primary_session_id ?? task.primary_session_id ?? "-"}</strong>
      </article>
      <article class="mini-panel">
        <span class="label">探测 / 附加</span>
        <strong>${localizeStatus(runtime?.app_server_probe_status ?? task.app_server_probe_status)} / ${localizeStatus(runtime?.app_server_attach_status ?? task.app_server_attach_status)}</strong>
      </article>
      <article class="mini-panel">
        <span class="label">Bridge</span>
        <strong>${localizeStatus(runtime?.app_server_bridge_status ?? task.app_server_bridge_status)}</strong>
      </article>
    </section>
    <section class="panel-block">
      <h3>最新回复</h3>
      <div class="reply-card">
        <p>${latestSession?.latest_assistant_text ?? "当前还没有真实 Codex 回复。"}</p>
        <span>${formatDate(latestSession?.latest_assistant_at)} · ${localizeStatus(latestSession?.latest_turn_status)}</span>
      </div>
    </section>
  `;
}

function renderExperimentTab(detail?: TaskDetail): string {
  const experiments = detail?.experiments ?? [];
  const findings = detail?.findings ?? [];
  return `
    <section class="panel-block">
      <h3>实验记录</h3>
      <div class="list-stack">
        ${experiments.length
          ? experiments
              .map(
                (experiment) => `
                  <article class="list-card">
                    <strong>${experiment.title ?? "-"}</strong>
                    <span>${localizeStatus(experiment.status)}</span>
                    <p>${experiment.summary ?? "-"}</p>
                  </article>
                `,
              )
              .join("")
          : '<p class="empty-line">还没有实验记录。</p>'}
      </div>
    </section>
    <section class="panel-block">
      <h3>关键结论</h3>
      <div class="list-stack">
        ${findings.length
          ? findings
              .map(
                (finding) => `
                  <article class="list-card">
                    <strong>${finding.title ?? "-"}</strong>
                    <p>${finding.summary ?? "-"}</p>
                  </article>
                `,
              )
              .join("")
          : '<p class="empty-line">还没有 findings。</p>'}
      </div>
    </section>
  `;
}

function renderSessionTab(detail?: TaskDetail): string {
  const session = detail?.sessions?.[0];
  return `
    <section class="panel-block">
      <h3>会话摘要</h3>
      <p>${session?.summary?.summary ?? session?.session?.summary ?? "还没有会话摘要。"}</p>
    </section>
    <section class="panel-block">
      <h3>事件流摘要</h3>
      <pre class="event-log">${session?.event_log?.summary ?? "还没有事件流。"}</pre>
    </section>
  `;
}

function renderWorkspace(): string {
  const task = currentTask();
  const detail = currentDetail();
  if (!task) {
    return `
      <section class="workspace-empty">
        <h2>还没有选中任务</h2>
        <p>从上方任务条里选择一个任务，工作区会显示它的计划、运行时和会话信息。</p>
      </section>
    `;
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: "概览" },
    { id: "plan", label: "计划" },
    { id: "runtime", label: "运行时" },
    { id: "experiment", label: "实验" },
    { id: "session", label: "会话" },
  ];

  let tabContent = "";
  if (state.selectedTab === "overview") tabContent = renderOverviewTab(task, detail);
  if (state.selectedTab === "plan") tabContent = renderPlanTab(detail);
  if (state.selectedTab === "runtime") tabContent = renderRuntimeTab(task, detail);
  if (state.selectedTab === "experiment") tabContent = renderExperimentTab(detail);
  if (state.selectedTab === "session") tabContent = renderSessionTab(detail);

  return `
    <section class="workspace-hero">
      <div>
        <p class="eyebrow">当前任务</p>
        <h2>${task.title}</h2>
        <p class="summary">${task.memory_summary ?? (detail?.task?.summary as string | undefined) ?? "-"}</p>
      </div>
      <div class="hero-meta">
        <span>${localizeStage(task.stage)}</span>
        <span>${localizeStage(task.active_phase_kind)} / ${localizeStatus(task.active_phase_status)}</span>
        <span>${runtimeBadge(task).label}</span>
      </div>
    </section>
    <section class="workspace-tabs">
      ${tabs
        .map(
          (tab) => `
            <button class="tab-button ${state.selectedTab === tab.id ? "is-active" : ""}" data-tab-id="${tab.id}" type="button">
              ${tab.label}
            </button>
          `,
        )
        .join("")}
    </section>
    <section class="workspace-panel">${tabContent}</section>
  `;
}

function render(): void {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Codex</p>
          <h1>控制台</h1>
          <p class="lede">任务切换、计划查看与运行时执行分层显示，避免旧 GUI 的 DOM 重排问题。</p>
        </div>
        <button id="refreshButton" class="ghost-button" type="button">刷新</button>
      </header>
      <section class="task-strip">${renderTaskStrip()}</section>
      <main class="workspace">${renderWorkspace()}</main>
    </div>
  `;

  app.querySelector<HTMLButtonElement>("#refreshButton")?.addEventListener("click", async () => {
    state.taskDetails.clear();
    await loadApp();
    render();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-task-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedTaskId = button.dataset.taskId ?? null;
      state.selectedTab = "plan";
      if (state.selectedTaskId) {
        await ensureTaskDetail(state.selectedTaskId);
      }
      render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-tab-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTab = (button.dataset.tabId as TabId) ?? "plan";
      render();
    });
  });
}

void loadApp().then(render);
