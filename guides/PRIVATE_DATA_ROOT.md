# Private Data Root

This guide describes how to separate the public Agent Harness repository from private local task data.

## Why

Right now the repository can act as both:

- the public code and docs repo
- the live local data root for tasks, sessions, indexes, machines, and accounts

That is risky.

If you clean the public repo, rewrite history, or remove local runtime artifacts, you can also damage real task data.

## Recommended Layout

Keep the public repository for code, docs, GUI, and templates:

```text
E:\codex-home
```

Move live private data to a separate local root such as:

```text
E:\agent-harness-data
```

Recommended private layout:

```text
E:\agent-harness-data\
  tasks\
  accounts\
  machines\
  knowledge\
  indexes\
  sessions\
  rules\
```

## How To Use It

Both the index builder and control-plane server already support `--root`.

Examples:

Rebuild indexes against the private data root:

```powershell
py -3 .\scripts\build_indexes.py --root E:\agent-harness-data
```

Start the control-plane server against the private data root:

```powershell
py -3 .\scripts\control_plane_server.py --root E:\agent-harness-data
```

## Migration Strategy

Recommended order:

1. Create the private root directory.
2. Copy current live records there:
   - `tasks/`
   - `accounts/`
   - `machines/`
   - any local `indexes/`, `sessions/`, and runtime output you still want
3. Keep templates and docs in the public repo.
4. Start the server with `--root` pointed at the private root.
5. Verify the GUI shows the expected tasks, machines, and accounts before deleting anything from the old location.

## Suggested Next Step

Once the private root is in use, treat the public repo as:

- code
- templates
- docs
- guides

and treat the private root as:

- real tasks
- real accounts
- real machines
- live runtime state
- session traces

That split is the safest way to keep the project public without risking your working data.
