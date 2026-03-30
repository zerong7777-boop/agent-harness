# AgentFlow

AgentFlow is a local control plane for long-running AI coding workflows.

It is built for people who have already outgrown one-off chat sessions and want a persistent way to manage tasks, runtime state, sessions, handoffs, and memory in one place.

## Why

Most agent workflows break down in the same places:

- long-running tasks lose context
- multi-task execution becomes hard to track
- runtime state, decisions, and outputs drift apart
- useful knowledge stays trapped inside past sessions

AgentFlow is an attempt to turn that mess into a usable local system:

- tasks are first-class objects
- sessions and runtime state are tracked explicitly
- handoff and memory are durable
- a GUI sits on top of the control plane instead of replacing it

## What It Does

Current repo capabilities:

- Track tasks, phases, decisions, experiments, and findings as Markdown source records
- Maintain task memory, session memory, and runtime metadata
- Generate JSON indexes for GUI and other read-side consumers
- Run a local control-plane server for task inspection and mutation
- Provide a GUI for task switching, runtime status, handoff, and session flow
- Keep reusable workflow docs and skill references close to the execution layer

## Who It Is For

AgentFlow is currently best suited to:

- AI coding power users running long-lived work across multiple tasks
- solo builders who want a local orchestration layer, not just a chat UI
- developers exploring persistent agent workflows, runtime management, and structured handoff

It is not yet a polished end-user product, and it is not a generic team project manager.

## Current Status

This project is still early.

Right now the schema and control-plane model are more mature than the frontend. The runtime path toward real Codex-backed execution exists, but the UI is still being refactored and simplified.

You should think of the repo today as:

- a working local orchestration prototype
- a design space for persistent agent workflows
- a base for future cleanup, packaging, and community-facing polish

## Quickstart

Rebuild the derived indexes:

```powershell
py -3 .\scripts\build_indexes.py
```

Start the control-plane server:

```powershell
py -3 .\scripts\control_plane_server.py
```

Then open:

```text
http://localhost:4173/gui/
```

## Repo Map

The most important directories are:

- `docs/workflow/`: control-plane architecture, schema, runtime, and mapping docs
- `tasks/`: task templates and task-local source structures
- `knowledge/`: approved knowledge formats and templates
- `skills/`: mirrored skill docs and bundled system skills
- `skills-registry/`: metadata for skill sources and local skill records
- `scripts/`: control-plane server, index builder, runtime helpers
- `gui/`: current GUI plus the next frontend scaffold
- `guides/`: operational guides such as remote execution patterns

For a reader-friendly system overview, start with [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Design Principles

- Markdown is the source of truth
- JSON indexes are derived read models
- runtime state should be inspectable, not hidden in chat history
- handoff and memory should survive across sessions
- the GUI should reflect the control plane, not invent a separate model

## What This Repo Does Not Contain

The public repository intentionally excludes:

- local auth files
- personal runtime databases and logs
- private machine records
- task-instance data from local experiments
- private session traces

The repo is meant to publish the framework, not the private operating history behind it.

## Roadmap Direction

Near-term work is concentrated around:

- making the GUI simpler and more trustworthy
- tightening the task/runtime/session model
- improving real runtime attachment and session visibility
- making the public repo easier for others to clone, understand, and adapt

## License

See [LICENSE](./LICENSE).
