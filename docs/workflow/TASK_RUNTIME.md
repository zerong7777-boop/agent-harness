# Task Runtime

`Task Runtime` is the task-level execution entry abstraction.

It does not replace `Task Memory` or `Session Memory`.

- `Task Memory` stays the durable task source.
- `Session Memory` stays the concrete per-session record.
- `Task Runtime` tracks which session is currently the primary execution session for a task and what runtime state the task is in.

## Layout

```text
tasks/<task-id>/runtime/
  index.md
  status.md
  launch.md
  history.md
```

## Responsibilities

- Expose the current runtime status for GUI and future execution adapters.
- Point to the current primary session.
- Record launch configuration and last launch result.
- Record runtime-level history such as start, stop, reconnect, primary-session switch, and outbound user or handoff messages.

## First Version Boundary

The first version is a control-plane runtime stub.

- It writes runtime and session records.
- It does not yet start a real Codex process.
- It provides the API shape that future runtime adapters can implement.

## App-Server Probe

The next adapter layer is a local `codex app-server` probe.

- It is separate from the primary-session stub start/stop flow.
- It prefers to launch a task-scoped local `codex app-server` through an external user-mode launcher at `http://127.0.0.1:4391`.
- Start that launcher with `py -3 .\scripts\runtime_launcher.py` before using real app-server-backed runtime actions from the GUI.
- If the launcher is not available, the control plane should report that explicitly instead of silently pretending the task is attached to a healthy long-lived Codex session.
- It records the websocket URL, `readyz`, `healthz`, PID, and probe timestamps in `runtime/index.md`, `runtime/status.md`, and `runtime/launch.md`.
- It is only a connectivity and health check.
- After a successful attach, GUI-originated handoff and user messages may be forwarded into the attached Codex thread.
- The attached websocket bridge is tracked separately from the app-server probe so the control plane can detect a lost bridge even if the app-server is still healthy.
- When the control-plane server shuts down, it should also stop task-owned app-server and bridge processes instead of leaving orphan background processes behind.
- The control plane still keeps the original runtime stub path as a fallback.

## Relationship To Sessions

- A task may have multiple session directories.
- Only one session is the current primary session.
- `runtime/index.md` stores the current `primary_session_id`.
- Each session records whether it is the current primary and which session superseded it.
