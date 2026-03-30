import process from "node:process";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function summarizeMessage(message) {
  if (!message || typeof message !== "object") {
    return "";
  }
  const method = message.method || "";
  const params = message.params || {};
  if (method === "thread/started") {
    return `thread started: ${params.thread?.id || "-"}`;
  }
  if (method === "thread/status/changed") {
    return `thread status: ${params.status?.type || "-"}`;
  }
  if (method === "turn/started") {
    return `turn started: ${params.turn?.id || "-"}`;
  }
  if (method === "turn/completed") {
    return `turn completed: ${params.turn?.status || "-"}`;
  }
  if (method === "item/started" || method === "item/completed") {
    return `${params.item?.type || "item"} ${method.endsWith("started") ? "started" : "completed"}`;
  }
  if (method === "item/agentMessage/delta") {
    return `agent delta: ${(params.delta || "").replace(/\s+/g, " ").slice(0, 120)}`;
  }
  if (method === "error") {
    return `error: ${params.error?.message || "unknown"}`;
  }
  if (method === "mcpServer/startupStatus/updated") {
    return `mcp ${params.name || "-"}: ${params.status || "-"}`;
  }
  if (method) {
    return method;
  }
  if (message.id != null && message.error) {
    return `response error: ${message.error.message || "unknown"}`;
  }
  if (message.id != null && message.result) {
    return `response: ${String(message.id)}`;
  }
  return "";
}

function structuredEvent(message) {
  return {
    timestamp: nowIso(),
    method: message.method || "",
    summary: summarizeMessage(message),
    payload: message,
  };
}

class AppServerClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.nextId = 1000;
    this.pending = new Map();
    this.events = [];
    this.turnEvents = [];
    this.currentTurnId = "";
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (error) => reject(error));
      ws.addEventListener("message", (event) => this.handleMessage(String(event.data)));
      ws.addEventListener("close", () => {
        for (const [, pending] of this.pending) {
          pending.reject(new Error("websocket closed"));
        }
        this.pending.clear();
      });
    });
  }

  handleMessage(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch (error) {
      this.events.push({
        timestamp: nowIso(),
        method: "client/parse-error",
        summary: `parse error: ${String(error)}`,
        payload: { raw: text },
      });
      return;
    }

    this.events.push(structuredEvent(message));
    if (message.method) {
      if (message.id != null) {
        this.respondError(message.id, "control-plane helper cannot satisfy server-initiated requests yet");
      }
      const params = message.params || {};
      if (params.turnId && (!this.currentTurnId || params.turnId === this.currentTurnId)) {
        this.turnEvents.push(structuredEvent(message));
      } else if (!params.turnId && message.method.startsWith("thread/")) {
        this.turnEvents.push(structuredEvent(message));
      }
      return;
    }

    const pending = this.pending.get(String(message.id));
    if (!pending) {
      return;
    }
    this.pending.delete(String(message.id));
    if (message.error) {
      pending.reject(new Error(message.error.message || "request failed"));
      return;
    }
    pending.resolve(message.result);
  }

  respondError(id, message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify({ id, error: { code: -32000, message } }));
  }

  sendNotification(method, params = undefined) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("websocket is not open");
    }
    const message = params === undefined ? { method } : { method, params };
    this.ws.send(JSON.stringify(message));
  }

  request(method, params, timeoutMs = 20000) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("websocket is not open"));
    }
    const id = String(this.nextId++);
    const payload = { method, id, params };
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  async initialize() {
    const result = await this.request("initialize", {
      clientInfo: {
        name: "control-plane",
        title: "Control Plane",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
      },
    });
    this.sendNotification("initialized");
    return result;
  }

  async waitForTurn(threadId, turnId, timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const terminalEvent = [...this.turnEvents].reverse().find((event) => {
        if (event.method === "turn/completed") {
          return event.payload?.params?.threadId === threadId && event.payload?.params?.turn?.id === turnId;
        }
        if (event.method === "error") {
          return event.payload?.params?.threadId === threadId && event.payload?.params?.turnId === turnId;
        }
        return false;
      });
      if (terminalEvent) {
        return terminalEvent;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("turn did not reach a terminal notification before timeout");
  }

  async close() {
    if (!this.ws) {
      return;
    }
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

function normalizeInput(content) {
  return [{ type: "text", text: String(content || ""), text_elements: [] }];
}

async function runAttach(options) {
  const client = new AppServerClient(options.wsUrl);
  try {
    await client.connect();
    await client.initialize();
    const response = await client.request("thread/start", {
      cwd: options.cwd || null,
      approvalPolicy: "never",
      sandbox: "workspace-write",
      serviceName: "control-plane",
      developerInstructions: options.developerInstructions || "You are attached from the control plane.",
      ephemeral: false,
      experimentalRawEvents: false,
      persistExtendedHistory: true,
    });
    return {
      ok: true,
      thread: response.thread,
      model: response.model,
      modelProvider: response.modelProvider,
      events: client.events,
    };
  } finally {
    await client.close();
  }
}

async function runSendTurn(options) {
  const client = new AppServerClient(options.wsUrl);
  try {
    await client.connect();
    await client.initialize();
    await client.request("thread/resume", {
      threadId: options.threadId,
      path: options.threadPath || null,
      persistExtendedHistory: true,
    });
    const response = await client.request("turn/start", {
      threadId: options.threadId,
      input: normalizeInput(options.content),
    });
    const turnId = response.turn?.id || "";
    client.currentTurnId = turnId;
    let terminalEvent = null;
    try {
      terminalEvent = await client.waitForTurn(options.threadId, turnId);
    } catch (error) {
      terminalEvent = {
        timestamp: nowIso(),
        method: "turn/timeout",
        summary: String(error.message || error),
        payload: { threadId: options.threadId, turnId },
      };
      client.turnEvents.push(terminalEvent);
    }

    return {
      ok: true,
      threadId: options.threadId,
      turnId,
      turnStatus: terminalEvent?.method === "turn/completed"
        ? terminalEvent.payload?.params?.turn?.status || "completed"
        : "failed",
      terminalEvent,
      events: client.turnEvents,
    };
  } finally {
    await client.close();
  }
}

async function main() {
  const action = process.argv[2];
  const raw = await readStdin();
  const options = raw ? JSON.parse(raw) : {};

  if (!action) {
    throw new Error("action is required");
  }

  let result;
  if (action === "attach") {
    result = await runAttach(options);
  } else if (action === "send-turn") {
    result = await runSendTurn(options);
  } else {
    throw new Error(`unsupported action: ${action}`);
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exit(1);
});
