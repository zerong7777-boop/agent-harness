# AgentFlow Architecture

AgentFlow is a local control plane for long-running AI coding workflows.

It is designed for users who want more than a chat window: they want tasks, runtime state, sessions, handoffs, and memory to stay visible and durable while work continues over time.

## System Shape

At a high level, AgentFlow has three layers:

1. Source records
   Human-readable Markdown files are the source of truth.

2. Derived read models
   JSON indexes are generated from the Markdown records so the GUI and other consumers can read stable summaries without reparsing the entire workspace.

3. Runtime and interface
   A Python control-plane server exposes task actions and runtime operations, while the GUI presents the current task, runtime state, and recent session activity.

## Core Objects

### Task

A task is the main unit of work.

Each task has:

- a stable task id
- a stage and active phase
- plans, decisions, experiments, findings, and knowledge candidates
- task memory and session history

Tasks are first-class objects because the system is task-centered, not chat-centered.

### Runtime

`Task Runtime` tracks the execution state for a task.

It answers questions like:

- is this task currently idle, running, waiting for the user, or stopped
- which session is the current primary session
- which account, machine, and working directory are bound to the current run
- whether a real app-server-backed path is attached or the task is still on a stub path

Runtime exists so execution state is explicit instead of being hidden inside chat history.

### Session

A session is the execution and interaction record for one task-scoped thread of work.

Sessions hold:

- event logs
- working cache
- summaries
- handoff state
- attachment references

A task may have multiple sessions over time, but only one is the current primary session.

### Memory

AgentFlow separates long-term task memory from session-local memory.

- `Task Memory` is the durable task-level summary
- `Session Memory` captures per-session context, events, and handoff material

This split keeps the main task state compact while still preserving the trace needed to resume or audit prior work.

### Skills Registry

The skills registry records where reusable skills come from and how they are used locally.

It separates:

- upstream sources
- local skill records
- runtime availability
- governance state such as candidate, trial, adopted, or frozen

This makes the workspace methodical about workflow capabilities instead of treating skills as undocumented prompt fragments.

## Data Flow

The default data flow is:

1. A task, runtime, or session record is written in Markdown
2. The index builder generates JSON summaries under `indexes/`
3. The GUI reads those indexes to render task state and runtime state
4. The control-plane server performs approved mutations and writes the source records back to disk

This keeps the system inspectable.

The GUI does not own the model. The Markdown records do.

## Execution Model

AgentFlow is moving from a pure control-plane stub toward real task-scoped runtime attachment.

Today the execution path has two important ideas:

- a task always has an explicit runtime state
- a real attached runtime should be visible as such, not silently faked

The long-term direction is task-scoped, persistent execution. Instead of treating every interaction as a fresh chat, AgentFlow treats a task as something that can own runtime state, a primary session, and handoff material over time.

## Repository Map

The most important parts of the repository are:

- `docs/workflow/`
  Internal control-plane, schema, and runtime documentation
- `tasks/`
  Task templates and task-local source structures
- `knowledge/`
  Approved knowledge records and templates
- `skills-registry/`
  Registry records for skill sources and local skills
- `scripts/`
  Index builder, control-plane server, runtime bridge, and launcher scripts
- `gui/`
  The current interface layer and the next frontend scaffold
- `guides/`
  Operational guides such as remote execution patterns

## What Is Stable vs. What Is Evolving

More stable today:

- the task-centered object model
- Markdown source records
- derived JSON indexes
- task, session, memory, and runtime schema direction

Still evolving:

- the GUI structure and presentation
- the real runtime attachment path
- how persistent Codex-backed execution is exposed in the interface

## Read Next

If you want the public project overview, start with [README.md](../README.md).

If you want the lower-level control-plane and schema details, continue with:

- [CONTROL_PLANE.md](./workflow/CONTROL_PLANE.md)
- [SCHEMA.md](./workflow/SCHEMA.md)
- [TASK_RUNTIME.md](./workflow/TASK_RUNTIME.md)
