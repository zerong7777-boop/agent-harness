import "./styles-v2.css";

import {
  advanceStage,
  attachRuntime,
  createTask,
  loadAssets,
  loadAccounts,
  loadMachines,
  loadOverview,
  loadTaskDetail,
  loadTasks,
  probeRuntime,
  reconnectRuntime,
  sendRuntimeMessage,
  setTerminalState,
  stopAppServer,
} from "./api";
import {
  cleanText,
  formatDate,
  localizeStage,
  localizeStatus,
  runtimeBadge,
  runtimeReady,
  statusHint,
  summarizeList,
} from "./labels-v2";
import { createInitialState, type AppState } from "./state";
import { renderAssetsView } from "./views/assets-view";
import { renderTaskAssetsBlock } from "./views/task-assets";
import { renderTasksView } from "./views/tasks-view";
import { renderTopNav } from "./views/top-nav";
import type {
  CreateTaskInput,
  RuntimeStatus,
  SessionBundle,
  SessionEvent,
  TabId,
  TaskDetail,
  TaskFilter,
  TaskSummary,
} from "./types";

const state: AppState = createInitialState();
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

document.title = "Agent Harness 工作区";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text(value?: string | null, fallback = "-"): string {
  return escapeHtml(cleanText(value, fallback));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "操作失败。";
}

function visibleTasks(): TaskSummary[] {
  if (state.taskFilter === "all") return state.tasks;
  if (state.taskFilter === "archived") return state.tasks.filter((task) => task.terminal_state === "archived");
  return state.tasks.filter((task) => task.terminal_state !== "archived");
}

function currentTask(): TaskSummary | undefined {
  return state.tasks.find((task) => task.task_id === state.selectedTaskId);
}

function currentDetail(): TaskDetail | undefined {
  return state.selectedTaskId ? state.taskDetails.get(state.selectedTaskId) : undefined;
}

function ensureSelectedTaskVisible(): void {
  const tasks = visibleTasks();
  const stillVisible = tasks.some((task) => task.task_id === state.selectedTaskId);
  if (!stillVisible) {
    state.selectedTaskId = tasks[0]?.task_id ?? null;
    state.selectedTaskTab = "overview";
  }
}

async function loadSelectedDetail(): Promise<void> {
  if (!state.selectedTaskId) return;
  const detail = await loadTaskDetail(state.selectedTaskId);
  state.taskDetails.set(state.selectedTaskId, detail);
}

async function refreshData(): Promise<void> {
  const [overview, tasks, accountsIndex, machinesIndex] = await Promise.all([
    loadOverview(),
    loadTasks(),
    loadAccounts(),
    loadMachines(),
  ]);

  state.overview = overview;
  state.tasks = tasks;
  state.accounts = accountsIndex.accounts ?? [];
  state.machines = machinesIndex.machines ?? [];
  state.taskDetails = new Map();

  try {
    state.assetsIndex = await loadAssets();
  } catch (error) {
    state.assetsIndex = null;
    state.banner = { tone: "info", text: `资产库暂时不可用：${errorMessage(error)}` };
  }

  ensureSelectedTaskVisible();
  await loadSelectedDetail();
}

async function safeRefreshData(): Promise<void> {
  try {
    await refreshData();
  } catch (error) {
    state.banner = { tone: "error", text: errorMessage(error) };
  }
  renderApp();
}

async function selectTask(taskId: string): Promise<void> {
  if (!taskId) return;
  try {
    let detail = state.taskDetails.get(taskId);
    if (!detail) {
      detail = await loadTaskDetail(taskId);
      state.taskDetails.set(taskId, detail);
    }
    state.currentView = "tasks";
    state.selectedTaskId = taskId;
    state.selectedTaskTab = "overview";
  } catch (error) {
    state.banner = { tone: "error", text: errorMessage(error) };
  }
  renderApp();
}

async function runMutation(action: () => Promise<unknown>, successMessage: string, nextTab?: TabId): Promise<void> {
  try {
    await action();
    if (nextTab) state.selectedTaskTab = nextTab;
    state.banner = { tone: "success", text: successMessage };
    await refreshData();
  } catch (error) {
    state.banner = { tone: "error", text: errorMessage(error) };
  }
  renderApp();
}

function accountOptions(): string {
  return state.accounts
    .map(
      (account) => `
        <option value="${escapeHtml(account.account_id)}" ${state.createForm.account_id === account.account_id ? "selected" : ""}>
          ${text(account.title, account.account_id)}
        </option>
      `,
    )
    .join("");
}

function machineOptions(): string {
  return [
    `<option value="">不绑定机器</option>`,
    ...state.machines.map(
      (machine) => `
        <option value="${escapeHtml(machine.machine_id)}" ${state.createForm.machine_id === machine.machine_id ? "selected" : ""}>
          ${text(machine.title, machine.machine_id)}
        </option>
      `,
    ),
  ].join("");
}

function findLatestReply(detail?: TaskDetail): { text: string; timestamp?: string; status?: string; sessionId?: string } {
  for (const bundle of detail?.sessions ?? []) {
    const latest = cleanText(bundle.session?.latest_assistant_text, "");
    if (latest) {
      return {
        text: latest,
        timestamp: bundle.session?.latest_assistant_at,
        status: bundle.session?.latest_turn_status,
        sessionId: bundle.session?.session_id,
      };
    }
  }
  return { text: "当前还没有来自真实 Codex 的回复。" };
}

function recentSessionEvents(bundle?: SessionBundle, limit = 8): SessionEvent[] {
  const events = bundle?.event_log?.events ?? [];
  return events.slice(Math.max(0, events.length - limit)).reverse();
}

function renderTopbar(): string {
  const counts = state.overview?.counts;
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Agent Harness</p>
        <h1>任务工作区</h1>
        <p class="lede">默认简洁，按需展开；先看任务，再决定是否进入运行时。</p>
      </div>
      <div class="topbar-actions">
        <span class="meta-chip">任务 ${counts?.tasks ?? state.tasks.length}</span>
        <span class="meta-chip">活跃 ${counts?.active_tasks ?? visibleTasks().length}</span>
        <button class="ghost-button" data-action="toggle-create" type="button">新建任务</button>
        <button class="ghost-button" data-action="refresh" type="button">刷新</button>
      </div>
    </header>
  `;
}

function renderSidebar(): string {
  const filters: Array<{ id: TaskFilter; label: string }> = [
    { id: "active", label: "活跃" },
    { id: "all", label: "全部" },
    { id: "archived", label: "归档" },
  ];

  return `
    <aside class="sidebar">
      <div class="section-head">
        <h2>任务</h2>
        <button class="link-button" data-action="toggle-create" type="button">新建</button>
      </div>
      <div class="filter-row">
        ${filters
          .map(
            (filter) => `
              <button class="filter-pill ${state.taskFilter === filter.id ? "is-active" : ""}" data-filter="${filter.id}" type="button">
                ${filter.label}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="task-list">
        ${
          visibleTasks().length
            ? visibleTasks()
                .map((task) => {
                  const badge = runtimeBadge(task);
                  return `
                    <button class="task-row ${task.task_id === state.selectedTaskId ? "is-active" : ""}" data-task-id="${escapeHtml(task.task_id)}" type="button">
                      <div class="task-row-head">
                        <strong>${text(task.title, task.task_id)}</strong>
                        <span class="badge badge-${badge.tone}">${badge.label}</span>
                      </div>
                      <div class="task-row-meta">
                        <span>${localizeStage(task.stage)}</span>
                        <span>${task.pending_decision_count ? `待处理 ${task.pending_decision_count}` : "无待处理"}</span>
                      </div>
                      <p class="task-row-subtle">${text(task.recommended_next_step || task.memory_summary, "暂无摘要")}</p>
                    </button>
                  `;
                })
                .join("")
            : `<div class="empty-card"><strong>当前没有可见任务</strong><p>切换筛选器，或者直接创建一个新任务。</p></div>`
        }
      </div>
    </aside>
  `;
}

function renderCreateModal(): string {
  if (!state.showCreateModal) return "";
  return `
    <div class="modal-backdrop" data-action="close-create">
      <section class="modal-card" role="dialog" aria-modal="true" aria-label="新建任务" onclick="event.stopPropagation()">
        <div class="section-head">
          <div>
            <p class="eyebrow">Create</p>
            <h3>新建任务</h3>
          </div>
          <button class="ghost-button" data-action="close-create" type="button">关闭</button>
        </div>
        <div class="form-grid">
          <label>
            <span>标题</span>
            <input data-field="title" value="${escapeHtml(state.createForm.title)}" placeholder="例如：优化 corrclip 训练效率" />
          </label>
          <label>
            <span>短名</span>
            <input data-field="short_name" value="${escapeHtml(state.createForm.short_name)}" placeholder="可选，用于 task id slug" />
          </label>
          <label class="full-span">
            <span>摘要</span>
            <textarea data-field="summary" rows="4" placeholder="一句话写清这个任务要解决什么问题。">${escapeHtml(state.createForm.summary)}</textarea>
          </label>
          <label>
            <span>优先级</span>
            <select data-field="priority">
              ${["P0", "P1", "P2", "P3"]
                .map((priority) => `<option value="${priority}" ${state.createForm.priority === priority ? "selected" : ""}>${priority}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            <span>账号</span>
            <select data-field="account_id">${accountOptions()}</select>
          </label>
          <label class="full-span">
            <span>机器</span>
            <select data-field="machine_id">${machineOptions()}</select>
          </label>
        </div>
        <div class="modal-actions">
          <button class="ghost-button" data-action="close-create" type="button">取消</button>
          <button class="primary-button" data-action="submit-create" type="button">创建任务</button>
        </div>
      </section>
    </div>
  `;
}

function renderOverviewTab(task: TaskSummary, detail?: TaskDetail): string {
  const memory = detail?.memory?.index;
  const reply = findLatestReply(detail);
  const blockers =
    memory?.current_blockers?.length ? summarizeList(memory.current_blockers) : task.blocked ? "存在阻塞" : "无";

  return `
    <section class="panel-grid">
      <article class="info-card">
        <span class="label">当前阶段</span>
        <strong>${localizeStage(memory?.current_stage ?? task.stage)}</strong>
      </article>
      <article class="info-card">
        <span class="label">当前 phase</span>
        <strong>${localizeStage(memory?.current_phase_kind ?? task.active_phase_kind)} / ${localizeStatus(memory?.current_phase_status ?? task.active_phase_status)}</strong>
      </article>
      <article class="info-card">
        <span class="label">阻塞</span>
        <strong>${text(blockers)}</strong>
      </article>
      <article class="info-card">
        <span class="label">运行状态</span>
        <strong>${localizeStatus(detail?.runtime?.status?.runtime_status ?? task.runtime_status)}</strong>
      </article>
    </section>
    <section class="panel-block">
      <div class="section-head">
        <h3>任务摘要</h3>
        <span class="subtle-line">优先级 ${text(task.priority)}</span>
      </div>
      <p>${text(memory?.summary ?? task.memory_summary ?? detail?.task?.summary, "当前还没有摘要。")}</p>
    </section>
    <section class="panel-block">
      <h3>下一步建议</h3>
      <p>${text(memory?.recommended_next_step ?? task.recommended_next_step, "当前没有建议的下一步。")}</p>
    </section>
    <section class="panel-block">
      <h3>最近回复</h3>
      <div class="reply-card">
        <div class="reply-meta">
          <span>主会话 ${text(reply.sessionId, "未连接")}</span>
          <span>${formatDate(reply.timestamp)}</span>
          <span>${localizeStatus(reply.status)}</span>
        </div>
        <p>${escapeHtml(reply.text)}</p>
      </div>
    </section>
    ${renderTaskAssetsBlock(task, detail, state.assetsIndex)}
  `;
}

function renderPlanTab(task: TaskSummary, detail?: TaskDetail): string {
  const terminalState = cleanText((detail?.task?.terminal_state as string | undefined) ?? task.terminal_state ?? "", "");
  const isArchived = terminalState === "archived";
  return `
    <section class="panel-block">
      <div class="section-head">
        <div>
          <h3>计划摘要</h3>
          <p class="subtle-line">${text(detail?.plan?.summary, "当前还没有计划摘要。")}</p>
        </div>
        <div class="button-row">
          <button class="ghost-button" data-action="advance-stage" type="button" ${isArchived ? "disabled" : ""}>推进阶段</button>
          <button class="ghost-button" data-action="toggle-archive" type="button">${isArchived ? "恢复任务" : "归档任务"}</button>
        </div>
      </div>
    </section>
    <section class="panel-block">
      <h3>阶段</h3>
      <div class="stack-list">
        ${
          detail?.phases?.length
            ? detail.phases
                .map(
                  (phase) => `
                    <article class="list-card">
                      <div class="list-card-head">
                        <strong>${text(phase.title)}</strong>
                        <span>${localizeStage(phase.phase_kind)} / ${localizeStatus(phase.status)}</span>
                      </div>
                      <p>${text(phase.summary, "暂无阶段摘要。")}</p>
                    </article>
                  `,
                )
                .join("")
            : `<p class="empty-line">当前还没有阶段记录。</p>`
        }
      </div>
    </section>
  `;
}

function renderRuntimeTab(task: TaskSummary, detail?: TaskDetail): string {
  const runtimeStatus = detail?.runtime?.status;
  const runtimeIndex = detail?.runtime?.index;
  const latestReply = findLatestReply(detail);
  const activeSession =
    detail?.sessions?.find((bundle) => bundle.session?.session_id === (runtimeIndex?.primary_session_id || task.primary_session_id)) ??
    detail?.sessions?.[0];
  const canSend = runtimeReady(runtimeStatus, task);

  return `
    <section class="panel-grid">
      <article class="info-card">
        <span class="label">连接状态</span>
        <strong>${statusHint(runtimeStatus, task)}</strong>
      </article>
      <article class="info-card">
        <span class="label">主会话</span>
        <strong>${text(runtimeIndex?.primary_session_id ?? task.primary_session_id, "未创建")}</strong>
      </article>
      <article class="info-card">
        <span class="label">线程</span>
        <strong>${text(runtimeStatus?.app_server_thread_id, "未附加")}</strong>
      </article>
      <article class="info-card">
        <span class="label">最近事件</span>
        <strong>${formatDate(runtimeIndex?.last_event_at ?? task.updated_at)}</strong>
      </article>
    </section>
    <section class="panel-block">
      <div class="section-head">
        <h3>运行时控制</h3>
        <div class="button-row">
          <button class="ghost-button" data-action="probe-runtime" type="button">探测 App Server</button>
          <button class="ghost-button" data-action="attach-runtime" type="button" ${runtimeIndex?.app_server_probe_status !== "ready" ? "disabled" : ""}>附加会话</button>
          <button class="ghost-button" data-action="reconnect-runtime" type="button">重连</button>
          <button class="ghost-button" data-action="stop-app-server" type="button">停止</button>
        </div>
      </div>
    </section>
    <section class="panel-block">
      <h3>最新回复</h3>
      <div class="reply-card">
        <div class="reply-meta">
          <span>${text(latestReply.sessionId, cleanText(activeSession?.session?.session_id, "未连接"))}</span>
          <span>${formatDate(latestReply.timestamp)}</span>
          <span>${localizeStatus(latestReply.status)}</span>
        </div>
        <p>${escapeHtml(latestReply.text)}</p>
      </div>
    </section>
    <section class="panel-block">
      <h3>发送消息</h3>
      <div class="composer">
        <textarea id="runtimeMessageInput" rows="4" placeholder="给当前真实会话发一条消息。">${escapeHtml(state.draftMessage)}</textarea>
        <div class="composer-actions">
          <span class="subtle-line">${statusHint(runtimeStatus, task)}</span>
          <button class="primary-button" data-action="send-message" type="button" ${canSend ? "" : "disabled"}>发送</button>
        </div>
      </div>
    </section>
    <details class="details-panel">
      <summary>高级连接信息</summary>
      <div class="details-grid">
        <div><span class="label">Probe</span><strong>${localizeStatus(runtimeIndex?.app_server_probe_status ?? task.app_server_probe_status)}</strong></div>
        <div><span class="label">Attach</span><strong>${localizeStatus(runtimeIndex?.app_server_attach_status ?? task.app_server_attach_status)}</strong></div>
        <div><span class="label">Bridge</span><strong>${localizeStatus(runtimeIndex?.app_server_bridge_status ?? task.app_server_bridge_status)}</strong></div>
        <div><span class="label">WS</span><strong>${text(runtimeStatus?.app_server_ws_url ?? runtimeIndex?.app_server_ws_url)}</strong></div>
        <div><span class="label">Port</span><strong>${text(String(runtimeStatus?.app_server_port ?? runtimeIndex?.app_server_port ?? "-"))}</strong></div>
        <div><span class="label">错误</span><strong>${text(runtimeStatus?.last_error_detail ?? runtimeIndex?.last_error_summary, "无")}</strong></div>
      </div>
    </details>
  `;
}

function renderExperimentTab(detail?: TaskDetail): string {
  return `
    <section class="panel-block">
      <h3>实验记录</h3>
      <div class="stack-list">
        ${
          detail?.experiments?.length
            ? detail.experiments
                .map(
                  (experiment) => `
                    <article class="list-card">
                      <div class="list-card-head">
                        <strong>${text(experiment.title)}</strong>
                        <span>${localizeStatus(experiment.status)}</span>
                      </div>
                      <p>${text(experiment.summary, "暂无实验摘要。")}</p>
                    </article>
                  `,
                )
                .join("")
            : `<p class="empty-line">当前还没有实验记录。</p>`
        }
      </div>
    </section>
    <section class="panel-block">
      <h3>关键结论</h3>
      <div class="stack-list">
        ${
          detail?.findings?.length
            ? detail.findings
                .map(
                  (finding) => `
                    <article class="list-card">
                      <strong>${text(finding.title)}</strong>
                      <p>${text(finding.summary, "暂无结论摘要。")}</p>
                    </article>
                  `,
                )
                .join("")
            : `<p class="empty-line">当前还没有 findings。</p>`
        }
      </div>
    </section>
  `;
}

function renderSessionTab(detail?: TaskDetail): string {
  const bundle = detail?.sessions?.[0];
  const events = recentSessionEvents(bundle);

  return `
    <section class="panel-block">
      <h3>会话摘要</h3>
      <p>${text(bundle?.summary?.summary ?? bundle?.session?.summary, "当前还没有会话摘要。")}</p>
    </section>
    <section class="panel-block">
      <h3>最近事件</h3>
      <div class="stack-list">
        ${
          events.length
            ? events
                .map(
                  (event) => `
                    <article class="list-card">
                      <div class="list-card-head">
                        <strong>${text(event.kind)}</strong>
                        <span>${formatDate(event.timestamp)}</span>
                      </div>
                      <p>${text(event.summary, "暂无摘要。")}</p>
                    </article>
                  `,
                )
                .join("")
            : `<p class="empty-line">当前还没有事件流。</p>`
        }
      </div>
    </section>
    <details class="details-panel">
      <summary>完整事件摘要</summary>
      <pre class="event-log">${escapeHtml(bundle?.event_log?.summary ?? "当前还没有事件流摘要。")}</pre>
    </details>
  `;
}

function renderWorkspace(): string {
  const task = currentTask();
  const detail = currentDetail();
  if (!task) {
    return `
      <section class="workspace-empty">
        <h2>还没有选中任务</h2>
        <p>从左侧选择一个任务，或者直接创建新任务。右侧会在一个稳定的工作区里展示计划、运行时和会话信息。</p>
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

  let panel = "";
  if (state.selectedTaskTab === "overview") panel = renderOverviewTab(task, detail);
  if (state.selectedTaskTab === "plan") panel = renderPlanTab(task, detail);
  if (state.selectedTaskTab === "runtime") panel = renderRuntimeTab(task, detail);
  if (state.selectedTaskTab === "experiment") panel = renderExperimentTab(detail);
  if (state.selectedTaskTab === "session") panel = renderSessionTab(detail);

  const badge = runtimeBadge(task);
  return `
    <section class="workspace">
      <header class="workspace-header">
        <div>
          <p class="eyebrow">Current Task</p>
          <h2>${text(task.title, task.task_id)}</h2>
          <p class="summary">${text(task.memory_summary ?? detail?.task?.summary, "暂无摘要。")}</p>
        </div>
        <div class="workspace-meta">
          <span class="meta-chip">${localizeStage(task.stage)}</span>
          <span class="meta-chip">${localizeStage(task.active_phase_kind)} / ${localizeStatus(task.active_phase_status)}</span>
          <span class="badge badge-${badge.tone}">${badge.label}</span>
        </div>
      </header>
      <div class="tab-row">
        ${tabs
          .map(
            (tab) => `
              <button class="tab-button ${state.selectedTaskTab === tab.id ? "is-active" : ""}" data-tab-id="${tab.id}" type="button">
                ${tab.label}
              </button>
            `,
          )
          .join("")}
      </div>
      <section class="workspace-panel">${panel}</section>
    </section>
  `;
}

function renderBanner(): string {
  if (!state.banner) return "";
  return `<div class="banner banner-${state.banner.tone}">${escapeHtml(state.banner.text)}</div>`;
}

function renderCurrentView(): string {
  if (state.currentView === "assets") {
    return renderAssetsView(state.assetsIndex, state.expandedAssetCategories);
  }
  return `
    <section class="tasks-shell">
      ${renderTasksView({
        sidebar: renderSidebar(),
        workspace: renderWorkspace(),
        modal: renderCreateModal(),
      })}
    </section>
  `;
}

function renderApp(): void {
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar()}
      ${renderTopNav(state.currentView)}
      ${renderBanner()}
      ${renderCurrentView()}
    </div>
  `;
  bindEvents();
}

async function handleCreateTask(): Promise<void> {
  const title = state.createForm.title.trim();
  const summary = state.createForm.summary.trim();
  if (!title || !summary) {
    state.banner = { tone: "error", text: "标题和摘要是必填项。" };
    renderApp();
    return;
  }
  try {
    await createTask(state.createForm);
    state.banner = { tone: "success", text: "任务已创建。" };
    state.showCreateModal = false;
    state.createForm = { ...state.createForm, title: "", summary: "", short_name: "", machine_id: "" };
    await refreshData();
  } catch (error) {
    state.banner = { tone: "error", text: errorMessage(error) };
  }
  renderApp();
}

async function handleSendMessage(taskId: string): Promise<void> {
  const content = state.draftMessage.trim();
  if (!content) {
    state.banner = { tone: "error", text: "先写一条消息再发送。" };
    renderApp();
    return;
  }
  try {
    await runMutation(() => sendRuntimeMessage(taskId, content), "消息已发送。", "runtime");
    state.draftMessage = "";
  } catch (error) {
    state.banner = { tone: "error", text: errorMessage(error) };
  }
  renderApp();
}

function bindEvents(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskFilter = button.dataset.filter as TaskFilter;
      ensureSelectedTaskVisible();
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-task-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await selectTask(button.dataset.taskId || "");
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-tab-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTaskTab = (button.dataset.tabId as TabId) || "overview";
      state.currentView = "tasks";
      renderApp();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view === "tasks" || view === "assets") {
        state.currentView = view;
        renderApp();
      }
    });
  });

  app.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => {
    element.addEventListener("click", async () => {
      const action = element.getAttribute("data-action");
      if (action === "refresh") {
        await safeRefreshData();
        return;
      }
      if (action === "toggle-create") {
        state.showCreateModal = true;
        renderApp();
        return;
      }
      if (action === "close-create") {
        state.showCreateModal = false;
        renderApp();
        return;
      }
      if (action === "submit-create") {
        await handleCreateTask();
        return;
      }
      if (action === "toggle-asset-category") {
        const categoryId = element.getAttribute("data-category-id");
        if (categoryId) {
          if (state.expandedAssetCategories.has(categoryId)) {
            state.expandedAssetCategories.delete(categoryId);
          } else {
            state.expandedAssetCategories.add(categoryId);
          }
          renderApp();
        }
        return;
      }
      if (action === "advance-stage") {
        const task = currentTask();
        if (task) await runMutation(() => advanceStage(task.task_id), "阶段已推进。");
        return;
      }
      if (action === "toggle-archive") {
        const task = currentTask();
        if (task) {
          const terminalState = task.terminal_state === "archived" ? "" : "archived";
          await runMutation(() => setTerminalState(task.task_id, terminalState), terminalState ? "任务已归档。" : "任务已恢复。");
        }
        return;
      }
      if (action === "probe-runtime") {
        const task = currentTask();
        if (task) await runMutation(() => probeRuntime(task.task_id), "App Server 探测成功。", "runtime");
        return;
      }
      if (action === "attach-runtime") {
        const task = currentTask();
        if (task) await runMutation(() => attachRuntime(task.task_id), "已附加真实会话。", "runtime");
        return;
      }
      if (action === "stop-app-server") {
        const task = currentTask();
        if (task) await runMutation(() => stopAppServer(task.task_id), "已停止 App Server。", "runtime");
        return;
      }
      if (action === "reconnect-runtime") {
        const task = currentTask();
        if (task) await runMutation(() => reconnectRuntime(task.task_id), "已重连当前主会话。", "runtime");
        return;
      }
      if (action === "send-message") {
        const task = currentTask();
        if (task) await handleSendMessage(task.task_id);
      }
    });
  });

  app.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const field = input.getAttribute("data-field") as keyof CreateTaskInput;
      state.createForm = { ...state.createForm, [field]: input.value };
    });
  });

  const messageInput = app.querySelector<HTMLTextAreaElement>("#runtimeMessageInput");
  if (messageInput) {
    messageInput.addEventListener("input", () => {
      state.draftMessage = messageInput.value;
    });
  }
}

void safeRefreshData();
