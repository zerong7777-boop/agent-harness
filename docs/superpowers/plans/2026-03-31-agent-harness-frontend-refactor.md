# Agent Harness Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile multi-script GUI with a single Vite + TypeScript frontend that keeps task management, runtime control, session history, and archive flows usable for long-term daily work.

**Architecture:** Keep the Python control plane and JSON indexes as the backend contract. Build a new task-centered frontend under `gui/app/src/` with a stable shell, explicit state store, and view modules for `overview / plan / runtime / experiment / session`. Legacy JS remains only as a fallback until the new app reaches parity, then the served `/gui/` entry switches fully to the built app.

**Tech Stack:** Python control-plane server, Vite, TypeScript, native DOM, existing JSON indexes and runtime APIs

---

### Task 1: Lock down the backend contract for the new frontend

**Files:**
- Modify: `E:/codex-home/scripts/control_plane_server.py`
- Modify: `E:/codex-home/scripts/build_indexes.py`
- Modify: `E:/codex-home/docs/ARCHITECTURE.md`
- Test: `py -3 E:/codex-home/scripts/control_plane_server.py --port 4173`

- [ ] **Step 1: Preserve the current routing contract explicitly**

Document and keep these routes stable:

```text
GET  /gui/
GET  /indexes/overview.json
GET  /indexes/tasks.json
GET  /indexes/task-details/<task-id>.json
GET  /indexes/accounts.json
GET  /indexes/machines.json
POST /api/tasks/create
POST /api/tasks/advance-stage
POST /api/tasks/set-terminal-state
POST /api/runtime/probe-app-server
POST /api/runtime/attach-app-server
POST /api/runtime/send-message
```

- [ ] **Step 2: Keep `/indexes/*` sourced from `data_root`**

Expected code location:

```python
if request_path == "/indexes" or request_path.startswith("/indexes/"):
    ...
    return str(candidate)
```

Expected: the frontend always sees `E:\agent-harness-data`, not repo-root stale indexes.

- [ ] **Step 3: Keep the “default data root” behavior**

Expected code shape:

```python
DEFAULT_PRIVATE_DATA_ROOT = REPO_ROOT.with_name("agent-harness-data")

def get_default_data_root() -> Path:
    if DEFAULT_PRIVATE_DATA_ROOT.exists():
        return DEFAULT_PRIVATE_DATA_ROOT
    return REPO_ROOT
```

- [ ] **Step 4: Verify route contract manually**

Run:

```powershell
py -3 .\scripts\control_plane_server.py --port 4173
```

Expected:
- `/gui/` returns `200`
- `/indexes/tasks.json` returns tasks from `E:\agent-harness-data`


### Task 2: Turn the Vite app into the new real frontend entry

**Files:**
- Modify: `E:/codex-home/gui/app/index.html`
- Modify: `E:/codex-home/gui/app/src/main.ts`
- Modify: `E:/codex-home/gui/app/src/styles.css`
- Modify: `E:/codex-home/gui/vite.config.ts`
- Modify: `E:/codex-home/gui/package.json`
- Test: `npm run build`

- [ ] **Step 1: Make the Vite app the real target shell**

Use a single app root:

```html
<body>
  <div id="app"></div>
</body>
```

Do not rely on legacy HTML sections like:
- `left-rail`
- `workspace-grid`
- `detail-sidebar`

- [ ] **Step 2: Keep `/gui/` as the mounted base**

Expected config:

```ts
export default defineConfig({
  root: resolve(__dirname, "app"),
  base: "/gui/",
  ...
})
```

- [ ] **Step 3: Ensure dev mode proxies the Python server**

Expected config:

```ts
proxy: {
  "/api": "http://127.0.0.1:4173",
  "/indexes": "http://127.0.0.1:4173",
}
```

- [ ] **Step 4: Build the frontend**

Run:

```powershell
cd E:\codex-home\gui
npm run build
```

Expected:
- Vite build succeeds
- `E:\codex-home\gui\dist\index.html` exists


### Task 3: Introduce a single state and API layer

**Files:**
- Create: `E:/codex-home/gui/app/src/api.ts`
- Create: `E:/codex-home/gui/app/src/state.ts`
- Create: `E:/codex-home/gui/app/src/types.ts`
- Modify: `E:/codex-home/gui/app/src/main.ts`
- Test: `npm run build`

- [ ] **Step 1: Move request helpers out of `main.ts`**

Create `api.ts` with:

```ts
export async function fetchJson<T>(path: string): Promise<T> { ... }
export async function postJson<T>(path: string, payload: unknown): Promise<T> { ... }
```

- [ ] **Step 2: Define shared frontend types**

Create `types.ts` for:
- `TaskSummary`
- `TaskDetail`
- `RuntimeStatus`
- `OverviewIndex`

- [ ] **Step 3: Create one app state container**

Create `state.ts` with:

```ts
export type TabId = "overview" | "plan" | "runtime" | "experiment" | "session";

export const state = {
  overview: null,
  tasks: [],
  taskDetails: new Map(),
  selectedTaskId: null,
  selectedTab: "overview" as TabId,
  showArchivedTasks: false,
  createTaskOpen: false,
};
```

- [ ] **Step 4: Remove duplicated state from `main.ts`**

Expected: `main.ts` imports state and API helpers, rather than defining parallel versions.


### Task 4: Build the long-term workspace shell

**Files:**
- Create: `E:/codex-home/gui/app/src/render-shell.ts`
- Create: `E:/codex-home/gui/app/src/render-task-list.ts`
- Modify: `E:/codex-home/gui/app/src/main.ts`
- Modify: `E:/codex-home/gui/app/src/styles.css`
- Test: `npm run build`

- [ ] **Step 1: Render a three-part shell**

Shell structure:

```html
<div class="shell">
  <header class="topbar"></header>
  <aside class="task-sidebar"></aside>
  <main class="workspace"></main>
</div>
```

- [ ] **Step 2: Keep the topbar minimal**

Include:
- brand
- refresh
- guide/help
- resources/settings entry

- [ ] **Step 3: Build the task sidebar**

Default rows should show:
- title
- stage
- `LIVE / STUB / OFFLINE`
- a small blocked / pending indicator

Do not show detailed summaries by default.

- [ ] **Step 4: Add archive filter controls**

Sidebar filter states:
- active
- all
- archived

Expected behavior:
- archived tasks hidden by default
- archived tasks can be restored


### Task 5: Implement the task overview and plan views

**Files:**
- Create: `E:/codex-home/gui/app/src/render-overview.ts`
- Create: `E:/codex-home/gui/app/src/render-plan.ts`
- Modify: `E:/codex-home/gui/app/src/main.ts`
- Modify: `E:/codex-home/gui/app/src/styles.css`
- Test: `npm run build`

- [ ] **Step 1: Make `overview` the default tab**

Expected:

```ts
state.selectedTab = "overview";
```

- [ ] **Step 2: Render an overview page with only high-value information**

Show:
- task title
- one-line summary
- current stage / phase
- next step
- blocked state
- recent key conclusion
- archive / restore action

- [ ] **Step 3: Render the plan page**

Show:
- task definition summary
- plan summary
- phase list
- stage-advance button

- [ ] **Step 4: Keep advanced details hidden**

Do not dump raw metadata blocks directly into the default view.


### Task 6: Implement the runtime view as the main interaction surface

**Files:**
- Create: `E:/codex-home/gui/app/src/render-runtime.ts`
- Modify: `E:/codex-home/gui/app/src/api.ts`
- Modify: `E:/codex-home/gui/app/src/main.ts`
- Modify: `E:/codex-home/gui/app/src/styles.css`
- Test: `npm run build`

- [ ] **Step 1: Keep the real-session guard**

A message can be sent only when:

```ts
probe === "ready" &&
attach === "attached" &&
bridge === "running"
```

- [ ] **Step 2: Render runtime in this order**

1. connection status
2. latest assistant reply
3. input box
4. send message / send handoff
5. advanced runtime details (collapsed)

- [ ] **Step 3: Keep “latest reply” prominent**

Do not force users to search event logs for the actual answer.

- [ ] **Step 4: Keep low-level details inside a collapsible section**

Hide by default:
- bridge pid
- ws url
- thread id
- raw runtime metadata


### Task 7: Implement experiments and session history as secondary views

**Files:**
- Create: `E:/codex-home/gui/app/src/render-experiments.ts`
- Create: `E:/codex-home/gui/app/src/render-session.ts`
- Modify: `E:/codex-home/gui/app/src/main.ts`
- Modify: `E:/codex-home/gui/app/src/styles.css`
- Test: `npm run build`

- [ ] **Step 1: Render experiment history separately from runtime**

Show:
- experiment records
- statuses
- findings
- timestamps

- [ ] **Step 2: Render session history separately from runtime**

Show:
- recent messages
- process / event flow
- latest turns

- [ ] **Step 3: Keep these as secondary tabs**

Expected:
- users can ignore them during normal flow
- they remain available when debugging or reviewing evidence


### Task 8: Retire the legacy GUI from the served path

**Files:**
- Modify: `E:/codex-home/gui/index.html`
- Modify: `E:/codex-home/scripts/control_plane_server.py`
- Modify: `E:/codex-home/gui/README.md`
- Test: `py -3 .\scripts\control_plane_server.py`

- [ ] **Step 1: Point `/gui/` to built app once parity is reached**

Expected served path:
- `gui/dist/index.html`

- [ ] **Step 2: Stop using these files as the active frontend**

Legacy-only:
- `gui/app-operable-zh.js`
- `gui/app-v3-overrides.js`
- `gui/app-v4-ui.js`

- [ ] **Step 3: Update GUI docs**

Document:
- dev mode (`npm run dev`)
- build mode (`npm run build`)
- runtime launcher requirement for real Codex sessions


### Task 9: Verify task management and archive flows end-to-end

**Files:**
- Modify: `E:/codex-home/gui/README.md`
- Test: control-plane server and GUI actions

- [ ] **Step 1: Verify task creation**

Run or click:
- create a task with title + summary

Expected:
- task appears immediately in active task list
- `indexes/tasks.json` includes it

- [ ] **Step 2: Verify archive / restore**

Run or click:
- archive a task
- switch archive filter
- restore the task

Expected:
- archived task disappears from default active list
- archived task is visible in archive filter
- restore returns it to active list

- [ ] **Step 3: Verify runtime interaction still works**

Expected:
- latest reply still shows
- send-message guard still blocks stub mode
- runtime launcher requirement remains explicit

- [ ] **Step 4: Verify no long-page stacked workspace remains**

Expected:
- single stable shell
- no DOM-rewrite workspace bug
- no broken tabs
