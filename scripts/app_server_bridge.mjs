import process from "node:process";
import readline from "node:readline";

function nowIso() {
  return new Date().toISOString();
}

function summarizeMessage(message) {
  if (!message || typeof message !== "object") return "";
  const method = message.method || "";
  const params = message.params || {};
  if (method === "thread/started") return `thread started: ${params.thread?.id || "-"}`;
  if (method === "thread/status/changed") return `thread status: ${params.status?.type || "-"}`;
  if (method === "turn/started") return `turn started: ${params.turn?.id || "-"}`;
  if (method === "turn/completed") return `turn completed: ${params.turn?.status || "-"}`;
  if (method === "item/started" || method === "item/completed") {
    return `${params.item?.type || "item"} ${method.endsWith("started") ? "started" : "completed"}`;
  }
  if (method === "item/agentMessage/delta") {
    return `agent delta: ${(params.delta || "").replace(/\s+/g, " ").slice(0, 120)}`;
  }
  if (method === "error") return `error: ${params.error?.message || "unknown"}`;
  if (method === "mcpServer/startupStatus/updated") return `mcp ${params.name || "-"}: ${params.status || "-"}`;
  if (method) return method;
  if (message.id != null && message.error) return `response error: ${message.error.message || "unknown"}`;
  if (message.id != null && message.result) return `response: ${String(message.id)}`;
  return "";
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

class Bridge {
  constructor(options) {
    this.options = options;
    this.ws = null;
    this.nextId = 1000;
    this.pending = new Map();
    this.currentCommand = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.wsUrl);
      this.ws = ws;
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (error) => reject(error));
      ws.addEventListener("message", (event) => this.handleMessage(String(event.data)));
      ws.addEventListener("close", () => emit({ type: "bridge-closed", timestamp: nowIso() }));
    });
  }

  sendRaw(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("websocket is not open");
    }
    this.ws.send(JSON.stringify(payload));
  }

  sendNotification(method, params = undefined) {
    this.sendRaw(params === undefined ? { method } : { method, params });
  }

  request(method, params, timeoutMs = 20000) {
    const id = String(this.nextId++);
    this.sendRaw({ method, id, params });
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

  handleMessage(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch (error) {
      emit({ type: "event", timestamp: nowIso(), method: "client/parse-error", summary: String(error), payload: { raw: text } });
      return;
    }

    emit({ type: "event", timestamp: nowIso(), method: message.method || "", summary: summarizeMessage(message), payload: message });

    if (message.method) {
      if (message.id != null) {
        this.sendRaw({ id: message.id, error: { code: -32000, message: "control-plane bridge cannot satisfy server-initiated requests yet" } });
      }

      const params = message.params || {};
      if (this.currentCommand) {
        if (message.method === "turn/started" && params.turn?.id) {
          this.currentCommand.turnId = params.turn.id;
        }
        if (message.method === "error" && params.turnId === this.currentCommand.turnId) {
          emit({
            type: "command-result",
            requestId: this.currentCommand.requestId,
            turnId: this.currentCommand.turnId,
            turnStatus: "failed",
            timestamp: nowIso(),
          });
          this.currentCommand = null;
        }
        if (message.method === "turn/completed" && params.turn?.id === this.currentCommand.turnId) {
          emit({
            type: "command-result",
            requestId: this.currentCommand.requestId,
            turnId: this.currentCommand.turnId,
            turnStatus: params.turn?.status || "completed",
            timestamp: nowIso(),
          });
          this.currentCommand = null;
        }
      }
      return;
    }

    const pending = this.pending.get(String(message.id));
    if (!pending) return;
    this.pending.delete(String(message.id));
    if (message.error) {
      pending.reject(new Error(message.error.message || "request failed"));
      return;
    }
    pending.resolve(message.result);
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "control-plane-bridge", title: "Control Plane Bridge", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.sendNotification("initialized");
  }

  async attach() {
    const response = await this.request("thread/start", {
      cwd: this.options.cwd || null,
      approvalPolicy: "never",
      sandbox: "workspace-write",
      serviceName: "control-plane",
      developerInstructions: this.options.developerInstructions || "You are attached from the control plane.",
      ephemeral: false,
      experimentalRawEvents: false,
      persistExtendedHistory: true,
    });
    this.options.threadId = response.thread?.id || "";
    emit({
      type: "attached",
      timestamp: nowIso(),
      thread: response.thread,
      model: response.model,
      modelProvider: response.modelProvider,
    });
  }

  async handleCommand(line) {
    if (!line.trim()) return;
    const command = JSON.parse(line);
    if (command.action === "send-turn") {
      if (this.currentCommand) {
        emit({ type: "command-result", requestId: command.requestId, turnId: "", turnStatus: "rejected", timestamp: nowIso(), error: "a turn is already active" });
        return;
      }
      this.currentCommand = { requestId: command.requestId, turnId: "" };
      const response = await this.request("turn/start", {
        threadId: this.options.threadId,
        input: [{ type: "text", text: String(command.content || ""), text_elements: [] }],
      });
      this.currentCommand.turnId = response.turn?.id || "";
      emit({
        type: "command-ack",
        requestId: command.requestId,
        turnId: this.currentCommand.turnId,
        timestamp: nowIso(),
      });
      return;
    }
    if (command.action === "shutdown") {
      emit({ type: "bridge-shutdown", timestamp: nowIso() });
      process.exit(0);
    }
  }
}

async function main() {
  const rawOptions = process.argv[2];
  if (!rawOptions) throw new Error("bridge options are required");
  const options = JSON.parse(rawOptions);
  const bridge = new Bridge(options);
  await bridge.connect();
  await bridge.initialize();
  await bridge.attach();

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    try {
      await bridge.handleCommand(line);
    } catch (error) {
      emit({ type: "bridge-error", timestamp: nowIso(), error: error.stack || error.message || String(error) });
    }
  });
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exit(1);
});
