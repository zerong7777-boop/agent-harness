import type { RuntimeStatus, TaskSummary } from "./types";

const STAGE_LABELS: Record<string, string> = {
  clarification: "澄清",
  planning: "计划",
  execution: "执行",
  verification: "验证",
  "knowledge-review": "知识整理",
};

const STATUS_LABELS: Record<string, string> = {
  open: "已开启",
  planned: "已计划",
  running: "进行中",
  completed: "已完成",
  waiting: "等待中",
  ready: "就绪",
  attached: "已附加",
  "not-attached": "未附加",
  stopped: "已停止",
  idle: "空闲",
  "waiting-user": "等待你处理",
  error: "异常",
  archived: "已归档",
  "not-probed": "未探测",
  "not-started": "未启动",
  starting: "启动中",
};

export function formatDate(value?: string): string {
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

export function localizeStage(value?: string): string {
  if (!value) return "-";
  return STAGE_LABELS[value] ?? value;
}

export function localizeStatus(value?: string): string {
  if (!value) return "-";
  return STATUS_LABELS[value] ?? value;
}

export function cleanText(value?: string | null, fallback = "-"): string {
  if (!value) return fallback;
  const trimmed = String(value).replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  return trimmed;
}

export function summarizeList(items?: string[], fallback = "无"): string {
  if (!items || !items.length) return fallback;
  return items.map((item) => cleanText(item)).join(" / ");
}

export function runtimeBadge(task: TaskSummary): { label: string; tone: string } {
  const live =
    task.app_server_probe_status === "ready" &&
    task.app_server_attach_status === "attached" &&
    task.app_server_bridge_status === "running";
  if (live) return { label: "LIVE", tone: "live" };
  if ((task.runtime_adapter ?? "").includes("stub")) return { label: "STUB", tone: "stub" };
  return { label: "OFFLINE", tone: "offline" };
}

export function runtimeReady(status?: RuntimeStatus, task?: TaskSummary): boolean {
  const probe = status?.app_server_probe_status ?? task?.app_server_probe_status;
  const attach = status?.app_server_attach_status ?? task?.app_server_attach_status;
  const bridge = status?.app_server_bridge_status ?? task?.app_server_bridge_status;
  const threadId = status?.app_server_thread_id;
  return probe === "ready" && attach === "attached" && bridge === "running" && Boolean(threadId);
}

export function statusHint(status?: RuntimeStatus, task?: TaskSummary): string {
  if (runtimeReady(status, task)) return "真实会话已连接，可以直接发送消息。";
  const probe = status?.app_server_probe_status ?? task?.app_server_probe_status;
  const attach = status?.app_server_attach_status ?? task?.app_server_attach_status;
  const bridge = status?.app_server_bridge_status ?? task?.app_server_bridge_status;
  if (probe !== "ready") return "先探测 App Server。";
  if (attach !== "attached") return "App Server 已就绪，下一步附加真实会话。";
  if (bridge !== "running") return "会话已附加，但 bridge 尚未运行。";
  return "当前不是实时 Codex 会话。";
}
