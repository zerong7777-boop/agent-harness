# Memory And Registry

## Task Memory

`Task Memory` is the durable task-level memory source.

- `memory/index.md` is the lightweight entrypoint for GUI and handoff consumers.
- Detailed state lives in block files under the same directory.
- `memory/history/` stores stage rollups and key-event rollups.

## Session Memory

`Session Memory` is task-scoped but session-local.

- Each session gets its own directory under `tasks/<task-id>/sessions/<session-id>/`.
- `cache.md` is temporary working memory.
- `summary.md` and `handoff.md` are durable session outputs.
- `event-log.md` keeps near-raw external event flow for later filtering.
- `attachments-index.md` points to artifact references without copying large outputs into the repo.

## Skills Registry

`skills-registry/` separates upstream/source governance from local runtime availability.

- `sources/` describes where ideas or skills come from.
- `skills/` describes the locally tracked skill entries.
- The derived JSON index should answer both:
  - which skills are available right now
  - where they came from and what their governance status is

## Task Runtime

`Task Runtime` is separate from memory.

- It stores execution-state metadata under `tasks/<task-id>/runtime/`.
- It points to the current primary session.
- It records launch inputs and runtime-level history.
- It does not replace `Task Memory` or `Session Memory`.
