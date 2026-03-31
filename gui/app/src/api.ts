import type {
  AssetsIndex,
  AccountsIndex,
  CreateTaskInput,
  MachinesIndex,
  MutationResult,
  OverviewIndex,
  TaskDetail,
  TaskSummary,
} from "./types";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || payload.ok === false) {
    const message = String(payload.error || `${path} -> ${response.status}`);
    throw new Error(message);
  }
  return payload as T;
}

export async function loadOverview(): Promise<OverviewIndex> {
  return fetchJson<OverviewIndex>("/indexes/overview.json");
}

export async function loadAssets(): Promise<AssetsIndex> {
  return fetchJson<AssetsIndex>("/indexes/assets.json");
}

export async function loadTasks(): Promise<TaskSummary[]> {
  const payload = await fetchJson<{ tasks: TaskSummary[] }>("/indexes/tasks.json");
  return payload.tasks ?? [];
}

export async function loadTaskDetail(taskId: string): Promise<TaskDetail> {
  return fetchJson<TaskDetail>(`/indexes/task-details/${taskId}.json`);
}

export async function loadAccounts(): Promise<AccountsIndex> {
  return fetchJson<AccountsIndex>("/indexes/accounts.json");
}

export async function loadMachines(): Promise<MachinesIndex> {
  return fetchJson<MachinesIndex>("/indexes/machines.json");
}

export async function createTask(input: CreateTaskInput): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/tasks/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function advanceStage(taskId: string): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/tasks/advance-stage", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, advanced_by: "gui-vite" }),
  });
}

export async function setTerminalState(taskId: string, terminalState: string): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/tasks/set-terminal-state", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, terminal_state: terminalState, updated_by: "gui-vite" }),
  });
}

export async function probeRuntime(taskId: string): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/runtime/probe-app-server", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId }),
  });
}

export async function attachRuntime(taskId: string): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/runtime/attach-app-server", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId }),
  });
}

export async function stopAppServer(taskId: string): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/runtime/stop-app-server", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId }),
  });
}

export async function reconnectRuntime(taskId: string): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/runtime/reconnect", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId }),
  });
}

export async function sendRuntimeMessage(taskId: string, content: string): Promise<MutationResult> {
  return fetchJson<MutationResult>("/api/runtime/send-message", {
    method: "POST",
    body: JSON.stringify({
      task_id: taskId,
      content,
      message_kind: "user",
      sent_by: "user",
    }),
  });
}
