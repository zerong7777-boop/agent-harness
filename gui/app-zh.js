const INDEX_ROOT = "../indexes";

const state = {
  overview: null,
  tasks: [],
  knowledge: [],
  accounts: [],
  machines: [],
  taskDetails: new Map(),
  selectedTaskId: null,
};

const elements = {
  refreshButton: document.getElementById("refreshButton"),
  taskList: document.getElementById("taskList"),
  accountList: document.getElementById("accountList"),
  machineList: document.getElementById("machineList"),
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
  taskPriority: document.getElementById("taskPriority"),
  taskBlockers: document.getElementById("taskBlockers"),
  taskMachines: document.getElementById("taskMachines"),
  taskMeta: document.getElementById("taskMeta"),
  planPanel: document.getElementById("planPanel"),
  experimentPanel: document.getElementById("experimentPanel"),
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`加载 ${path} 失败：${response.status}`);
  }
  return response.json();
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

function formatList(values) {
  return values && values.length ? values.join("，") : "无";
}

function taskLabel(task) {
  const bits = [task.stage];
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

function renderTaskList() {
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
      renderTaskList();
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
      div.innerHTML = `
        <h3>${decision.title}</h3>
        <p>任务：<span class="inline-code">${decision.task_id}</span></p>
        <div class="status-line"><span class="status-dot pending"></span>${decision.status || "待处理"} · ${formatDate(decision.updated_at)}</div>
      `;
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
        <p>${event.kind === "task-update" ? event.stage || "任务更新" : event.kind}</p>
        <div class="status-line"><span class="status-dot"></span>${formatDate(event.updated_at)}</div>
      `;
      return div;
    },
    "还没有时间线事件",
  );
}

function renderMetaGrid(task) {
  const cards = [
    {
      label: "任务 ID",
      value: task.task_id,
    },
    {
      label: "账号",
      value: task.assignee_account_id || "-",
    },
    {
      label: "阻塞类型",
      value: formatList(task.blocker_kinds || []),
    },
    {
      label: "机器 ID",
      value: formatList(task.machine_ids || []),
    },
    {
      label: "成功判据",
      list: task.success_criteria || [],
    },
    {
      label: "未知项",
      list: task.unknowns || [],
    },
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
      <div class="status-line"><span class="status-dot"></span>${plan.status || "状态未知"} · ${plan.plan_version || "-"}</div>
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
        <div class="status-line"><span class="status-dot${phase.status === "open" ? "" : " blocked"}"></span>${phase.phase_kind || "-"} · ${phase.status || "-"}</div>
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
        <div class="status-line"><span class="status-dot pending"></span>${decision.status || "待处理"}</div>
      `;
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
          <strong>${experiment.status || "-"}</strong>
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

async function renderTaskDetail() {
  if (!state.selectedTaskId) {
    elements.taskTitle.textContent = "尚未选择任务";
    elements.taskSummary.textContent = "从左侧任务列表中选择一个任务，查看它当前的状态、决策与实验记录。";
    elements.taskStage.textContent = "-";
    elements.taskPriority.textContent = "-";
    elements.taskBlockers.textContent = "-";
    elements.taskMachines.textContent = "-";
    elements.taskMeta.innerHTML = "";
    elements.planPanel.innerHTML = "";
    elements.experimentPanel.innerHTML = "";
    return;
  }

  const task = state.tasks.find((entry) => entry.task_id === state.selectedTaskId);
  const detail = await ensureTaskDetail(state.selectedTaskId);

  elements.taskTitle.textContent = task?.title || state.selectedTaskId;
  elements.taskSummary.textContent = detail?.task?.summary || "还没有摘要。";
  elements.taskStage.textContent = task?.stage || "-";
  elements.taskPriority.textContent = task?.priority || "-";
  elements.taskBlockers.textContent = task?.blocked ? formatList(task?.blocker_kinds || []) : "无";
  elements.taskMachines.textContent = formatList(task?.machine_ids || []);

  renderMetaGrid(detail.task);
  renderPlanPanel(detail);
  renderExperimentPanel(detail);
}

async function renderApp() {
  await loadIndexes();
  renderTaskList();
  renderOverview();
  await renderTaskDetail();
}

elements.refreshButton.addEventListener("click", async () => {
  state.taskDetails.clear();
  await renderApp();
});

renderApp().catch((error) => {
  console.error(error);
  document.body.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">加载失败</p>
        <h1>控制面 GUI 无法加载索引。</h1>
        <p class="hero-summary">${error.message}</p>
        <p class="hero-summary">请从仓库根目录启动静态服务，确保 <span class="inline-code">../indexes/*.json</span> 可以被访问。</p>
      </section>
    </main>
  `;
});
