# GUI

This directory contains the current AgentFlow interface layer.

The GUI reads derived indexes from the control plane and talks to the Python server for task actions and runtime operations.

## Reads

- `indexes/overview.json`
- `indexes/tasks.json`
- `indexes/task-details/*.json`
- `indexes/accounts.json`
- `indexes/machines.json`
- `indexes/knowledge.json`

## Run

From `E:\codex-home`, start:

```powershell
py -3 .\scripts\control_plane_server.py
```

Then open:

```text
http://localhost:4173/gui/
```

## Scope

The current GUI is still evolving. Right now it focuses on:

- switching between tasks
- inspecting task state and runtime state
- reviewing recent replies and session flow
- performing control-plane actions such as task progression and runtime attachment

It should be treated as an early operator console, not a finished product UI.
