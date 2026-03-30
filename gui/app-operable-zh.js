const INDEX_ROOT = "../indexes";

const state = {
  overview: null,
  tasks: [],
  knowledge: [],
  accounts: [],
  machines: [],
  taskDetails: new Map(),
  selectedTaskId: null,
  processPanelExpanded: false,
  showDetailedEvents: false,
  handoffModeOverride: null,
  selectedTaskTab: "plan",
  createTaskPanelExpanded: false,
  guideDrawerOpen: false,
};

const elements = {
  refreshButton: document.getElementById("refreshButton"),
  guideToggleButton: document.getElementById("guideToggleButton"),
  guideCloseButton: document.getElementById("guideCloseButton"),
  guideOverlay: document.getElementById("guideOverlay"),
  guideDrawer: document.getElementById("guideDrawer"),
  guideContent: document.getElementById("guideContent"),
  taskList: document.getElementById("taskList"),
  accountList: document.getElementById("accountList"),
  machineList: document.getElementById("machineList"),
  toggleCreateTaskButton: document.getElementById("toggleCreateTaskButton"),
  createTaskPanel: document.getElementById("createTaskPanel"),
  createTaskTitle: document.getElementById("createTaskTitle"),
  createTaskShortName: document.getElementById("createTaskShortName"),
  createTaskSummary: document.getElementById("createTaskSummary"),
  createTaskPriority: document.getElementById("createTaskPriority"),
  createTaskAccount: document.getElementById("createTaskAccount"),
  createTaskMachine: document.getElementById("createTaskMachine"),
  submitCreateTaskButton: document.getElementById("submitCreateTaskButton"),
  taskCountBadge: document.getElementById("taskCountBadge"),
  decisionBadge: document.getElementById("decisionBadge"),
  decisionList: document.getElementById("decisionList"),
  findingList: document.getElementById("findingList"),
  timelineList: document.getElementById("timelineList"),
  activeTaskCount: document.getElementById("activeTaskCount"),
  pendingDecisionCount: document.getElementById("pendingDecisionCount"),
  machineCount: document.getElementById("machineCount"),
  knowledgeCount: document.getElementById("knowledgeCount"),
  taskTitle: document.getElementById("taskTitle"),
  taskSummary: document.getElementById("taskSummary"),
  taskStage: document.getElementById("taskStage"),
  taskCurrentPhase: document.getElementById("taskCurrentPhase"),
  taskNextStageHint: document.getElementById("taskNextStageHint"),
  advanceStageButton: document.getElementById("advanceStageButton"),
  taskPriority: document.getElementById("taskPriority"),
  taskBlockers: document.getElementById("taskBlockers"),
  taskMachines: document.getElementById("taskMachines"),
  taskMeta: document.getElementById("taskMeta"),
  planPanel: document.getElementById("planPanel"),
  experimentPanel: document.getElementById("experimentPanel"),
  runtimeStartButton: document.getElementById("runtimeStartButton"),
  runtimeProbeButton: document.getElementById("runtimeProbeButton"),
  runtimeAttachButton: document.getElementById("runtimeAttachButton"),
  runtimeProbeStopButton: document.getElementById("runtimeProbeStopButton"),
  runtimeStopButton: document.getElementById("runtimeStopButton"),
  runtimeReconnectButton: document.getElementById("runtimeReconnectButton"),
  runtimeHint: document.getElementById("runtimeHint"),
  runtimePanel: document.getElementById("runtimePanel"),
  runtimeMessageInput: document.getElementById("runtimeMessageInput"),
  runtimeSendHandoffButton: document.getElementById("runtimeSendHandoffButton"),
  runtimeSendMessageButton: document.getElementById("runtimeSendMessageButton"),
  processToggleButton: document.getElementById("processToggleButton"),
  detailEventToggle: document.getElementById("detailEventToggle"),
  processPanel: document.getElementById("processPanel"),
  handoffDiscussButton: document.getElementById("handoffDiscussButton"),
  handoffExecuteButton: document.getElementById("handoffExecuteButton"),
  copyPromptButton: document.getElementById("copyPromptButton"),
  handoffModeHint: document.getElementById("handoffModeHint"),
  handoffPanel: document.getElementById("handoffPanel"),
};

const FOLD_PANEL_CONFIG = [
  {
    selector: '#taskMeta',
    title: '任务定义',
    caption: '目标、约束、开放问题和当前建议',
    defaultOpen: true,
  },
  {
    selector: '#planPanel',
    title: '计划与阶段',
    caption: '当前阶段、phase 记录和推进条件',
    defaultOpen: true,
  },
  {
    selector: '#experimentPanel',
    title: '实验记录',
    caption: '实验状态、产物路径和最近更新',
    defaultOpen: false,
  },
  {
    selector: '#runtimePanel',
    title: '运行时',
    caption: 'Codex runtime、App Server、bridge 和消息入口',
    defaultOpen: true,
  },
  {
    selector: '#handoffPanel',
    title: '交接包',
    caption: '短决策卡片、完整摘要和起始消息',
    defaultOpen: false,
  },
  {
    selector: '#processPanel',
    title: '过程流',
    caption: '任务事件、会话事件和详细过程开关',
    defaultOpen: false,
  },
];

const STAGE_LABELS = {
  clarification: "澄清",
  planning: "计划",
  execution: "执行",
  verification: "验证",
  "knowledge-review": "知识审核",
};

const STATUS_LABELS = {
  pending: "待处理",
  confirmed: "已确认",
  approved: "已批准",
  open: "已开启",
  planned: "已计划",
  running: "运行中",
};

const PHASE_STATUS_LABELS = {
  open: "已开启",
  planned: "待开启",
  running: "运行中",
  completed: "已完成",
  closed: "已关闭",
  paused: "已暂停",
};

Object.assign(STATUS_LABELS, {
  idle: "空闲",
  starting: "启动中",
  "waiting-user": "等待你介入",
  error: "异常",
  stopped: "已停止",
  "not-probed": "未探测",
  "not-started": "未启动",
  ready: "就绪",
  attached: "已附加",
  "not-attached": "未附加",
  missing: "已失联",
});

const BLOCKER_LABELS = {
  "waiting-user-decision": "等待你的决策",
  "waiting-remote-resource": "等待远程资源",
  "waiting-experiment": "等待实验完成",
  "waiting-external-info": "等待外部信息",
};

const EVENT_KIND_LABELS = {
  task: "任务",
  plan: "计划",
  phase: "Phase",
  decision: "决策",
  experiment: "实验",
  finding: "结论",
};

const ACTIVE_STAGES = ["clarification", "planning", "execution", "verification", "knowledge-review"];
const HANDOFF_MODE_LABELS = {
  discuss: "讨论模式",
  execute: "执行模式",
};

const TASK_TAB_CONFIG = [
  { id: "overview", label: "概览" },
  { id: "plan", label: "计划" },
  { id: "experiment", label: "实验" },
  { id: "runtime", label: "运行时" },
  { id: "session", label: "会话" },
];

const GUIDE_SECTIONS = [
  {
    title: "主阶段",
    body: "主阶段表示任务在整个工作流中的大位置。它反映的是任务生命周期，而不是你是否真的已经完成某个动作。",
    bullets: [
      "`clarification`：澄清目标、约束和未知项",
      "`planning`：计划已形成，等待进入正式执行",
      "`execution`：开始推进已确认的执行动作",
      "`verification`：对照成功判据检查证据是否成立",
      "`knowledge-review`：整理知识候选，决定是否正式沉淀",
    ],
  },
  {
    title: "Phase 状态",
    body: "Phase 是主阶段内部的具体阶段记录。主阶段和 phase 不是一回事，任务只有一个主阶段，但会累计多个 phase 记录。",
    bullets: [
      "`已开启`：当前 phase 正在作为活动阶段使用",
      "`已完成`：这个 phase 已收口，历史会保留",
      "`待开启 / 已暂停 / 已关闭`：用于更细粒度地表达阶段状态",
    ],
  },
  {
    title: "阻塞与终态",
    body: "阻塞和暂停是覆盖标记，不会替代主阶段；终态才表示任务真正结束。",
    bullets: [
      "`blocked`：当前因为外部条件无法推进",
      "`paused`：任务被有意暂放",
      "`completed / archived / cancelled`：终态。只有进入终态，任务才算真的结束",
    ],
  },
  {
    title: "交接模式",
    body: "交接包会根据当前阶段推荐模式，但你可以手动切换。",
    bullets: [
      "`讨论模式`：适合澄清、规划、复盘、确认风险",
      "`执行模式`：适合把已确定的下一步交给 Codex 直接推进",
      "当前 GUI 只生成交接材料，不会直接启动 Codex",
    ],
  },
  {
    title: "常用操作",
    body: "这几个按钮现在是控制面里最常用的入口。",
    bullets: [
      "`新建任务`：创建真实任务目录、task.md、plan.md 和 phase-01",
      "`推进到下一阶段`：只更新控制面状态，并且现在带有硬门槛校验",
      "`过程流`：查看任务记录产生的精简或详细事件",
      "`复制起始消息`：复制交接包中的 Codex 起始消息，供你手动发起交流",
    ],
  },
];

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`加载 ${path} 失败：${response.status}`);
  }
  return response.json();
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error("当前 GUI 不是由控制面服务提供。请在 E:\\codex-home 运行 `py -3 .\\scripts\\control_plane_server.py` 后再重试。");
    }
    throw new Error(`请求 ${path} 返回了非 JSON 响应`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`请求 ${path} 返回了无法解析的 JSON`);
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `请求 ${path} 失败`);
  }
  return data;
}

function emptyNode(message = "这里还没有内容") {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";
  wrapper.innerHTML = `<strong>${message}</strong><p>当控制面记录了更多任务、结论或实验后，这里会自动显示。</p>`;
  return wrapper;
}

function formatDate(value) {
  if (!value) return "未知";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatList(values, mapper = null) {
  if (!values || !values.length) return "无";
  const mapped = mapper ? values.map((value) => mapper[value] || value) : values;
  return mapped.join("，");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function ensureActionRow(head) {
  let actions = head.querySelector(".section-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "section-actions";
    head.append(actions);
  }
  return actions;
}

function setFoldState(section, nextOpen) {
  const body = section.querySelector(".fold-body");
  const toggle = section.querySelector(".fold-toggle");
  section.dataset.foldOpen = nextOpen ? "true" : "false";
  section.classList.toggle("is-collapsed", !nextOpen);
  if (body) {
    body.hidden = !nextOpen;
  }
  if (toggle) {
    toggle.textContent = nextOpen ? "收起" : "展开";
    toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  }
}

function upgradeDetailSection(detailWorkspace, config) {
  const target = detailWorkspace.querySelector(config.selector);
  const section = target?.closest(".panel");
  if (!target || !section || section.classList.contains("hero-panel")) {
    return;
  }

  const head = section.querySelector(".section-head");
  if (!head || section.dataset.foldReady === "true") {
    return;
  }

  const titleNode = head.querySelector("h2");
  const titleText = config.title || titleNode?.textContent?.trim() || "区块";
  if (titleNode) {
    titleNode.remove();
  }

  const headerCopy = document.createElement("div");
  headerCopy.className = "fold-header-copy";
  headerCopy.innerHTML = `
    <h2>${escapeHtml(titleText)}</h2>
    <p class="fold-caption">${escapeHtml(config.caption || "")}</p>
  `;
  head.prepend(headerCopy);
  head.classList.add("fold-head");

  const body = document.createElement("div");
  body.className = "fold-body";
  while (head.nextSibling) {
    body.append(head.nextSibling);
  }
  section.append(body);

  const actions = ensureActionRow(head);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ghost-button slim-button fold-toggle";
  actions.append(toggle);
  toggle.addEventListener("click", () => {
    setFoldState(section, section.dataset.foldOpen !== "true");
  });

  section.classList.add("fold-panel");
  section.dataset.foldReady = "true";
  setFoldState(section, Boolean(config.defaultOpen));
}

function initializeLayoutShell() {
  const appShell = document.querySelector(".app-shell");
  const leftRail = document.querySelector(".left-rail");
  const mainStage = document.querySelector(".main-stage");
  const summaryGrid = document.querySelector(".summary-grid");
  const contentGrid = document.querySelector(".content-grid");
  const workspaceGrid = document.querySelector(".workspace-grid");
  const taskHubPanel = document.querySelector(".task-hub-panel");
  const detailSidebar = document.querySelector(".detail-sidebar");

  if (!appShell || !mainStage || appShell.dataset.layoutReady === "true") {
    return;
  }

  if (leftRail) {
    const toolbar = document.createElement("header");
    toolbar.className = "top-toolbar panel";

    const brandCard = leftRail.querySelector(".brand-card");
    const brand = document.createElement("div");
    brand.className = "toolbar-brand";
    if (brandCard) {
      ["p.eyebrow", "h1", "p.lede"].forEach((selector) => {
        const node = brandCard.querySelector(selector);
        if (node) {
          brand.append(node);
        }
      });
    }

    const actions = document.createElement("div");
    actions.className = "toolbar-actions";

    const railSection = leftRail.querySelector(".rail-section");
    if (railSection) {
      const resource = document.createElement("details");
      resource.className = "resource-popover";
      resource.innerHTML = `
        <summary class="ghost-button slim-button">账号与机器</summary>
        <div class="resource-popover-body"></div>
      `;
      const body = resource.querySelector(".resource-popover-body");
      const sectionTitle = railSection.querySelector(".section-head");
      if (sectionTitle) {
        sectionTitle.remove();
      }
      while (railSection.firstChild) {
        body.append(railSection.firstChild);
      }
      actions.append(resource);
    }

    if (elements.guideToggleButton) actions.append(elements.guideToggleButton);
    if (elements.refreshButton) actions.append(elements.refreshButton);

    toolbar.append(brand, actions);
    appShell.insertBefore(toolbar, mainStage);
    leftRail.remove();
  }

  if (taskHubPanel) {
    taskHubPanel.classList.add("task-overview-panel");
    elements.taskList.className = "task-list task-strip";
    mainStage.insertBefore(taskHubPanel, mainStage.firstChild);
  }

  const insightsGrid = document.createElement("section");
  insightsGrid.className = "insights-grid";
  [summaryGrid, contentGrid].forEach((container) => {
    if (!container) return;
    while (container.firstChild) {
      insightsGrid.append(container.firstChild);
    }
    container.remove();
  });
  if (insightsGrid.childElementCount) {
    mainStage.append(insightsGrid);
  }

  if (workspaceGrid) {
    workspaceGrid.remove();
  }

  if (detailSidebar) {
    detailSidebar.classList.add("detail-workspace");
    mainStage.append(detailSidebar);

    const heroPanel = detailSidebar.querySelector(".hero-panel");
    let tabShell = detailSidebar.querySelector(".task-tabs-shell");
    if (!tabShell) {
      tabShell = document.createElement("section");
      tabShell.className = "panel task-tabs-shell";
      tabShell.innerHTML = `
        <div class="task-tabs-head">
          <div>
            <p class="eyebrow">Workspace</p>
            <h2>任务工作区</h2>
          </div>
        </div>
        <div class="task-tab-bar" role="tablist"></div>
        <div class="task-tab-panels"></div>
      `;
      if (heroPanel) {
        heroPanel.insertAdjacentElement("afterend", tabShell);
      } else {
        detailSidebar.prepend(tabShell);
      }
    }

    const tabBar = tabShell.querySelector(".task-tab-bar");
    const tabPanels = tabShell.querySelector(".task-tab-panels");

    TASK_TAB_CONFIG.forEach((tab) => {
      let button = tabBar.querySelector(`[data-tab-id="${tab.id}"]`);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "task-tab-button";
        button.dataset.tabId = tab.id;
        button.textContent = tab.label;
        button.addEventListener("click", () => {
          state.selectedTaskTab = tab.id;
          renderTaskTabs();
        });
        tabBar.append(button);
      }

      let panel = tabPanels.querySelector(`[data-tab-panel="${tab.id}"]`);
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "task-tab-panel";
        panel.dataset.tabPanel = tab.id;
        tabPanels.append(panel);
      }
    });

    const moveSection = (section, tabId) => {
      const targetPanel = tabPanels.querySelector(`[data-tab-panel="${tabId}"]`);
      if (targetPanel && section && section !== heroPanel && section !== tabShell) {
        targetPanel.append(section);
      }
    };

    const moveNode = (node, tabId) => {
      const targetPanel = tabPanels.querySelector(`[data-tab-panel="${tabId}"]`);
      if (targetPanel && node) {
        targetPanel.append(node);
      }
    };

    moveSection(elements.taskMeta?.closest("section.panel"), "overview");
    moveSection(elements.planPanel?.closest("section.panel"), "plan");
    moveSection(elements.experimentPanel?.closest("section.panel"), "experiment");
    moveSection(elements.runtimePanel?.closest("section.panel"), "runtime");
    moveSection(elements.handoffPanel?.closest("section.panel"), "overview");
    moveSection(elements.processPanel?.closest("section.panel"), "session");
    moveNode(insightsGrid, "overview");

    renderTaskTabs();
  }

  appShell.dataset.layoutReady = "true";
}

function renderTaskTabs() {
  const tabButtons = document.querySelectorAll(".task-tab-button");
  const tabPanels = document.querySelectorAll(".task-tab-panel");
  const activeTab = TASK_TAB_CONFIG.some((tab) => tab.id === state.selectedTaskTab)
    ? state.selectedTaskTab
    : "plan";

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabId === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.tabPanel === activeTab);
  });
}

function renderGuideDrawer() {
  elements.guideOverlay.hidden = !state.guideDrawerOpen;
  elements.guideDrawer.classList.toggle("is-open", state.guideDrawerOpen);
  elements.guideDrawer.setAttribute("aria-hidden", state.guideDrawerOpen ? "false" : "true");
  elements.guideToggleButton.classList.toggle("is-active", state.guideDrawerOpen);

  if (elements.guideContent.childElementCount) {
    return;
  }

  GUIDE_SECTIONS.forEach((section) => {
    const block = document.createElement("section");
    block.className = "guide-section";
    block.innerHTML = `
      <h3>${escapeHtml(section.title)}</h3>
      <p>${escapeHtml(section.body)}</p>
      <ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    `;
    elements.guideContent.append(block);
  });
}

function localizeStage(value) {
  return STAGE_LABELS[value] || value || "-";
}

function localizeStatus(value) {
  return STATUS_LABELS[value] || value || "-";
}

function localizePhaseStatus(value) {
  return PHASE_STATUS_LABELS[value] || localizeStatus(value);
}

function formatMainStage(value) {
  if (!value) return "-";
  return `${localizeStage(value)}阶段`;
}

function localizePhaseKind(value) {
  if (!value) return "未命名 phase";
  return `${localizeStage(value)} phase`;
}

function formatCurrentPhase(phase) {
  if (!phase) return "无活跃 phase";
  return `${localizePhaseKind(phase.phase_kind)} / ${localizePhaseStatus(phase.status)}`;
}

function getNextStage(stage) {
  const index = ACTIVE_STAGES.indexOf(stage);
  if (index === -1 || index >= ACTIVE_STAGES.length - 1) {
    return null;
  }
  return ACTIVE_STAGES[index + 1];
}

function getAdvanceGateReason(detail) {
  if (!detail?.task) {
    return "还没有任务详情。";
  }

  const currentStage = getEffectiveStage(detail);
  const decisions = detail.decisions || [];
  const experiments = detail.experiments || [];
  const findings = detail.findings || [];
  const plan = detail.plan;

  if (currentStage === "clarification") {
    const hasPendingDecision = decisions.some((decision) => decision.status === "pending" || decision.needs_user_confirmation);
    return hasPendingDecision ? "还有待确认的决策项。" : null;
  }

  if (currentStage === "planning") {
    if (!plan) return "缺少计划记录。";
    if (plan.status !== "approved") return "计划还没有达到 approved 状态。";
    return null;
  }

  if (currentStage === "execution") {
    const hasExecutedExperiment = experiments.some((experiment) => experiment.status && experiment.status !== "planned");
    return hasExecutedExperiment ? null : "至少需要一条不是 planned 的实验记录。";
  }

  if (currentStage === "verification") {
    const hasExecutedExperiment = experiments.some((experiment) => experiment.status && experiment.status !== "planned");
    const hasFinding = findings.length > 0;
    return hasExecutedExperiment || hasFinding ? null : "至少需要一条已执行实验或一条 finding 记录。";
  }

  if (currentStage === "knowledge-review") {
    return "当前已到最后一个活跃阶段，后续应进入 completed 或 archived。";
  }

  return null;
}

function recommendHandoffMode(stage) {
  if (stage === "execution") {
    return "execute";
  }
  return "discuss";
}

function getEffectiveHandoffMode(detail) {
  return state.handoffModeOverride || recommendHandoffMode(getEffectiveStage(detail));
}

function getTaskMemoryIndex(detail) {
  return detail?.memory?.index || null;
}

function getTaskMemoryBlock(detail, blockKind) {
  return (detail?.memory?.blocks || []).find((block) => block.block_kind === blockKind) || null;
}

function getActivePhaseFromMemory(detail) {
  const memoryIndex = getTaskMemoryIndex(detail);
  if (!memoryIndex?.current_phase_id && !memoryIndex?.current_phase_kind) {
    return null;
  }
  return {
    phase_id: memoryIndex.current_phase_id || "",
    phase_kind: memoryIndex.current_phase_kind || "",
    status: memoryIndex.current_phase_status || "",
    title: memoryIndex.current_phase_id || "phase",
  };
}

function getLatestSession(detail) {
  return (detail?.sessions || [])[0] || null;
}

function getSessionPart(sessionEntry, key) {
  return sessionEntry?.[key] || null;
}

function getRuntime(detail) {
  return detail?.runtime || null;
}

function isRuntimeReallyAttached(detail) {
  const runtime = getRuntime(detail);
  const runtimeIndex = runtime?.index || null;
  const runtimeStatus = runtime?.status || null;
  const probeReady = (runtimeIndex?.app_server_probe_status || runtimeStatus?.app_server_probe_status || "") === "ready";
  const attachReady = (runtimeIndex?.app_server_attach_status || runtimeStatus?.app_server_attach_status || "") === "attached";
  const bridgeRunning = (runtimeIndex?.app_server_bridge_status || runtimeStatus?.app_server_bridge_status || "") === "running";
  const hasThread = Boolean(
    runtimeIndex?.app_server_thread_id
    || runtimeStatus?.app_server_thread_id
    || runtimeStatus?.app_server_thread_path
  );

  return probeReady && attachReady && bridgeRunning && hasThread;
}

function getRuntimeSendGate(detail) {
  if (!detail?.task) {
    return {
      canSend: false,
      reason: "先选择一个任务，再连接真实 Codex 会话。",
    };
  }

  const runtime = getRuntime(detail);
  const runtimeIndex = runtime?.index || null;
  const runtimeStatus = runtime?.status || null;
  const probeStatus = runtimeIndex?.app_server_probe_status || runtimeStatus?.app_server_probe_status || "not-probed";
  const attachStatus = runtimeIndex?.app_server_attach_status || runtimeStatus?.app_server_attach_status || "not-attached";
  const bridgeStatus = runtimeIndex?.app_server_bridge_status || runtimeStatus?.app_server_bridge_status || "not-started";
  const threadId = runtimeIndex?.app_server_thread_id || runtimeStatus?.app_server_thread_id || "";

  if (probeStatus !== "ready") {
    return {
      canSend: false,
      reason: "当前还没有可用的 App Server。先完成探测并确认 probe=ready。",
    };
  }
  if (attachStatus !== "attached" || !threadId) {
    return {
      canSend: false,
      reason: "当前还没有附加到真实 Codex thread。先执行“附加会话”。",
    };
  }
  if (bridgeStatus !== "running") {
    return {
      canSend: false,
      reason: "当前 bridge 不可用。请重新探测或重新附加，恢复真实会话连接。",
    };
  }

  return {
    canSend: true,
    reason: `已连接真实 Codex 会话：${threadId}`,
  };
}

function summarizeAgentReplyFromEvents(events) {
  if (!events?.length) {
    return { text: "", timestamp: "", scope: "", status: "" };
  }

  let started = false;
  const deltas = [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.scope === "item/agentMessage/delta") {
      started = true;
      deltas.push(String(event.summary || "").replace(/^agent delta:\s*/i, ""));
      continue;
    }
    if (started) {
      break;
    }
  }

  const latestTurn = [...events].reverse().find((event) => event.scope === "turn/completed" || event.scope === "turn/failed");
  const latestError = [...events].reverse().find((event) => event.kind === "error" || event.scope === "bridge-error");

  return {
    text: deltas.reverse().join(""),
    timestamp: latestTurn?.timestamp || latestError?.timestamp || "",
    scope: latestTurn?.scope || latestError?.scope || "",
    status: latestTurn?.summary || latestError?.summary || "",
  };
}

function getLatestAssistantReply(detail) {
  const sessions = detail?.sessions || [];
  const runtime = getRuntime(detail);
  const primarySessionId = runtime?.index?.primary_session_id || "";
  const primarySession = sessions.find((sessionEntry) => sessionEntry?.session?.session_id === primarySessionId);
  const targetSessions = primarySession ? [primarySession] : [];

  for (const sessionEntry of targetSessions) {
    const sessionRecord = sessionEntry?.session || {};
    const directText = String(sessionRecord.latest_assistant_text || "").trim();
    if (directText) {
      return {
        sessionId: sessionRecord.session_id || "",
        text: directText,
        timestamp: sessionRecord.latest_assistant_at || sessionRecord.last_event_at || "",
        scope: sessionRecord.latest_assistant_phase || "agentMessage",
        status: sessionRecord.latest_turn_status ? `turn completed: ${sessionRecord.latest_turn_status}` : "",
      };
    }
    const eventLog = getSessionPart(sessionEntry, "event_log");
    const events = eventLog?.events || [];
    const reply = summarizeAgentReplyFromEvents(events);
    if (reply.text || reply.status) {
      return {
        sessionId: sessionEntry?.session?.session_id || "",
        ...reply,
      };
    }
  }
  return null;
}

function getTaskRuntimeBadge(task) {
  const adapter = task?.runtime_adapter || "";
  const probe = task?.app_server_probe_status || "";
  const attach = task?.app_server_attach_status || "";
  const bridge = task?.app_server_bridge_status || "";

  if (adapter === "codex-app-server" && probe === "ready" && attach === "attached" && bridge === "running") {
    return { label: "LIVE", className: "task-chip-live", title: "已连接真实 Codex 会话" };
  }
  if (adapter === "control-plane-stub") {
    return { label: "STUB", className: "task-chip-stub", title: "仅控制面占位会话，未连接真实 Codex" };
  }
  if (adapter || probe || attach || bridge) {
    return { label: "OFFLINE", className: "task-chip-offline", title: "真实会话未完成连接或已掉线" };
  }
  return { label: "IDLE", className: "task-chip-muted", title: "当前没有运行态连接信息" };
}

function getRecentRuntimeMessages(detail, latestReply, maxItems = 3) {
  const sessions = detail?.sessions || [];
  const runtime = getRuntime(detail);
  const primarySessionId = runtime?.index?.primary_session_id || "";
  const primarySession = sessions.find((sessionEntry) => sessionEntry?.session?.session_id === primarySessionId);
  if (!primarySession) return [];

  const sessionRecord = primarySession.session || {};
  const eventLog = getSessionPart(primarySession, "event_log");
  const events = eventLog?.events || [];
  const items = [];

  for (const event of events) {
    if (event.kind === "user" && event.scope === "user" && event.summary) {
      items.push({
        role: "user",
        text: String(event.summary),
        timestamp: event.timestamp || "",
      });
    }
  }

  const assistantText = String(sessionRecord.latest_assistant_text || latestReply?.text || "").trim();
  const assistantAt = sessionRecord.latest_assistant_at || latestReply?.timestamp || "";
  if (assistantText) {
    items.push({
      role: "assistant",
      text: assistantText,
      timestamp: assistantAt,
    });
  }

  items.sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || "")));
  return items.slice(-maxItems);
}

function getEffectiveStage(detail, task = null) {
  return getTaskMemoryIndex(detail)?.current_stage || detail?.task?.stage || task?.stage || "";
}

function getEffectiveSummary(detail, task = null) {
  return getTaskMemoryIndex(detail)?.summary || task?.memory_summary || detail?.task?.summary || task?.summary || "-";
}

function getEffectiveBlockers(detail, task = null) {
  const memoryBlockers = getTaskMemoryIndex(detail)?.current_blockers;
  if (memoryBlockers?.length) return memoryBlockers;
  return detail?.task?.blocker_kinds || task?.blocker_kinds || [];
}

function hasEffectiveBlockers(detail, task = null) {
  return getEffectiveBlockers(detail, task).length > 0 || detail?.task?.blocked || task?.blocked || false;
}

function getEffectiveNextStep(detail, task = null) {
  return getTaskMemoryIndex(detail)?.recommended_next_step || task?.recommended_next_step || "-";
}

function getEffectivePendingVerification(detail, task = null) {
  const fromMemory = getTaskMemoryIndex(detail)?.pending_verification_count;
  if (typeof fromMemory === "number") return fromMemory;
  return task?.pending_verification_count ?? 0;
}

function buildHandoffPacketLegacy(task, detail) {
  const mode = getEffectiveHandoffMode(detail);
  const recommendedMode = recommendHandoffMode(task.stage);
  const activePhase = findActivePhase(detail);
  const gateReason = getAdvanceGateReason(detail);
  const decisions = detail.decisions || [];
  const experiments = detail.experiments || [];
  const findings = detail.findings || [];
  const confirmedDecisions = decisions.filter((decision) => decision.status === "confirmed");
  const executedExperiments = experiments.filter((experiment) => experiment.status && experiment.status !== "planned");

  const currentJudgment = mode === "execute"
    ? "这轮更适合直接落地执行，并把结果继续回写控制面。"
    : "这轮更适合先讨论、澄清或重构思路，再决定是否执行。";
  const permissionLine = mode === "execute"
    ? "允许在当前任务边界内推进实现或执行动作，但不要越过控制面已有约束。"
    : "本轮以分析、梳理、建议和提问为主，不默认直接改动或执行。";

  const nextStep = gateReason
    ? `先补齐推进条件：${gateReason}`
    : mode === "execute"
      ? "围绕当前阶段直接推进，并把关键记录回写到任务中心。"
      : "先输出结构化判断、风险和下一步建议，再等你确认是否进入执行。";

  const primaryRisk = gateReason
    ? `当前最大风险是状态和证据脱节：${gateReason}`
    : task.stage === "execution"
      ? "执行动作如果不及时回写实验和结论，控制面会再次失真。"
      : "在没有补齐上下文的情况下过早执行，会让阶段推进和真实工作脱节。";

  const completedItems = [
    confirmedDecisions.length ? `已确认决策 ${confirmedDecisions.length} 条` : "",
    detail.plan ? `已有计划记录（${localizeStatus(detail.plan.status)}）` : "",
    detail.phases?.length ? `已创建 phase ${detail.phases.length} 条` : "",
  ].filter(Boolean);

  const outstandingItems = [
    gateReason || "",
    experiments.some((experiment) => experiment.status === "planned") ? "仍有 planned 状态的实验记录未落地执行" : "",
    findings.length === 0 ? "还没有 finding 记录" : "",
  ].filter(Boolean);

  const keyRecords = [
    `任务：${task.task_id}`,
    detail.plan ? `计划：${detail.plan.path}` : "",
    activePhase ? `当前 phase：${activePhase.path}` : "",
    confirmedDecisions[0] ? `最近确认决策：${confirmedDecisions[0].path}` : "",
    experiments[0] ? `实验记录：${experiments[0].path}` : "",
  ].filter(Boolean);

  const codexStartMessage = [
    `你正在接手任务 ${task.task_id}（${task.title}）。`,
    `当前主阶段是${formatMainStage(task.stage)}，当前 phase 是 ${formatCurrentPhase(activePhase)}。`,
    `本轮模式：${HANDOFF_MODE_LABELS[mode]}。`,
    `任务目标：${task.summary || "请先阅读任务定义。"}。`,
    completedItems.length ? `已完成：${completedItems.join("；")}。` : "",
    outstandingItems.length ? `待补齐：${outstandingItems.join("；")}。` : "",
    `本轮建议：${nextStep}`,
    `约束：${permissionLine}`,
    keyRecords.length ? `优先阅读这些记录：${keyRecords.join("；")}。` : "",
    mode === "execute"
      ? "请直接推进当前阶段最合适的一步，并把新的决策、实验、结论或阻塞回写到任务中心。"
      : "请先输出你的判断、风险、建议下一步，以及是否需要我确认后再进入执行。",
  ].filter(Boolean).join("\n");

  return {
    mode,
    recommendedMode,
    activePhase,
    currentJudgment,
    permissionLine,
    nextStep,
    primaryRisk,
    completedItems,
    outstandingItems,
    keyRecords,
    codexStartMessage,
  };
}

function findActivePhase(detail) {
  if (!detail?.phases?.length) return null;
  const activePhaseId = detail.task?.active_phase_id;
  if (activePhaseId) {
    const matched = detail.phases.find((phase) => phase.phase_id === activePhaseId);
    if (matched) return matched;
  }
  return detail.phases.find((phase) => phase.status === "open" || phase.status === "running") || detail.phases[0];
}

function taskLabel(task) {
  const bits = [formatMainStage(task.stage)];
  if (task.blocked) bits.push("阻塞");
  if (task.paused) bits.push("暂停");
  if (task.terminal_state) bits.push(task.terminal_state);
  return bits.filter(Boolean).join(" · ");
}

async function loadIndexes() {
  const [overview, tasksPayload, knowledgePayload, accountsPayload, machinesPayload] = await Promise.all([
    fetchJson(`${INDEX_ROOT}/overview.json`),
    fetchJson(`${INDEX_ROOT}/tasks.json`),
    fetchJson(`${INDEX_ROOT}/knowledge.json`),
    fetchJson(`${INDEX_ROOT}/accounts.json`),
    fetchJson(`${INDEX_ROOT}/machines.json`),
  ]);

  state.overview = overview;
  state.tasks = tasksPayload.tasks ?? [];
  state.knowledge = knowledgePayload.entries ?? [];
  state.accounts = accountsPayload.accounts ?? [];
  state.machines = machinesPayload.machines ?? [];

  if (!state.selectedTaskId || !state.tasks.some((task) => task.task_id === state.selectedTaskId)) {
    state.selectedTaskId = state.tasks[0]?.task_id ?? null;
  }
}

async function ensureTaskDetail(taskId) {
  if (!taskId) return null;
  if (!state.taskDetails.has(taskId)) {
    const detail = await fetchJson(`${INDEX_ROOT}/task-details/${taskId}.json`);
    state.taskDetails.set(taskId, detail);
  }
  return state.taskDetails.get(taskId);
}

function renderTaskListLegacy() {
  elements.taskCountBadge.textContent = String(state.tasks.length);
  elements.taskList.innerHTML = "";

  if (!state.tasks.length) {
    elements.taskList.append(emptyNode("还没有任务"));
    return;
  }

  state.tasks.forEach((task, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-item${task.task_id === state.selectedTaskId ? " is-active" : ""}`;
    button.style.animationDelay = `${index * 50}ms`;
    button.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.summary ?? "还没有摘要。"}</p>
      <div class="task-meta">
        <span class="badge">${task.priority || "-"}</span>
        <span class="badge">${task.pending_decision_count || 0} 个决策</span>
      </div>
      <p class="mini-note">${taskLabel(task)}</p>
    `;
    button.addEventListener("click", async () => {
      state.selectedTaskId = task.task_id;
      state.handoffModeOverride = null;
      renderTaskStrip();
      await renderTaskDetail();
    });
    elements.taskList.append(button);
  });
}

function renderMiniCards(container, items, builder, emptyMessage) {
  container.innerHTML = "";
  if (!items.length) {
    container.append(emptyNode(emptyMessage));
    return;
  }
  items.forEach((item) => container.append(builder(item)));
}

function updateCreateTaskControls() {
  elements.createTaskPanel.hidden = !state.createTaskPanelExpanded;
  elements.toggleCreateTaskButton.textContent = state.createTaskPanelExpanded ? "收起新建" : "新建任务";
  elements.toggleCreateTaskButton.classList.toggle("is-active", state.createTaskPanelExpanded);

  const accountSelect = elements.createTaskAccount;
  const machineSelect = elements.createTaskMachine;

  accountSelect.innerHTML = "";
  state.accounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = account.account_id;
    option.textContent = `${account.title} (${account.account_id})`;
    if (account.is_default) {
      option.selected = true;
    }
    accountSelect.append(option);
  });

  machineSelect.innerHTML = "";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "不绑定机器";
  machineSelect.append(noneOption);
  state.machines.forEach((machine) => {
    const option = document.createElement("option");
    option.value = machine.machine_id;
    option.textContent = `${machine.title} (${machine.machine_id})`;
    machineSelect.append(option);
  });
}

function renderOverview() {
  const counts = state.overview?.counts ?? {};
  elements.activeTaskCount.textContent = String(counts.active_tasks ?? 0);
  elements.pendingDecisionCount.textContent = String(counts.pending_decisions ?? 0);
  elements.machineCount.textContent = String(counts.machines ?? 0);
  elements.knowledgeCount.textContent = String(counts.knowledge_entries ?? 0);
  elements.decisionBadge.textContent = String(state.overview?.pending_decisions?.length ?? 0);

  renderMiniCards(
    elements.accountList,
    state.accounts,
    (account) => {
      const div = document.createElement("div");
      div.className = "mini-card";
      div.innerHTML = `
        <span class="mini-label">${account.provider}</span>
        <strong>${account.title}</strong>
        <p>${account.quota_notes || "还没有额度备注。"}</p>
      `;
      return div;
    },
    "还没有账号",
  );

  renderMiniCards(
    elements.machineList,
    state.machines,
    (machine) => {
      const div = document.createElement("div");
      div.className = "mini-card";
      div.innerHTML = `
        <span class="mini-label">${machine.platform}</span>
        <strong>${machine.title}</strong>
        <p>${machine.gpu_summary || "还没有 GPU 摘要。"}</p>
      `;
      return div;
    },
    "还没有机器",
  );

  renderMiniCards(
    elements.decisionList,
    state.overview?.pending_decisions ?? [],
    (decision) => {
      const div = document.createElement("div");
      div.className = "stack-card";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ghost-button inline-button";
      button.textContent = "处理";
      button.addEventListener("click", async () => {
        state.selectedTaskId = decision.task_id;
        renderTaskStrip();
        await renderTaskDetail();
      });
      div.innerHTML = `
        <h3>${decision.title}</h3>
        <p>任务：<span class="inline-code">${decision.task_id}</span></p>
        <div class="status-line"><span class="status-dot pending"></span>${localizeStatus(decision.status)} · ${formatDate(decision.updated_at)}</div>
      `;
      div.append(button);
      return div;
    },
    "当前没有待决策事项",
  );

  renderMiniCards(
    elements.findingList,
    state.overview?.recent_findings ?? [],
    (finding) => {
      const div = document.createElement("div");
      div.className = "stack-card";
      div.innerHTML = `
        <h3>${finding.title}</h3>
        <p>${finding.finding_kind || "结论"} · ${finding.stability || "稳定性未知"}</p>
        <div class="status-line"><span class="status-dot"></span>${formatDate(finding.updated_at)}</div>
      `;
      return div;
    },
    "还没有记录结论",
  );

  renderMiniCards(
    elements.timelineList,
    state.overview?.timeline ?? [],
    (event) => {
      const div = document.createElement("div");
      div.className = "timeline-item";
      div.innerHTML = `
        <h3>${event.title}</h3>
        <p>${event.kind === "task-update" ? formatMainStage(event.stage) : event.kind}</p>
        <div class="status-line"><span class="status-dot"></span>${formatDate(event.updated_at)}</div>
      `;
      return div;
    },
    "还没有时间线事件",
  );
}

function renderMetaGridLegacy(task) {
  const cards = [
    { label: "任务 ID", value: task.task_id },
    { label: "账号", value: task.assignee_account_id || "-" },
    { label: "阻塞类型", value: formatList(task.blocker_kinds || [], BLOCKER_LABELS) },
    { label: "机器 ID", value: formatList(task.machine_ids || []) },
    { label: "成功判据", list: task.success_criteria || [] },
    { label: "未知项", list: task.unknowns || [] },
  ];

  elements.taskMeta.innerHTML = "";
  cards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "meta-card";
    if (card.list) {
      div.innerHTML = `<span class="meta-label">${card.label}</span>`;
      const list = document.createElement("ul");
      list.className = "meta-list";
      if (!card.list.length) {
        const item = document.createElement("li");
        item.textContent = "无";
        list.append(item);
      } else {
        card.list.forEach((value) => {
          const item = document.createElement("li");
          item.textContent = value;
          list.append(item);
        });
      }
      div.append(list);
    } else {
      div.innerHTML = `<span class="meta-label">${card.label}</span><strong>${card.value}</strong>`;
    }
    elements.taskMeta.append(div);
  });
}

async function handleDecisionConfirm(taskId, decision, optionSelect, customInput, confirmerInput, button) {
  const selectedOption = customInput.value.trim() || optionSelect.value;
  const confirmedBy = confirmerInput.value.trim() || "user";
  if (!selectedOption) {
    window.alert("请先选择或填写确认内容。");
    return;
  }

  button.disabled = true;
  const previousLabel = button.textContent;
  button.textContent = "提交中...";

  try {
    await postJson("/api/decisions/confirm", {
      task_id: taskId,
      decision_id: decision.decision_id,
      selected_option: selectedOption,
      confirmed_by: confirmedBy,
    });
    state.taskDetails.clear();
    await renderApp();
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

async function handleAdvanceStage(task, button) {
  if (!task?.task_id) return;

  button.disabled = true;
  const previousLabel = button.textContent;
  button.textContent = "推进中...";

  try {
    await postJson("/api/tasks/advance-stage", {
      task_id: task.task_id,
      advanced_by: "user",
    });
    state.taskDetails.clear();
    await renderApp();
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

async function handleRuntimeMutation(path, payload, button, successMessage = "") {
  if (button) {
    button.disabled = true;
  }
  const previousLabel = button?.textContent || "";
  if (button) {
    button.textContent = "处理中...";
  }

  try {
    const result = await postJson(path, payload);
    if (result?.turn_status) {
      elements.runtimeHint.textContent = `消息已发送到真实 Codex 会话。turn=${result.turn_status}`;
    } else if (successMessage) {
      elements.runtimeHint.textContent = typeof successMessage === "function" ? successMessage(result) : successMessage;
    }
    state.taskDetails.clear();
    await renderApp();
    return result;
  } catch (error) {
    window.alert(error.message);
    state.taskDetails.clear();
    await renderApp();
    throw error;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }
}

function renderRuntimePanel(task, detail) {
  elements.runtimePanel.innerHTML = "";

  if (!task || !detail?.task) {
    elements.runtimePanel.append(emptyNode("先选择一个任务，再查看运行时"));
    elements.runtimeHint.textContent = "先探测 App Server，再附加主会话。附加成功后，交接包和消息会通过真实 Codex thread 发出，主会话按钮仍保留 control-plane stub 作为回退。";
    elements.runtimeProbeButton.disabled = true;
    elements.runtimeAttachButton.disabled = true;
    elements.runtimeProbeStopButton.disabled = true;
    elements.runtimeStartButton.disabled = true;
    elements.runtimeStopButton.disabled = true;
    elements.runtimeReconnectButton.disabled = true;
    elements.runtimeSendHandoffButton.disabled = true;
    elements.runtimeSendMessageButton.disabled = true;
    elements.runtimeMessageInput.disabled = true;
    return;
  }

  const runtime = getRuntime(detail);
  const runtimeIndex = runtime?.index || null;
  const runtimeStatus = runtime?.status || null;
  const primarySessionId = runtimeIndex?.primary_session_id || "-";
  const currentStatus = runtimeIndex?.runtime_status || "idle";
  const sessionStatus = runtimeIndex?.session_status || "-";
  const currentMode = runtimeIndex?.current_mode || recommendHandoffMode(getEffectiveStage(detail, task));
  const currentFocus = runtimeIndex?.current_focus || "-";
  const lastEventAt = runtimeIndex?.last_event_at || "";
  const lastError = runtimeIndex?.last_error_summary || runtimeStatus?.last_error_detail || "-";
  const runtimeAdapter = runtimeIndex?.runtime_adapter || runtimeStatus?.runtime_adapter || "-";
  const appServerStatus = runtimeIndex?.app_server_probe_status || runtimeStatus?.app_server_probe_status || "not-probed";
  const appServerOwner = runtimeIndex?.app_server_process_owner || runtimeStatus?.app_server_process_owner || runtime?.launch?.app_server_process_owner || "none";
  const runtimeLauncherUrl = runtimeIndex?.runtime_launcher_url || runtimeStatus?.runtime_launcher_url || runtime?.launch?.runtime_launcher_url || "";
  const appServerPort = runtimeIndex?.app_server_port || runtimeStatus?.app_server_port || 0;
  const appServerWsUrl = runtimeIndex?.app_server_ws_url || runtimeStatus?.app_server_ws_url || "";
  const appServerPid = runtimeIndex?.app_server_pid || runtimeStatus?.app_server_pid || 0;
  const appServerLastProbeAt = runtimeIndex?.app_server_last_probe_at || "";
  const appServerReady = Boolean(runtimeStatus?.app_server_ready);
  const appServerHealthy = Boolean(runtimeStatus?.app_server_healthy);
  const appServerReadyUrl = runtimeStatus?.app_server_ready_url || "";
  const appServerHealthUrl = runtimeStatus?.app_server_health_url || "";
  const appServerProbeError = runtimeStatus?.app_server_probe_error || "-";
  const appServerAttachStatus = runtimeIndex?.app_server_attach_status || runtimeStatus?.app_server_attach_status || "not-attached";
  const appServerThreadId = runtimeIndex?.app_server_thread_id || runtimeStatus?.app_server_thread_id || "";
  const appServerThreadPath = runtimeStatus?.app_server_thread_path || runtime?.launch?.app_server_thread_path || "";
  const appServerLastAttachAt = runtimeIndex?.app_server_last_attach_at || runtime?.launch?.last_attach_at || "";
  const bridgeStatus = runtimeIndex?.app_server_bridge_status || runtimeStatus?.app_server_bridge_status || "not-started";
  const bridgePid = runtimeIndex?.app_server_bridge_pid || runtimeStatus?.app_server_bridge_pid || runtime?.launch?.app_server_bridge_pid || 0;
  const bridgeLastSeenAt = runtimeIndex?.app_server_bridge_last_seen_at || runtimeStatus?.app_server_bridge_last_seen_at || "";
  const bridgeError = runtimeStatus?.app_server_bridge_error || "-";
  const bridgeStdoutLog = runtime?.launch?.app_server_bridge_stdout_log || "";
  const bridgeStderrLog = runtime?.launch?.app_server_bridge_stderr_log || "";
  const sendGate = getRuntimeSendGate(detail);
  const latestReply = getLatestAssistantReply(detail);
  const recentMessages = getRecentRuntimeMessages(detail, latestReply, 3);

  const card = document.createElement("div");
  card.className = "stack-card";
  card.innerHTML = `
    <h3>当前运行态</h3>
    <div class="meta-grid">
      <div class="meta-card compact">
        <span class="meta-label">运行态</span>
        <strong>${escapeHtml(localizeStatus(currentStatus))}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">主会话</span>
        <strong>${escapeHtml(primarySessionId)}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">会话状态</span>
        <strong>${escapeHtml(localizeStatus(sessionStatus))}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">模式</span>
        <strong>${escapeHtml(HANDOFF_MODE_LABELS[currentMode] || currentMode || "-")}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">适配器</span>
        <strong>${escapeHtml(runtimeAdapter)}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">当前焦点</span>
        <strong>${escapeHtml(currentFocus)}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">最近事件</span>
        <strong>${escapeHtml(formatDate(lastEventAt))}</strong>
      </div>
    </div>
    <p class="mini-note">最近错误：${escapeHtml(lastError)}</p>
  `;
  elements.runtimePanel.append(card);

  const appServerCard = document.createElement("div");
  appServerCard.className = "stack-card";
  appServerCard.innerHTML = `
    <h3>App Server 探测</h3>
    <div class="meta-grid">
      <div class="meta-card compact">
        <span class="meta-label">探测状态</span>
        <strong>${escapeHtml(localizeStatus(appServerStatus))}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">进程归属</span>
        <strong>${escapeHtml(appServerOwner || "-")}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">端口</span>
        <strong>${escapeHtml(appServerPort ? String(appServerPort) : "-")}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">进程 PID</span>
        <strong>${escapeHtml(appServerPid ? String(appServerPid) : "-")}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">Ready / Health</span>
        <strong>${escapeHtml(`${appServerReady ? "ready" : "not-ready"} / ${appServerHealthy ? "healthy" : "not-healthy"}`)}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">附加状态</span>
        <strong>${escapeHtml(localizeStatus(appServerAttachStatus))}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">Bridge 状态</span>
        <strong>${escapeHtml(localizeStatus(bridgeStatus))}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">WS 地址</span>
        <strong>${escapeHtml(appServerWsUrl || "-")}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">最近探测</span>
        <strong>${escapeHtml(formatDate(appServerLastProbeAt))}</strong>
      </div>
      <div class="meta-card compact">
        <span class="meta-label">Bridge PID</span>
        <strong>${escapeHtml(bridgePid ? String(bridgePid) : "-")}</strong>
      </div>
    </div>
    <p class="mini-note">thread：${escapeHtml(appServerThreadId || "-")}</p>
    <p class="mini-note">thread path：${escapeHtml(appServerThreadPath || "-")}</p>
    <p class="mini-note">最近附加：${escapeHtml(formatDate(appServerLastAttachAt))}</p>
    <p class="mini-note">Bridge 最近事件：${escapeHtml(formatDate(bridgeLastSeenAt))}</p>
    <p class="mini-note">readyz：${escapeHtml(appServerReadyUrl || "-")}</p>
    <p class="mini-note">healthz：${escapeHtml(appServerHealthUrl || "-")}</p>
    <p class="mini-note">Launcher：${escapeHtml(runtimeLauncherUrl || "-")}</p>
    <p class="mini-note">探测错误：${escapeHtml(appServerProbeError)}</p>
    <p class="mini-note">Bridge 错误：${escapeHtml(bridgeError)}</p>
    <p class="mini-note">Bridge stdout：${escapeHtml(bridgeStdoutLog || "-")}</p>
    <p class="mini-note">Bridge stderr：${escapeHtml(bridgeStderrLog || "-")}</p>
  `;
  elements.runtimePanel.append(appServerCard);

  const replyCard = document.createElement("div");
  replyCard.className = "stack-card runtime-reply-card";
  if (latestReply) {
    replyCard.innerHTML = `
      <h3>最新回复</h3>
      <p class="runtime-reply-text">${escapeHtml(latestReply.text || "这次 turn 没有产生 assistant 文本回复。")}</p>
      <div class="meta-grid">
        <div class="meta-card compact">
          <span class="meta-label">会话</span>
          <strong>${escapeHtml(latestReply.sessionId || primarySessionId)}</strong>
        </div>
        <div class="meta-card compact">
          <span class="meta-label">结果</span>
          <strong>${escapeHtml(latestReply.status || "-")}</strong>
        </div>
        <div class="meta-card compact">
          <span class="meta-label">时间</span>
          <strong>${escapeHtml(formatDate(latestReply.timestamp))}</strong>
        </div>
      </div>
    `;
  } else {
    replyCard.innerHTML = `
      <h3>最新回复</h3>
      <p class="runtime-reply-empty">当前还没有来自真实 Codex 会话的回复。</p>
      <p class="mini-note">只有在真实会话可用时发送消息，回复才会出现在这里。</p>
    `;
  }
  elements.runtimePanel.append(replyCard);
  if (latestReply) {
    const historyItems = recentMessages
      .filter((item) => !(item.role === "assistant" && item.text === latestReply.text && item.timestamp === latestReply.timestamp))
      .map(
        (item) => `
          <article class="chat-bubble chat-bubble-${item.role}">
            <div class="chat-bubble-meta">
              <span>${item.role === "assistant" ? "Codex" : "你"}</span>
              <span>${escapeHtml(formatDate(item.timestamp))}</span>
            </div>
            <p>${escapeHtml(item.text)}</p>
          </article>
        `,
      )
      .join("");
    replyCard.innerHTML = `
      <h3>最新回复</h3>
      <article class="chat-bubble chat-bubble-assistant chat-bubble-primary">
        <div class="chat-bubble-meta">
          <span>Codex</span>
          <span>${escapeHtml(formatDate(latestReply.timestamp))}</span>
        </div>
        <p class="runtime-reply-text">${escapeHtml(latestReply.text || "这次 turn 没有产生 assistant 文本回复。")}</p>
      </article>
      <div class="meta-grid">
        <div class="meta-card compact">
          <span class="meta-label">会话</span>
          <strong>${escapeHtml(latestReply.sessionId || primarySessionId)}</strong>
        </div>
        <div class="meta-card compact">
          <span class="meta-label">结果</span>
          <strong>${escapeHtml(latestReply.status || "-")}</strong>
        </div>
        <div class="meta-card compact">
          <span class="meta-label">时间</span>
          <strong>${escapeHtml(formatDate(latestReply.timestamp))}</strong>
        </div>
      </div>
      <div class="runtime-chat-history">
        <div class="runtime-chat-history-head">最近消息</div>
        ${historyItems || '<p class="runtime-chat-history-empty">这次回复前没有更新的文本消息。</p>'}
      </div>
    `;
  } else {
    replyCard.innerHTML = `
      <h3>最新回复</h3>
      <article class="chat-bubble chat-bubble-empty">
        <div class="chat-bubble-meta">
          <span>Codex</span>
        </div>
        <p class="runtime-reply-empty">当前还没有来自真实 Codex 会话的回复。</p>
      </article>
      <p class="mini-note">只有在真实会话可用时发送消息，回复才会出现在这里。</p>
    `;
  }

  const history = runtime?.history;
  if (history?.events?.length) {
    const historyCard = document.createElement("div");
    historyCard.className = "stack-card";
    historyCard.innerHTML = `
      <h3>最近运行历史</h3>
      <ul class="handoff-list">
        ${history.events.slice(0, 5).map((event) => `<li>${escapeHtml(`${formatDate(event.timestamp)} / ${event.kind} / ${event.summary}`)}</li>`).join("")}
      </ul>
    `;
    elements.runtimePanel.append(historyCard);
  }

  elements.runtimeHint.textContent = runtimeStatus?.last_event_summary
    || "先探测 App Server，再附加主会话。附加成功后，交接包和消息会通过真实 Codex thread 发出，主会话按钮仍保留 control-plane stub 作为回退。";

  const canProbeAppServer = ["not-probed", "stopped", "error", ""].includes(appServerStatus);
  const canAttachAppServer = appServerStatus === "ready" && ["not-attached", "error", ""].includes(appServerAttachStatus);
  const canStopAppServer = appServerPid > 0 && ["starting", "ready"].includes(appServerStatus);
  const canStart = !runtimeIndex || ["idle", "stopped", "error"].includes(currentStatus);
  const canStop = !!runtimeIndex?.primary_session_id && !["idle", "stopped"].includes(currentStatus);
  const canReconnect = !!runtimeIndex?.primary_session_id;
  elements.runtimeHint.textContent = sendGate.canSend
    ? `已连接真实 Codex 会话。${runtimeStatus?.last_event_summary || "现在可以安全发送消息。"}`
    : sendGate.reason;
  const canSend = sendGate.canSend;

  elements.runtimeProbeButton.disabled = !canProbeAppServer;
  elements.runtimeAttachButton.disabled = !canAttachAppServer;
  elements.runtimeProbeStopButton.disabled = !canStopAppServer;
  elements.runtimeStartButton.disabled = !canStart;
  elements.runtimeStopButton.disabled = !canStop;
  elements.runtimeReconnectButton.disabled = !canReconnect;
  elements.runtimeSendHandoffButton.disabled = !canSend;
  elements.runtimeSendMessageButton.disabled = !canSend;
  elements.runtimeMessageInput.disabled = false;
}

async function handleCreateTask(button) {
  const title = elements.createTaskTitle.value.trim();
  const shortName = elements.createTaskShortName.value.trim();
  const summary = elements.createTaskSummary.value.trim();
  const priority = elements.createTaskPriority.value;
  const accountId = elements.createTaskAccount.value;
  const machineId = elements.createTaskMachine.value;

  if (!title) {
    window.alert("请先填写任务标题。");
    return;
  }
  if (!summary) {
    window.alert("请先填写任务摘要。");
    return;
  }

  button.disabled = true;
  const previousLabel = button.textContent;
  button.textContent = "创建中...";

  try {
    const result = await postJson("/api/tasks/create", {
      title,
      short_name: shortName,
      summary,
      priority,
      account_id: accountId,
      machine_id: machineId,
    });
    state.selectedTaskId = result.task_id;
    state.handoffModeOverride = null;
    state.createTaskPanelExpanded = false;
    elements.createTaskTitle.value = "";
    elements.createTaskShortName.value = "";
    elements.createTaskSummary.value = "";
    elements.createTaskPriority.value = "P2";
    state.taskDetails.clear();
    await renderApp();
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

function buildDecisionAction(taskId, decision) {
  if (decision.status !== "pending" && !decision.needs_user_confirmation) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "decision-action";

  const select = document.createElement("select");
  select.className = "field-input";
  (decision.options || []).forEach((option) => {
    const optionEl = document.createElement("option");
    optionEl.value = option;
    optionEl.textContent = option;
    select.append(optionEl);
  });

  const customInput = document.createElement("textarea");
  customInput.className = "field-input field-textarea";
  customInput.placeholder = "如果你要确认一个更具体的选择，可以在这里直接填写。";

  const confirmerInput = document.createElement("input");
  confirmerInput.className = "field-input";
  confirmerInput.value = "user";
  confirmerInput.placeholder = "确认人";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-button inline-button";
  button.textContent = "确认决策";
  button.addEventListener("click", () => handleDecisionConfirm(taskId, decision, select, customInput, confirmerInput, button));

  wrapper.append(select, customInput, confirmerInput, button);
  return wrapper;
}

function renderPlanPanel(detail) {
  elements.planPanel.innerHTML = "";
  if (!detail) {
    elements.planPanel.append(emptyNode("还没有任务详情"));
    return;
  }

  const plan = detail.plan;
  if (plan) {
    const planCard = document.createElement("div");
    planCard.className = "stack-card";
    planCard.innerHTML = `
      <h3>${plan.title}</h3>
      <p>${plan.summary || "还没有计划摘要。"}</p>
      <div class="status-line"><span class="status-dot"></span>${localizeStatus(plan.status)} · ${plan.plan_version || "-"}</div>
    `;
    elements.planPanel.append(planCard);
  }

  if (detail.phases?.length) {
    detail.phases.forEach((phase) => {
      const phaseCard = document.createElement("div");
      phaseCard.className = "stack-card";
      phaseCard.innerHTML = `
        <h3>${phase.title}</h3>
        <p>${phase.summary || "还没有阶段摘要。"}</p>
        <div class="meta-grid">
          <div class="meta-card compact">
            <span class="meta-label">phase 类型</span>
            <strong>${localizePhaseKind(phase.phase_kind)}</strong>
          </div>
          <div class="meta-card compact">
            <span class="meta-label">phase 状态</span>
            <strong>${localizePhaseStatus(phase.status)}</strong>
          </div>
        </div>
      `;
      elements.planPanel.append(phaseCard);
    });
  }

  if (detail.decisions?.length) {
    detail.decisions.forEach((decision) => {
      const decisionCard = document.createElement("div");
      decisionCard.className = "stack-card";
      decisionCard.innerHTML = `
        <h3>${decision.title}</h3>
        <p>${decision.summary || decision.question || "还没有决策摘要。"}</p>
        <div class="status-line"><span class="status-dot pending"></span>${localizeStatus(decision.status)}</div>
      `;
      const action = buildDecisionAction(detail.task.task_id, decision);
      if (action) {
        decisionCard.append(action);
      }
      elements.planPanel.append(decisionCard);
    });
  }
}

function renderExperimentPanel(detail) {
  elements.experimentPanel.innerHTML = "";
  if (!detail?.experiments?.length) {
    elements.experimentPanel.append(emptyNode("还没有实验记录"));
    return;
  }

  detail.experiments.forEach((experiment) => {
    const card = document.createElement("div");
    card.className = "experiment-card";
    card.innerHTML = `
      <h3>${experiment.title}</h3>
      <p>${experiment.summary || "还没有实验摘要。"}</p>
      <div class="meta-grid">
        <div class="meta-card">
          <span class="meta-label">状态</span>
          <strong>${localizeStatus(experiment.status)}</strong>
        </div>
        <div class="meta-card">
          <span class="meta-label">机器</span>
          <strong>${experiment.machine_id || "-"}</strong>
        </div>
        <div class="meta-card">
          <span class="meta-label">产物</span>
          <strong>${experiment.primary_artifact || experiment.primary_artifact_reason || "-"}</strong>
        </div>
        <div class="meta-card">
          <span class="meta-label">更新时间</span>
          <strong>${formatDate(experiment.updated_at)}</strong>
        </div>
      </div>
    `;
    elements.experimentPanel.append(card);
  });
}

function createProcessEvent(kind, title, timestamp, summary, details = [], detailedOnly = false) {
  return {
    kind,
    title,
    timestamp,
    summary,
    details: details.filter(Boolean),
    detailedOnly,
  };
}

function buildProcessEventsLegacy(detail) {
  if (!detail?.task) return [];

  const events = [];
  const task = detail.task;

  events.push(
    createProcessEvent(
      "task",
      "任务状态更新",
      task.updated_at || task.created_at,
      `主阶段：${formatMainStage(task.stage)}；阻塞：${task.blocked ? formatList(task.blocker_kinds || [], BLOCKER_LABELS) : "无"}`,
      [
        `优先级：${task.priority || "-"}`,
        `机器：${formatList(task.machine_ids || [])}`,
        `账号：${task.assignee_account_id || "-"}`,
        `路径：${task.path || "-"}`,
      ],
      true,
    ),
  );

  if (detail.plan) {
    events.push(
      createProcessEvent(
        "plan",
        detail.plan.title || "计划记录",
        detail.plan.updated_at || detail.plan.created_at,
        `${localizeStatus(detail.plan.status)} · ${detail.plan.plan_version || "未标注版本"}`,
        [detail.plan.summary, `路径：${detail.plan.path || "-"}`],
      ),
    );
  }

  (detail.phases || []).forEach((phase) => {
    events.push(
      createProcessEvent(
        "phase",
        phase.title || "Phase",
        phase.ended_at || phase.started_at || phase.updated_at,
        `${localizePhaseKind(phase.phase_kind)} / ${localizePhaseStatus(phase.status)}`,
        [
          phase.summary,
          phase.started_at ? `开始：${formatDate(phase.started_at)}` : "",
          phase.ended_at ? `结束：${formatDate(phase.ended_at)}` : "",
          `路径：${phase.path || "-"}`,
        ],
      ),
    );
  });

  (detail.decisions || []).forEach((decision) => {
    const decisionSummary = decision.status === "confirmed"
      ? `已确认 · ${decision.selected_option || "已记录选择"}`
      : `${localizeStatus(decision.status)} · ${decision.question || "等待处理"}`;
    events.push(
      createProcessEvent(
        "decision",
        decision.title || "决策",
        decision.updated_at || decision.created_at,
        decisionSummary,
        [
          decision.question ? `问题：${decision.question}` : "",
          decision.confirmed_by ? `确认人：${decision.confirmed_by}` : "",
          decision.selected_option ? `选择：${decision.selected_option}` : "",
          decision.path ? `路径：${decision.path}` : "",
        ],
      ),
    );
  });

  (detail.experiments || []).forEach((experiment) => {
    events.push(
      createProcessEvent(
        "experiment",
        experiment.title || "实验记录",
        experiment.updated_at || experiment.created_at,
        `${localizeStatus(experiment.status)} · 机器 ${experiment.machine_id || "-"}`,
        [
          experiment.summary,
          experiment.primary_artifact ? `主产物：${experiment.primary_artifact}` : "",
          experiment.primary_artifact_reason ? `产物说明：${experiment.primary_artifact_reason}` : "",
          experiment.path ? `路径：${experiment.path}` : "",
        ],
      ),
    );
  });

  (detail.findings || []).forEach((finding) => {
    events.push(
      createProcessEvent(
        "finding",
        finding.title || "关键结论",
        finding.updated_at || finding.created_at,
        `${finding.finding_kind || "结论"} · ${finding.stability || "稳定性未标注"}`,
        [finding.summary, finding.path ? `路径：${finding.path}` : ""],
      ),
    );
  });

  events.sort((left, right) => {
    const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
    const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
    return rightTime - leftTime;
  });

  if (state.showDetailedEvents) {
    return events;
  }
  return events.filter((event) => !event.detailedOnly);
}

function renderProcessPanel(detail) {
  elements.processPanel.hidden = !state.processPanelExpanded;
  elements.processPanel.innerHTML = "";

  if (!state.processPanelExpanded) {
    return;
  }

  if (!detail?.task) {
    elements.processPanel.append(emptyNode("先选择一个任务，再查看过程流"));
    return;
  }

  const events = buildProcessEvents(detail);
  if (!events.length) {
    elements.processPanel.append(emptyNode("这个任务还没有可展示的过程事件"));
    return;
  }

  events.forEach((event) => {
    const card = document.createElement("div");
    card.className = "event-item";

    const detailList = event.details.length
      ? `<ul class="event-details">${event.details.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "";

    card.innerHTML = `
      <div class="event-topline">
        <span class="event-kind">${EVENT_KIND_LABELS[event.kind] || event.kind}</span>
        <span class="event-time">${formatDate(event.timestamp)}</span>
      </div>
      <h3>${event.title}</h3>
      <p class="event-summary">${event.summary || "没有附加摘要。"}</p>
      ${detailList}
    `;

    elements.processPanel.append(card);
  });
}

function updateProcessControls() {
  elements.processToggleButton.textContent = state.processPanelExpanded ? "收起过程流" : "展开过程流";
  elements.detailEventToggle.textContent = state.showDetailedEvents ? "隐藏详细事件" : "显示详细事件";
  elements.detailEventToggle.classList.toggle("is-active", state.showDetailedEvents);
}

function updateHandoffModeControls(detail) {
  const effectiveMode = detail?.task ? getEffectiveHandoffMode(detail) : null;
  const recommendedMode = detail?.task ? recommendHandoffMode(getEffectiveStage(detail)) : null;

  elements.handoffDiscussButton.classList.toggle("is-active", effectiveMode === "discuss");
  elements.handoffExecuteButton.classList.toggle("is-active", effectiveMode === "execute");

  elements.handoffDiscussButton.disabled = !detail?.task;
  elements.handoffExecuteButton.disabled = !detail?.task;
  elements.copyPromptButton.disabled = !detail?.task;

  if (!detail?.task) {
    elements.handoffModeHint.textContent = "系统会按当前阶段推荐交接模式，你也可以手动切换。";
    return;
  }

  const customMode = state.handoffModeOverride && state.handoffModeOverride !== recommendedMode;
  elements.handoffModeHint.textContent = customMode
    ? `当前使用${HANDOFF_MODE_LABELS[effectiveMode]}，系统原本推荐${HANDOFF_MODE_LABELS[recommendedMode]}。`
    : `系统当前推荐${HANDOFF_MODE_LABELS[effectiveMode]}，你也可以手动切换。`;
}

function renderHandoffPanelLegacy(task, detail) {
  elements.handoffPanel.innerHTML = "";

  if (!task || !detail?.task) {
    elements.handoffPanel.append(emptyNode("选择一个任务后，这里会生成交接包"));
    elements.copyPromptButton.onclick = null;
    updateHandoffModeControls(null);
    return;
  }

  const packet = buildHandoffPacket(task, detail);
  const card = document.createElement("div");
  card.className = "handoff-card";
  card.innerHTML = `
    <h3>短决策卡片</h3>
    <div class="handoff-kpi-grid">
      <div class="handoff-kpi">
        <span>当前阶段</span>
        <strong>${escapeHtml(formatMainStage(task.stage))}</strong>
      </div>
      <div class="handoff-kpi">
        <span>当前判断</span>
        <strong>${escapeHtml(packet.currentJudgment)}</strong>
      </div>
      <div class="handoff-kpi">
        <span>允许范围</span>
        <strong>${escapeHtml(packet.permissionLine)}</strong>
      </div>
      <div class="handoff-kpi">
        <span>建议下一步</span>
        <strong>${escapeHtml(packet.nextStep)}</strong>
      </div>
      <div class="handoff-kpi">
        <span>主要风险</span>
        <strong>${escapeHtml(packet.primaryRisk)}</strong>
      </div>
    </div>
  `;
  elements.handoffPanel.append(card);

  const detailBlock = document.createElement("details");
  detailBlock.className = "handoff-card handoff-details";
  detailBlock.innerHTML = `
    <summary>查看完整任务摘要</summary>
    <div class="handoff-sections">
      <section class="handoff-section">
        <h4>任务目标</h4>
        <p class="handoff-summary">${escapeHtml(task.summary || "还没有摘要。")}</p>
      </section>
      <section class="handoff-section">
        <h4>当前状态</h4>
        <ul class="handoff-list">
          <li>${escapeHtml(`主阶段：${formatMainStage(task.stage)}`)}</li>
          <li>${escapeHtml(`当前 phase：${formatCurrentPhase(packet.activePhase)}`)}</li>
          <li>${escapeHtml(`阻塞：${task.blocked ? formatList(task.blocker_kinds || [], BLOCKER_LABELS) : "无"}`)}</li>
          <li>${escapeHtml(`实验记录：${detail.experiments?.length || 0} 条，其中已执行 ${(detail.experiments || []).filter((item) => item.status && item.status !== "planned").length} 条`)}</li>
        </ul>
      </section>
      <section class="handoff-section">
        <h4>已完成</h4>
        <ul class="handoff-list">${(packet.completedItems.length ? packet.completedItems : ["目前没有显式完成项"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section class="handoff-section">
        <h4>未完成</h4>
        <ul class="handoff-list">${(packet.outstandingItems.length ? packet.outstandingItems : ["当前没有额外未完成项提示"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section class="handoff-section">
        <h4>关键记录</h4>
        <ul class="handoff-list">${(packet.keyRecords.length ? packet.keyRecords : ["暂无"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </div>
  `;
  elements.handoffPanel.append(detailBlock);

  const promptCard = document.createElement("div");
  promptCard.className = "handoff-card";
  promptCard.innerHTML = `
    <h3>可发给 Codex 的起始消息</h3>
    <pre class="prompt-box">${escapeHtml(packet.codexStartMessage)}</pre>
  `;
  elements.handoffPanel.append(promptCard);

  elements.copyPromptButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(packet.codexStartMessage);
      elements.copyPromptButton.textContent = "已复制";
      window.setTimeout(() => {
        elements.copyPromptButton.textContent = "复制起始消息";
      }, 1200);
    } catch (error) {
      window.alert("复制失败，请手动复制。");
    }
  };

  updateHandoffModeControls(detail);
}

function updateAdvanceControls(task, detail) {
  const button = elements.advanceStageButton;
  const hint = elements.taskNextStageHint;
  button.onclick = null;

  if (!task || !detail?.task) {
    hint.textContent = "选择一个任务后，这里会显示建议的下一步。";
    button.disabled = true;
    button.textContent = "推进到下一阶段";
    return;
  }

  const currentStage = getEffectiveStage(detail, task);
  const nextStage = getNextStage(currentStage);
  const gateReason = getAdvanceGateReason(detail);
  if (task.terminal_state) {
    hint.textContent = `这个任务已经处于终态：${task.terminal_state}。`;
    button.disabled = true;
    button.textContent = "无法继续推进";
    return;
  }

  if (!nextStage) {
    hint.textContent = "当前已在最后一个活跃阶段。后续应由你决定是否完成、归档，或重新开 phase。";
    button.disabled = true;
    button.textContent = "没有后续阶段";
    return;
  }

  if (hasEffectiveBlockers(detail, task)) {
    hint.textContent = "任务当前被阻塞，先解除阻塞后再推进到下一阶段。";
    button.disabled = true;
    button.textContent = `待推进到${formatMainStage(nextStage)}`;
    return;
  }

  if (task.paused) {
    hint.textContent = "任务当前处于暂停状态，恢复后再推进到下一阶段。";
    button.disabled = true;
    button.textContent = `待推进到${formatMainStage(nextStage)}`;
    return;
  }

  if (gateReason) {
    hint.textContent = `当前不能推进：${gateReason}`;
    button.disabled = true;
    button.textContent = `待推进到${formatMainStage(nextStage)}`;
    return;
  }

  hint.textContent = `下一步建议：把任务从${formatMainStage(currentStage)}推进到${formatMainStage(nextStage)}。这只会更新控制面状态，不会自动启动 Codex 执行。`;
  button.disabled = false;
  button.textContent = `推进到${formatMainStage(nextStage)}`;
  button.onclick = () => handleAdvanceStage(task, button);
}

function formatTaskListPhase(task) {
  if (task.active_phase_kind || task.active_phase_status) {
    return `${localizePhaseKind(task.active_phase_kind)} / ${localizePhaseStatus(task.active_phase_status)}`;
  }
  return task.active_phase_id || "-";
}

function formatTaskListBlockers(task) {
  if (task.terminal_state) return task.terminal_state;
  if (task.paused) return "\u6682\u505c";
  if (task.blocked) return formatList(task.blocker_kinds || [], BLOCKER_LABELS);
  return "\u65e0";
}

function renderTaskList() {
  elements.taskCountBadge.textContent = String(state.tasks.length);
  elements.taskList.innerHTML = "";

  if (!state.tasks.length) {
    elements.taskList.append(emptyNode("\u8fd8\u6ca1\u6709\u4efb\u52a1"));
    return;
  }

  const header = document.createElement("div");
  header.className = "task-table-header";
  header.innerHTML = `
    <span>\u4efb\u52a1</span>
    <span>\u4e3b\u9636\u6bb5</span>
    <span>\u5f53\u524d phase</span>
    <span>\u5f85\u51b3\u7b56</span>
    <span>\u963b\u585e</span>
    <span>\u6700\u8fd1\u66f4\u65b0</span>
  `;
  elements.taskList.append(header);

  state.tasks.forEach((task, index) => {
    const summary = task.memory_summary || task.summary || "还没有摘要。";
    const effectiveStage = task.current_stage || task.stage;
    const runtimeBadge = getTaskRuntimeBadge(task);
    const row = document.createElement("div");
    row.className = `task-item task-row${task.task_id === state.selectedTaskId ? " is-active" : ""}${runtimeBadge.label === "STUB" ? " task-row-stub" : ""}${runtimeBadge.label === "OFFLINE" ? " task-row-offline" : ""}`;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.style.animationDelay = `${index * 40}ms`;
    row.innerHTML = `
      <span class="task-row-title">
        <strong>${task.title}</strong>
        <span class="task-row-subtitle">${task.priority || "-"} · ${task.task_id}</span>
      </span>
      <span class="task-row-cell">${formatMainStage(effectiveStage)}</span>
      <span class="task-row-cell">${formatTaskListPhase(task)}</span>
      <span class="task-row-cell task-row-count">${task.pending_decision_count || 0}</span>
      <span class="task-row-cell">${formatTaskListBlockers(task)}</span>
      <span class="task-row-cell">${formatDate(task.updated_at)}</span>
      <div class="task-row-summary">
        <span class="mini-note">${summary}</span>
        <span class="task-row-meta"><span class="task-chip ${runtimeBadge.className}" title="${escapeHtml(runtimeBadge.title)}">${runtimeBadge.label}</span>${taskLabel(task)}</span>
      </div>
    `;
    const handleSelectTask = async () => {
      state.selectedTaskId = task.task_id;
      state.handoffModeOverride = null;
      state.selectedTaskTab = "plan";
      renderTaskStrip();
      await renderTaskDetail();
    };
    row.addEventListener("click", handleSelectTask);
    row.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        await handleSelectTask();
      }
    });
    elements.taskList.append(row);
  });
}

function renderTaskStrip() {
  elements.taskCountBadge.textContent = String(state.tasks.length);
  elements.taskList.innerHTML = "";

  if (!state.tasks.length) {
    elements.taskList.append(emptyNode("还没有任务"));
    return;
  }

  state.tasks.forEach((task, index) => {
    const effectiveStage = task.current_stage || task.stage;
    const runtimeBadge = getTaskRuntimeBadge(task);
    const chips = [];
    if (task.pending_decision_count) {
      chips.push(`<span class="task-chip task-chip-warn">待决策 ${task.pending_decision_count}</span>`);
    }
    if (task.blocked || task.paused || task.terminal_state) {
      chips.push(`<span class="task-chip task-chip-muted">${escapeHtml(formatTaskListBlockers(task))}</span>`);
    }

    const row = document.createElement("div");
    row.className = `task-item task-switcher${task.task_id === state.selectedTaskId ? " is-active" : ""}`;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.style.animationDelay = `${index * 40}ms`;
    row.innerHTML = `
      <div class="task-switcher-main">
        <strong>${escapeHtml(task.title)}</strong>
        <span class="task-chip ${runtimeBadge.className}" title="${escapeHtml(runtimeBadge.title)}">${runtimeBadge.label}</span>
      </div>
      <div class="task-switcher-meta">
        <span class="task-switcher-subtitle">${escapeHtml(formatMainStage(effectiveStage))}</span>
      </div>
      <div class="task-chip-row">
        ${chips.join("") || '<span class="task-chip">进行中</span>'}
      </div>
    `;
    const handleSelectTask = async () => {
      state.selectedTaskId = task.task_id;
      state.handoffModeOverride = null;
      state.selectedTaskTab = "plan";
      renderTaskStrip();
      await renderTaskDetail();
    };
    row.addEventListener("click", handleSelectTask);
    row.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        await handleSelectTask();
      }
    });
    elements.taskList.append(row);
  });
}

function renderMetaGrid(detail) {
  const task = detail?.task;
  const memoryIndex = getTaskMemoryIndex(detail);
  const openLoopsBlock = getTaskMemoryBlock(detail, "open-loops");
  const latestSession = getLatestSession(detail);
  const activeSessionCount = memoryIndex?.active_session_ids?.length || (detail?.sessions || []).length || 0;

  const cards = [
    { label: "任务 ID", value: task.task_id },
    { label: "账号", value: task.assignee_account_id || "-" },
    { label: "阻塞", value: formatList(getEffectiveBlockers(detail), BLOCKER_LABELS) },
    { label: "机器", value: formatList(task.machine_ids || []) },
    { label: "下一步", value: getEffectiveNextStep(detail, task) },
    { label: "最近并回", value: formatDate(memoryIndex?.last_rollup_at) },
    { label: "活跃会话", value: String(activeSessionCount) },
    { label: "待验证", value: String(getEffectivePendingVerification(detail, task)) },
    { label: "会话焦点", value: latestSession?.session?.current_focus || "-" },
    { label: "成功判据", list: task.success_criteria || [] },
    { label: "未知项", list: task.unknowns || [] },
    { label: "开放问题", list: openLoopsBlock?.summary ? [openLoopsBlock.summary] : [] },
  ];

  elements.taskMeta.innerHTML = "";
  cards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "meta-card";
    if (card.list) {
      div.innerHTML = `<span class="meta-label">${card.label}</span>`;
      const list = document.createElement("ul");
      list.className = "meta-list";
      const values = card.list.length ? card.list : ["-"];
      values.forEach((value) => {
        const item = document.createElement("li");
        item.textContent = value;
        list.append(item);
      });
      div.append(list);
    } else {
      div.innerHTML = `<span class="meta-label">${card.label}</span><strong>${card.value}</strong>`;
    }
    elements.taskMeta.append(div);
  });
}

function buildProcessEvents(detail) {
  if (!detail?.task) return [];

  const memoryIndex = getTaskMemoryIndex(detail);
  const latestSession = getLatestSession(detail);
  const events = [];

  if (memoryIndex) {
    events.push(
      createProcessEvent(
        "task",
        "任务记忆快照",
        memoryIndex.updated_at || memoryIndex.last_rollup_at || detail.task.updated_at,
        memoryIndex.summary || "当前已经有任务记忆快照。",
        [
          `主阶段：${formatMainStage(memoryIndex.current_stage || detail.task.stage)}`,
          `当前 phase：${formatCurrentPhase(getActivePhaseFromMemory(detail) || findActivePhase(detail))}`,
          `下一步：${memoryIndex.recommended_next_step || "-"}`,
          `最近并回：${formatDate(memoryIndex.last_rollup_at)}`,
        ],
      ),
    );
  }

  (detail?.memory?.history || []).forEach((rollup) => {
    events.push(
      createProcessEvent(
        "task",
        rollup.title || "任务记忆并回",
        rollup.applied_at || rollup.updated_at || rollup.created_at,
        rollup.summary || rollup.rollup_kind || "任务记忆并回",
        [rollup.path ? `路径：${rollup.path}` : ""],
      ),
    );
  });

  (detail?.sessions || []).forEach((sessionEntry) => {
    const session = sessionEntry.session;
    const sessionSummary = getSessionPart(sessionEntry, "summary");
    const sessionHandoff = getSessionPart(sessionEntry, "handoff");
    const sessionEvents = getSessionPart(sessionEntry, "event_log");
    const attachments = getSessionPart(sessionEntry, "attachments_index");

    events.push(
      createProcessEvent(
        "task",
        session.title || session.session_id || "Session",
        session.last_event_at || session.updated_at || session.started_at,
        `${localizeStatus(session.status)} / ${(session.mode || "-")}`,
        [
          session.current_focus ? `焦点：${session.current_focus}` : "",
          sessionSummary?.summary ? `摘要：${sessionSummary.summary}` : "",
          sessionHandoff?.summary ? `交接：${sessionHandoff.summary}` : "",
          attachments ? `附件：${attachments.attachment_count || 0}` : "",
          session.path ? `路径：${session.path}` : "",
        ],
      ),
    );

    if (sessionEvents) {
      events.push(
        createProcessEvent(
        "task",
        `${session.title || session.session_id || "会话"}事件流`,
        sessionEvents.updated_at || session.last_event_at || session.updated_at,
        sessionEvents.summary || `事件数：${sessionEvents.event_count || 0}`,
        [sessionEvents.path ? `路径：${sessionEvents.path}` : ""],
        true,
      ),
    );
    }
  });

  if (!events.length) {
    return buildProcessEventsLegacy(detail);
  }

  events.sort((left, right) => {
    const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
    const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
    return rightTime - leftTime;
  });

  if (state.showDetailedEvents) {
    return events;
  }
  return events.filter((event) => !event.detailedOnly);
}

function buildHandoffPacket(task, detail) {
  const mode = getEffectiveHandoffMode(detail);
  const recommendedMode = recommendHandoffMode(task.stage);
  const memoryIndex = getTaskMemoryIndex(detail);
  const handoffBlock = getTaskMemoryBlock(detail, "handoff");
  const openLoopsBlock = getTaskMemoryBlock(detail, "open-loops");
  const evidenceBlock = getTaskMemoryBlock(detail, "evidence");
  const decisionsBlock = getTaskMemoryBlock(detail, "decisions");
  const latestSession = getLatestSession(detail);
  const sessionSummary = getSessionPart(latestSession, "summary");
  const sessionCache = getSessionPart(latestSession, "cache");
  const sessionHandoff = getSessionPart(latestSession, "handoff");
  const activePhase = getActivePhaseFromMemory(detail) || findActivePhase(detail);
  const gateReason = getAdvanceGateReason(detail);

  const currentJudgment = handoffBlock?.summary
    || sessionSummary?.summary
    || memoryIndex?.summary
    || (mode === "execute"
      ? "当前更适合在已批准的任务边界内直接推进执行。"
      : "当前更适合先讨论、澄清，再决定是否执行。");

  const permissionLine = mode === "execute"
    ? "允许在当前任务边界内执行，但新增证据必须及时回写到控制面。"
    : "本轮以分析、澄清和明确下一步建议为主，不默认直接执行。";

  const nextStep = memoryIndex?.recommended_next_step
    || (gateReason ? `Unblock stage advancement first: ${gateReason}` : "Continue with the current task focus.");

  const primaryRisk = openLoopsBlock?.summary
    || (gateReason ? `状态和证据可能脱节：${gateReason}` : "如果新证据没有及时回写，任务状态会继续偏离真实进展。");

  const completedItems = [
    decisionsBlock?.summary || "",
    evidenceBlock?.summary || "",
    latestSession?.session?.current_focus ? `最近会话焦点：${latestSession.session.current_focus}` : "",
  ].filter(Boolean);

  const outstandingItems = [
    openLoopsBlock?.summary || "",
    gateReason || "",
    sessionHandoff?.summary || "",
  ].filter(Boolean);

  const keyRecords = [
    memoryIndex?.path ? `任务记忆：${memoryIndex.path}` : "",
    handoffBlock?.path ? `交接块：${handoffBlock.path}` : "",
    sessionSummary?.path ? `会话摘要：${sessionSummary.path}` : "",
    sessionCache?.path ? `会话缓存：${sessionCache.path}` : "",
  ].filter(Boolean);

  const codexStartMessage = [
    `你正在接手任务 ${task.task_id}（${task.title}）。`,
    `当前主阶段：${formatMainStage(memoryIndex?.current_stage || task.stage)}。`,
    `当前 phase：${formatCurrentPhase(activePhase)}。`,
    `本轮模式：${HANDOFF_MODE_LABELS[mode]}。`,
    `任务摘要：${memoryIndex?.summary || task.summary || "请先阅读任务定义。"}。`,
    handoffBlock?.summary ? `任务交接：${handoffBlock.summary}` : "",
    sessionSummary?.summary ? `最近会话摘要：${sessionSummary.summary}` : "",
    sessionHandoff?.summary ? `最近会话交接：${sessionHandoff.summary}` : "",
    openLoopsBlock?.summary ? `开放问题：${openLoopsBlock.summary}` : "",
    `建议下一步：${nextStep}`,
    `约束：${permissionLine}`,
    keyRecords.length ? `优先阅读这些记录：${keyRecords.join(" | ")}` : "",
  ].filter(Boolean).join("\n");

  return {
    mode,
    recommendedMode,
    activePhase,
    currentJudgment,
    permissionLine,
    nextStep,
    primaryRisk,
    completedItems,
    outstandingItems,
    keyRecords,
    codexStartMessage,
  };
}

function renderHandoffPanel(task, detail) {
  elements.handoffPanel.innerHTML = "";

  if (!task || !detail?.task) {
    elements.handoffPanel.append(emptyNode("先选择一个任务，再生成交接材料"));
    elements.copyPromptButton.onclick = null;
    updateHandoffModeControls(null);
    return;
  }

  const packet = buildHandoffPacket(task, detail);
  const memoryIndex = getTaskMemoryIndex(detail);
  const latestSession = getLatestSession(detail);
  const sessionSummary = getSessionPart(latestSession, "summary");
  const sessionHandoff = getSessionPart(latestSession, "handoff");

  const card = document.createElement("div");
  card.className = "handoff-card";
  card.innerHTML = `
    <h3>短决策卡片</h3>
    <div class="handoff-kpi-grid">
      <div class="handoff-kpi">
        <span>当前主阶段</span>
        <strong>${escapeHtml(formatMainStage(memoryIndex?.current_stage || task.stage))}</strong>
      </div>
      <div class="handoff-kpi">
        <span>当前判断</span>
        <strong>${escapeHtml(packet.currentJudgment)}</strong>
      </div>
      <div class="handoff-kpi">
        <span>允许范围</span>
        <strong>${escapeHtml(packet.permissionLine)}</strong>
      </div>
      <div class="handoff-kpi">
        <span>建议下一步</span>
        <strong>${escapeHtml(packet.nextStep)}</strong>
      </div>
      <div class="handoff-kpi">
        <span>主要风险</span>
        <strong>${escapeHtml(packet.primaryRisk)}</strong>
      </div>
    </div>
  `;
  elements.handoffPanel.append(card);

  const detailBlock = document.createElement("details");
  detailBlock.className = "handoff-card handoff-details";
  detailBlock.innerHTML = `
    <summary>查看完整任务摘要</summary>
    <div class="handoff-sections">
      <section class="handoff-section">
        <h4>任务摘要</h4>
        <p class="handoff-summary">${escapeHtml(memoryIndex?.summary || task.summary || "-")}</p>
      </section>
      <section class="handoff-section">
        <h4>当前状态</h4>
        <ul class="handoff-list">
          <li>${escapeHtml(`主阶段：${formatMainStage(memoryIndex?.current_stage || task.stage)}`)}</li>
          <li>${escapeHtml(`当前 phase：${formatCurrentPhase(packet.activePhase)}`)}</li>
          <li>${escapeHtml(`阻塞：${formatList(getEffectiveBlockers(detail, task), BLOCKER_LABELS)}`)}</li>
          <li>${escapeHtml(`最近并回：${formatDate(memoryIndex?.last_rollup_at)}`)}</li>
          <li>${escapeHtml(`待验证：${getEffectivePendingVerification(detail, task)}`)}</li>
        </ul>
      </section>
      <section class="handoff-section">
        <h4>已完成</h4>
        <ul class="handoff-list">${(packet.completedItems.length ? packet.completedItems : ["当前还没有明确收口的完成项。"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section class="handoff-section">
        <h4>未完成</h4>
        <ul class="handoff-list">${(packet.outstandingItems.length ? packet.outstandingItems : ["当前没有额外未完成提醒。"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
      <section class="handoff-section">
        <h4>最近会话</h4>
        <ul class="handoff-list">
          <li>${escapeHtml(`会话：${latestSession?.session?.session_id || "-"}`)}</li>
          <li>${escapeHtml(`焦点：${latestSession?.session?.current_focus || "-"}`)}</li>
          <li>${escapeHtml(`摘要：${sessionSummary?.summary || "-"}`)}</li>
          <li>${escapeHtml(`交接：${sessionHandoff?.summary || "-"}`)}</li>
        </ul>
      </section>
      <section class="handoff-section">
        <h4>关键记录</h4>
        <ul class="handoff-list">${(packet.keyRecords.length ? packet.keyRecords : ["暂无"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>
    </div>
  `;
  elements.handoffPanel.append(detailBlock);

  const promptCard = document.createElement("div");
  promptCard.className = "handoff-card";
  promptCard.innerHTML = `
    <h3>可发给 Codex 的起始消息</h3>
    <pre class="prompt-box">${escapeHtml(packet.codexStartMessage)}</pre>
  `;
  elements.handoffPanel.append(promptCard);

  elements.copyPromptButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(packet.codexStartMessage);
      elements.copyPromptButton.textContent = "已复制";
      window.setTimeout(() => {
        elements.copyPromptButton.textContent = "复制起始消息";
      }, 1200);
    } catch (error) {
      window.alert("复制失败，请手动复制。");
    }
  };

  updateHandoffModeControls(detail);
}

async function renderTaskDetailLegacy() {
  if (!state.selectedTaskId) {
    elements.taskTitle.textContent = "尚未选择任务";
    elements.taskSummary.textContent = "从任务总览中选择一个任务，查看它当前的状态、决策与实验记录。";
    elements.taskStage.textContent = "-";
    elements.taskCurrentPhase.textContent = "-";
    elements.taskPriority.textContent = "-";
    elements.taskBlockers.textContent = "-";
    elements.taskMachines.textContent = "-";
    elements.taskMeta.innerHTML = "";
    elements.planPanel.innerHTML = "";
    elements.experimentPanel.innerHTML = "";
    renderRuntimePanel(null, null);
    renderProcessPanel(null);
    renderHandoffPanel(null, null);
    updateAdvanceControls(null, null);
    updateProcessControls();
    renderTaskTabs();
    return;
  }

  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  const detail = await ensureTaskDetail(state.selectedTaskId);
  const memoryIndex = getTaskMemoryIndex(detail);
  const activePhase = getActivePhaseFromMemory(detail) || findActivePhase(detail);

  elements.taskTitle.textContent = task?.title || state.selectedTaskId;
  elements.taskSummary.textContent = detail?.task?.summary || "还没有摘要。";
  elements.taskStage.textContent = formatMainStage(task?.stage);
  elements.taskCurrentPhase.textContent = formatCurrentPhase(activePhase);
  elements.taskPriority.textContent = task?.priority || "-";
  elements.taskBlockers.textContent = task?.blocked ? formatList(task?.blocker_kinds || [], BLOCKER_LABELS) : "无";
  elements.taskMachines.textContent = formatList(task?.machine_ids || []);

  renderMetaGrid(detail.task);
  renderPlanPanel(detail);
  renderExperimentPanel(detail);
  renderProcessPanel(detail);
  renderHandoffPanel(task, detail);
  updateAdvanceControls(task, detail);
  updateProcessControls();
  renderTaskTabs();
}

async function renderTaskDetail() {
  if (!state.selectedTaskId) {
    elements.taskTitle.textContent = "灏氭湭閫夋嫨浠诲姟";
    elements.taskSummary.textContent = "浠庝换鍔℃€昏涓€夋嫨涓€涓换鍔★紝鏌ョ湅瀹冨綋鍓嶇殑鐘舵€併€佸喅绛栦笌瀹為獙璁板綍銆?;";
    elements.taskStage.textContent = "-";
    elements.taskCurrentPhase.textContent = "-";
    elements.taskPriority.textContent = "-";
    elements.taskBlockers.textContent = "-";
    elements.taskMachines.textContent = "-";
    elements.taskMeta.innerHTML = "";
    elements.planPanel.innerHTML = "";
    elements.experimentPanel.innerHTML = "";
    renderRuntimePanel(null, null);
    renderProcessPanel(null);
    renderHandoffPanel(null, null);
    updateAdvanceControls(null, null);
    updateProcessControls();
    renderTaskTabs();
    return;
  }

  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  const detail = await ensureTaskDetail(state.selectedTaskId);
  const activePhase = getActivePhaseFromMemory(detail) || findActivePhase(detail);

  elements.taskTitle.textContent = task?.title || state.selectedTaskId;
  elements.taskSummary.textContent = getEffectiveSummary(detail, task);
  elements.taskStage.textContent = formatMainStage(getEffectiveStage(detail, task));
  elements.taskCurrentPhase.textContent = formatCurrentPhase(activePhase);
  elements.taskPriority.textContent = task?.priority || "-";
  elements.taskBlockers.textContent = hasEffectiveBlockers(detail, task)
    ? formatList(getEffectiveBlockers(detail, task), BLOCKER_LABELS)
    : "-";
  elements.taskMachines.textContent = formatList(task?.machine_ids || []);

  renderMetaGrid(detail);
  renderPlanPanel(detail);
  renderExperimentPanel(detail);
  renderRuntimePanel(task, detail);
  renderProcessPanel(detail);
  renderHandoffPanel(task, detail);
  updateAdvanceControls(task, detail);
  updateProcessControls();
  renderTaskTabs();
}

async function renderApp() {
  await loadIndexes();
  updateCreateTaskControls();
  renderGuideDrawer();
  renderTaskStrip();
  renderOverview();
  await renderTaskDetail();
}

elements.refreshButton.addEventListener("click", async () => {
  state.taskDetails.clear();
  await renderApp();
});

elements.guideToggleButton.addEventListener("click", () => {
  state.guideDrawerOpen = !state.guideDrawerOpen;
  renderGuideDrawer();
});

elements.guideCloseButton.addEventListener("click", () => {
  state.guideDrawerOpen = false;
  renderGuideDrawer();
});

elements.guideOverlay.addEventListener("click", () => {
  state.guideDrawerOpen = false;
  renderGuideDrawer();
});

elements.toggleCreateTaskButton.addEventListener("click", () => {
  state.createTaskPanelExpanded = !state.createTaskPanelExpanded;
  updateCreateTaskControls();
});

elements.submitCreateTaskButton.addEventListener("click", async () => {
  await handleCreateTask(elements.submitCreateTaskButton);
});

elements.runtimeStartButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  if (!task) return;
  await handleRuntimeMutation(
    "/api/runtime/start",
    {
      task_id: task.task_id,
      account_id: task.assignee_account_id || "",
      machine_id: (task.machine_ids || [])[0] || "",
      working_directory: task.primary_repo || "",
    },
    elements.runtimeStartButton,
    "已写入空主会话，等待你确认交接包或发送第一条消息。",
  );
});

elements.runtimeProbeButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  if (!task) return;
  await handleRuntimeMutation(
    "/api/runtime/probe-app-server",
    {
      task_id: task.task_id,
      working_directory: task.primary_repo || "",
    },
    elements.runtimeProbeButton,
    "已触发 app-server 本机探测。"
  );
});

elements.runtimeAttachButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  if (!task) return;
  await handleRuntimeMutation(
    "/api/runtime/attach-app-server",
    { task_id: task.task_id },
    elements.runtimeAttachButton,
    "已附加到真实 app-server thread。"
  );
});

elements.runtimeProbeStopButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  if (!task) return;
  await handleRuntimeMutation(
    "/api/runtime/stop-app-server",
    { task_id: task.task_id },
    elements.runtimeProbeStopButton,
    "已停止 app-server 探测进程。"
  );
});

elements.runtimeStopButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  if (!task) return;
  await handleRuntimeMutation(
    "/api/runtime/stop",
    { task_id: task.task_id },
    elements.runtimeStopButton,
    "已把当前主会话标记为停止。",
  );
});

elements.runtimeReconnectButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  if (!task) return;
  await handleRuntimeMutation(
    "/api/runtime/reconnect",
    { task_id: task.task_id },
    elements.runtimeReconnectButton,
    "已把当前主会话重新切回等待你介入。",
  );
});

elements.runtimeSendHandoffButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  const detail = await ensureTaskDetail(state.selectedTaskId);
  if (!task || !detail?.task) return;
  const packet = buildHandoffPacket(task, detail);
  await handleRuntimeMutation(
    "/api/runtime/send-message",
    {
      task_id: task.task_id,
      message_kind: "handoff",
      content: packet.codexStartMessage,
      sent_by: "user",
    },
    elements.runtimeSendHandoffButton,
    "交接包已写入当前主会话事件流。",
  );
});

elements.runtimeSendMessageButton.addEventListener("click", async () => {
  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  const content = elements.runtimeMessageInput.value.trim();
  if (!task) return;
  if (!content) {
    window.alert("先输入要发送的消息。");
    return;
  }
  await handleRuntimeMutation(
    "/api/runtime/send-message",
    {
      task_id: task.task_id,
      message_kind: "user",
      content,
      sent_by: "user",
    },
    elements.runtimeSendMessageButton,
    "消息已写入当前主会话事件流。",
  );
  elements.runtimeMessageInput.value = "";
});

elements.processToggleButton.addEventListener("click", async () => {
  state.processPanelExpanded = !state.processPanelExpanded;
  await renderTaskDetail();
});

elements.detailEventToggle.addEventListener("click", async () => {
  state.showDetailedEvents = !state.showDetailedEvents;
  await renderTaskDetail();
});

elements.handoffDiscussButton.addEventListener("click", async () => {
  state.handoffModeOverride = "discuss";
  await renderTaskDetail();
});

elements.handoffExecuteButton.addEventListener("click", async () => {
  state.handoffModeOverride = "execute";
  await renderTaskDetail();
});

initializeLayoutShell();

renderApp().catch((error) => {
  console.error(error);
  document.body.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">加载失败</p>
        <h1>控制面 GUI 无法加载索引。</h1>
        <p class="hero-summary">${error.message}</p>
        <p class="hero-summary">请使用控制面服务启动 GUI，确保索引和 API 都可以被访问。</p>
      </section>
    </main>
  `;
});
