const TEXT = {
  toolbar: {
    eyebrow: "Codex",
    title: "控制台",
    lede: "围绕任务、会话和证据组织你的 Codex 工作流。",
    resource: "资源",
    guide: "使用说明",
    refresh: "刷新",
  },
  taskHub: {
    title: "任务",
    note: "这里只负责切换任务。更详细的计划、实验和会话都放到下方工作区。",
    create: "新建任务",
    submit: "创建任务",
  },
  hero: {
    eyebrow: "当前任务",
    emptyTitle: "尚未选择任务",
    emptySummary: "从任务条中选一个任务，右侧会显示它的计划、实验和实时会话。",
    nextStep: "选择任务后，这里会给出最直接的下一步建议。",
    advance: "推进阶段",
    stats: ["主阶段", "当前 phase", "优先级", "阻塞", "机器"],
  },
  sections: {
    taskMeta: "任务概览",
    planPanel: "计划",
    experimentPanel: "实验",
    runtimePanel: "运行时",
    handoffPanel: "交接",
    processPanel: "会话过程",
  },
  runtime: {
    buttons: ["探测 App Server", "附加会话", "停止 App Server", "启动", "停止", "重连"],
    sendHandoff: "发送交接包",
    sendMessage: "发送消息",
    inputPlaceholder: "输入要发给当前会话的消息。",
    disconnected: "先连接真实会话，再发消息。",
    connected: "已连接真实会话，可以直接发送。",
    empty: "当前还没有来自真实 Codex 的回复。",
    headings: ["当前状态", "App Server", "最新回复", "最近运行记录"],
    recentMessages: "最近消息",
  },
  handoff: {
    buttons: ["讨论模式", "执行模式", "复制起始消息"],
    hint: "系统会推荐一种模式，你也可以随时切换。",
  },
  process: {
    detail: "显示详细事件",
    toggle: "展开过程流",
    note: "这里展示当前任务的事件流和会话记录。",
  },
  guide: {
    title: "使用说明",
    close: "关闭",
    sections: [
      {
        title: "任务条",
        body: "顶部任务条只负责切换任务。它保留标题、主阶段和 LIVE/STUB/OFFLINE 信号，不再承载太多细节。",
      },
      {
        title: "任务详情",
        body: "右侧是当前任务的主工作区。默认先看概览，再进入计划、实验、运行时和会话。",
      },
      {
        title: "运行时",
        body: "先探测，再附加。只有连接到真实会话后，消息和交接包才会发给 Codex。",
      },
      {
        title: "会话输出",
        body: "最新回复放在运行时顶部；更细的事件流和消息历史放在会话页。",
      },
    ],
  },
  tabs: {
    overview: "概览",
    plan: "计划",
    experiment: "实验",
    runtime: "运行时",
    session: "会话",
  },
};

function setText(node, value) {
  if (node) node.textContent = value;
}

function setHtml(node, value) {
  if (node) node.innerHTML = value;
}

function setSectionTitleByPanelId(panelId, title) {
  const panel = document.getElementById(panelId);
  const heading = panel?.closest("section")?.querySelector(".section-head h2");
  setText(heading, title);
}

function normalizeToolbar() {
  const brand = document.querySelector(".toolbar-brand");
  if (!brand) return;

  setText(brand.querySelector(".eyebrow"), TEXT.toolbar.eyebrow);
  setText(brand.querySelector("h1"), TEXT.toolbar.title);
  setText(brand.querySelector("p:not(.eyebrow)"), TEXT.toolbar.lede);
  setText(document.getElementById("guideToggleButton"), TEXT.toolbar.guide);
  setText(document.getElementById("refreshButton"), TEXT.toolbar.refresh);
  setText(document.querySelector(".resource-popover summary"), TEXT.toolbar.resource);
}

function normalizeTaskHub() {
  const taskHub = document.querySelector(".task-hub-panel");
  if (!taskHub) return;

  setText(taskHub.querySelector(".section-head h2"), TEXT.taskHub.title);
  setText(document.getElementById("toggleCreateTaskButton"), TEXT.taskHub.create);
  setText(document.getElementById("submitCreateTaskButton"), TEXT.taskHub.submit);

  const note = taskHub.querySelector(".panel-note");
  setText(note, TEXT.taskHub.note);

  const titleInput = document.getElementById("createTaskTitle");
  const shortInput = document.getElementById("createTaskShortName");
  const summaryInput = document.getElementById("createTaskSummary");

  if (titleInput) titleInput.placeholder = "例如：RFvNext 复现实验";
  if (shortInput) shortInput.placeholder = "可选，默认按标题生成";
  if (summaryInput) summaryInput.placeholder = "一句话说明这个任务想解决什么。";

  const labels = taskHub.querySelectorAll(".field-label > span");
  const expected = ["任务标题", "短名", "任务摘要", "优先级", "账号", "机器"];
  labels.forEach((label, index) => setText(label, expected[index] || label.textContent));
}

function normalizeHero() {
  const hero = document.querySelector(".hero-panel");
  if (!hero) return;
  setText(hero.querySelector(".eyebrow"), TEXT.hero.eyebrow);
  setText(document.getElementById("advanceStageButton"), TEXT.hero.advance);

  const titleNode = document.getElementById("taskTitle");
  const summaryNode = document.getElementById("taskSummary");
  if (titleNode && !titleNode.textContent.trim()) setText(titleNode, TEXT.hero.emptyTitle);
  if (summaryNode && !summaryNode.textContent.trim()) setText(summaryNode, TEXT.hero.emptySummary);

  const hint = document.getElementById("taskNextStageHint");
  if (hint && (!hint.textContent.trim() || /[\uFFFD]/.test(hint.textContent))) {
    setText(hint, TEXT.hero.nextStep);
  }

  hero.querySelectorAll(".stat-chip .stat-label").forEach((node, index) => {
    setText(node, TEXT.hero.stats[index] || node.textContent);
  });
}

function normalizeSections() {
  Object.entries(TEXT.sections).forEach(([panelId, title]) => {
    setSectionTitleByPanelId(panelId, title);
  });

  const tabButtons = document.querySelectorAll(".task-tab-button");
  tabButtons.forEach((button) => {
    const tabId = button.dataset.tabId;
    if (tabId && TEXT.tabs[tabId]) setText(button, TEXT.tabs[tabId]);
  });

  const tabsHead = document.querySelector(".task-tabs-head h2");
  if (tabsHead) setText(tabsHead, "任务工作区");
}

function normalizeRuntime() {
  const buttons = [
    document.getElementById("runtimeProbeButton"),
    document.getElementById("runtimeAttachButton"),
    document.getElementById("runtimeProbeStopButton"),
    document.getElementById("runtimeStartButton"),
    document.getElementById("runtimeStopButton"),
    document.getElementById("runtimeReconnectButton"),
  ];
  buttons.forEach((button, index) => setText(button, TEXT.runtime.buttons[index]));
  setText(document.getElementById("runtimeSendHandoffButton"), TEXT.runtime.sendHandoff);
  setText(document.getElementById("runtimeSendMessageButton"), TEXT.runtime.sendMessage);

  const runtimeInput = document.getElementById("runtimeMessageInput");
  if (runtimeInput) runtimeInput.placeholder = TEXT.runtime.inputPlaceholder;

  const hint = document.getElementById("runtimeHint");
  const sendButton = document.getElementById("runtimeSendMessageButton");
  if (hint && sendButton) {
    setText(hint, sendButton.disabled ? TEXT.runtime.disconnected : TEXT.runtime.connected);
  }

  const runtimePanel = document.getElementById("runtimePanel");
  if (!runtimePanel) return;

  runtimePanel.querySelectorAll(".stack-card > h3").forEach((node, index) => {
    setText(node, TEXT.runtime.headings[index] || node.textContent);
  });

  const emptyReply = runtimePanel.querySelector(".runtime-reply-empty");
  if (emptyReply) setText(emptyReply, TEXT.runtime.empty);

  const recentHead = runtimePanel.querySelector(".runtime-chat-history-head");
  if (recentHead) setText(recentHead, TEXT.runtime.recentMessages);
}

function normalizeDetailLabels() {
  const taskMetaLabels = [
    "任务 ID",
    "账号",
    "阻塞",
    "机器",
    "下一步",
    "最近并回",
    "活跃会话",
    "待验证",
    "会话焦点",
    "成功判据",
    "未知项",
    "开放问题",
  ];
  document.querySelectorAll("#taskMeta .meta-label").forEach((node, index) => {
    setText(node, taskMetaLabels[index] || node.textContent);
  });

  document.querySelectorAll("#planPanel .meta-label").forEach((node, index) => {
    setText(node, index % 2 === 0 ? "phase 类型" : "phase 状态");
  });

  const experimentLabels = ["状态", "机器", "产物", "更新时间"];
  document.querySelectorAll("#experimentPanel .meta-label").forEach((node, index) => {
    setText(node, experimentLabels[index % experimentLabels.length] || node.textContent);
  });

  const runtimeCards = document.querySelectorAll("#runtimePanel .stack-card");
  const runtimeLabelGroups = [
    ["运行状态", "主会话", "会话状态", "模式", "适配器", "当前焦点", "最近事件"],
    ["探测状态", "进程归属", "端口", "进程 PID", "Ready / Health", "附加状态", "Bridge 状态", "WS 地址", "最近探测", "Bridge PID"],
    ["会话", "结果", "时间"],
  ];
  runtimeCards.forEach((card, cardIndex) => {
    const labels = runtimeLabelGroups[cardIndex];
    if (!labels) return;
    card.querySelectorAll(".meta-label").forEach((node, labelIndex) => {
      setText(node, labels[labelIndex] || node.textContent);
    });
  });
}

function normalizeHandoff() {
  setText(document.getElementById("handoffDiscussButton"), TEXT.handoff.buttons[0]);
  setText(document.getElementById("handoffExecuteButton"), TEXT.handoff.buttons[1]);
  setText(document.getElementById("copyPromptButton"), TEXT.handoff.buttons[2]);
  setText(document.getElementById("handoffModeHint"), TEXT.handoff.hint);
}

function normalizeProcess() {
  setText(document.getElementById("detailEventToggle"), TEXT.process.detail);
  setText(document.getElementById("processToggleButton"), TEXT.process.toggle);
  const note = document.getElementById("processPanel")?.closest("section")?.querySelector(".panel-note");
  setText(note, TEXT.process.note);
}

function normalizeGuide() {
  const drawer = document.getElementById("guideDrawer");
  if (!drawer) return;
  setText(drawer.querySelector(".guide-drawer-head h2"), TEXT.guide.title);
  setText(document.getElementById("guideCloseButton"), TEXT.guide.close);

  const guideContent = document.getElementById("guideContent");
  if (!guideContent) return;
  setHtml(
    guideContent,
    TEXT.guide.sections
      .map(
        (section) => `
          <section class="guide-section">
            <h3>${section.title}</h3>
            <p>${section.body}</p>
          </section>
        `,
      )
      .join(""),
  );
}

function normalize() {
  document.body.classList.add("theme-v3");
  normalizeToolbar();
  normalizeTaskHub();
  normalizeHero();
  normalizeSections();
  normalizeRuntime();
  normalizeDetailLabels();
  normalizeHandoff();
  normalizeProcess();
  normalizeGuide();
}

const observer = new MutationObserver(() => {
  window.clearTimeout(observer._timer);
  observer._timer = window.setTimeout(normalize, 30);
});

window.addEventListener("load", () => {
  normalize();
  observer.observe(document.body, { childList: true, subtree: true });
});
