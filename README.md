# Codex Home

This directory is the preferred launch point for future Codex sessions.

## Purpose

- Keep the reusable workflow docs in one place.
- Give new Codex sessions a stable `AGENTS.md` entrypoint.
- Store copies of the custom skill docs for reference.
- Act as the control plane for tasks, knowledge, accounts, and machines.
- Separate launch-time guidance from any single project repo.

## Structure

- `AGENTS.md`: launch-time routing rules
- `guides/REMOTE_EXECUTION.md`: remote Ubuntu/Tailscale/SSH workflow
- `docs/RFVNEXT.md`: Repro Factory vNext contract and trigger guide
- `docs/SKILLS_OVERVIEW.md`: what the custom skills are for
- `docs/workflow/`: control-plane architecture, schema, state machine, and source mapping
- `tasks/`: task source data and templates
- `knowledge/`: approved knowledge entries and templates
- `machines/`: named remote machine records
- `accounts/`: account metadata records
- `indexes/`: derived JSON read models for GUI and dashboards
- `gui/`: zero-dependency control-plane dashboard
- `scripts/build_indexes.py`: rebuilds the derived indexes
- `skills/`: mirrored copies of the custom skill docs

## Usage

You can launch Codex from this directory and still work on other directories.
That is normal.

The launch directory controls the default guidance Codex reads first.
The actual task directory can still be anywhere else, including remote Linux paths outside this repo.

## Indexes

Rebuild GUI-facing indexes with:

```powershell
py -3 .\scripts\build_indexes.py
```

## GUI

Serve the repository root and open the dashboard:

```powershell
py -3 .\scripts\control_plane_server.py
```

Then visit `http://localhost:4173/gui/`.

The `gui/` directory now also contains a `Vite + TypeScript` frontend scaffold for the next GUI migration.
Legacy files remain as the current fallback until `gui/dist/` is built and served.
