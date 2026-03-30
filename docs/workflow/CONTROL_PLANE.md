# Control Plane

`E:\codex-home` is the local control plane for long-lived task orchestration.

## Responsibilities

- Keep human-readable source records in Markdown.
- Track tasks, phases, decisions, experiments, findings, and knowledge candidates.
- Track task memory snapshots, session memory, and skills registry metadata.
- Track task runtime state and primary-session ownership for future execution adapters.
- Maintain approved knowledge separately from task-local memory.
- Represent remote machines and execution accounts as first-class resources.
- Publish derived JSON indexes for future GUI and dashboard consumers.

## Storage Model

- Source of truth: Markdown files with TOML frontmatter.
- Derived read model: JSON files under `indexes/`.
- Large experiment artifacts stay on remote machines.
- Local control-plane records store text summaries, stable references, and evidence indexes.

## Top-Level Directories

- `tasks/`: one directory per task plus templates
- `knowledge/`: approved atomic cards and task summaries
- `skills-registry/`: source and local-skill registry records
- `tasks/<task-id>/runtime/`: task-level runtime state and primary-session pointer
- `machines/`: named remote machine records
- `accounts/`: execution account records
- `indexes/`: generated JSON read models
- `docs/workflow/`: architecture and schema rules

## GUI Boundary

GUI v1 is a thin client over the control plane.

- Reads: tasks, task details, accounts, machines, pending decisions, recent findings, knowledge, timeline summaries
- Reads: task memories, session summaries, and skills registry indexes
- Allowed writes: task state metadata, pause/block flags, pending-decision queue metadata
- Disallowed writes: experiment bodies, decision bodies, knowledge bodies, schema definitions

## Remote Execution Boundary

- Remote machines keep raw logs, checkpoints, tables, and large artifacts.
- Local task records keep the machine id, remote path, artifact index, summary metrics, blockers, and conclusions.
- Every knowledge entry must backlink to a task or external source.
