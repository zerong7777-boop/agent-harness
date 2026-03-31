# Agent Harness Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first workspace expansion slice by introducing top-level navigation and an `Assets` entry that supports both global browsing and task-context recommendations.

**Architecture:** Keep `Tasks` as the default operational surface, but add a stable top-level navigation shell that can host `Tasks / Assets / Accounts / Knowledge`. For this phase, only `Tasks` and `Assets` become real product surfaces. The backend grows a read-only asset indexing layer over repo-root resources (`skills`, `guides`, `rules`, templates, and knowledge links), while the frontend adds a category-overview-first assets page and a compact “recommended assets” block inside task overview.

**Tech Stack:** Python control-plane server, Python asset index generation, Vite, TypeScript, native DOM, JSON indexes, existing private data root + repo root split

---

## Scope Check

The spec covers three independent future subsystems:

- `Assets`
- `Accounts / Routing`
- `Knowledge / Review`

This plan intentionally covers only the first working slice:

1. top-level navigation shell
2. the `Assets` page
3. task-context asset recommendations

`Accounts / Routing` and `Knowledge / Review` should get their own implementation plans after this slice lands and is verified.

## File Structure

### Backend / indexing

- Modify: `E:/codex-home/scripts/build_indexes.py`
  - add asset discovery/index generation
  - add task-context recommendation derivation
- Modify: `E:/codex-home/scripts/control_plane_server.py`
  - serve the new asset index from `/indexes/assets.json`
  - continue serving task details with no schema break
- Modify: `E:/codex-home/gui/app/src/api.ts`
  - add asset index loading
- Modify: `E:/codex-home/gui/app/src/types.ts`
  - add asset types, workspace top-nav types, task recommendation types

### Frontend app shell

- Modify: `E:/codex-home/gui/app/src/app.ts`
  - stop treating the app as “tasks only”
  - introduce first-level navigation state
- Create: `E:/codex-home/gui/app/src/state.ts`
  - centralize top-level view state and selections
- Create: `E:/codex-home/gui/app/src/views/top-nav.ts`
  - render `Tasks / Assets / Accounts / Knowledge`
- Create: `E:/codex-home/gui/app/src/views/tasks-view.ts`
  - task shell wrapper around existing task list/workspace rendering
- Create: `E:/codex-home/gui/app/src/views/assets-view.ts`
  - global assets page
- Create: `E:/codex-home/gui/app/src/views/task-assets.ts`
  - task-context recommendation block inside task overview
- Modify: `E:/codex-home/gui/app/src/styles-v2.css`
  - add top-level nav styles
  - add assets page styles
  - add collapsible grouped-section styles

### Docs

- Modify: `E:/codex-home/README.md`
  - mention the expanded top-level workspace
- Modify: `E:/codex-home/docs/ARCHITECTURE.md`
  - document the new `Assets` read model
- Modify: `E:/codex-home/gui/README.md`
  - describe the new top-level navigation and assets entry

---

### Task 1: Add the asset read model and recommendation index

**Files:**
- Modify: `E:/codex-home/scripts/build_indexes.py`
- Test: `py -3 E:/codex-home/scripts/build_indexes.py --root E:\agent-harness-data`

- [ ] **Step 1: Define the asset index shape**

Add a top-level JSON payload shape in the index builder that can serialize:

```python
{
    "generated_at": "...",
    "categories": [
        {
            "id": "skills",
            "title": "Skills",
            "description": "Workflow and execution skills available to the workspace.",
            "count": 0,
            "default_expanded": True,
            "items": [],
        }
    ],
    "task_recommendations": {
        "clarification": [],
        "planning": [],
        "execution": [],
        "verification": [],
        "knowledge-review": [],
    },
}
```

- [ ] **Step 2: Discover assets from repo-root sources**

Extend the builder to scan these repo-root sources:

```python
REPO_ROOT / "skills"
REPO_ROOT / "guides"
REPO_ROOT / "rules"
REPO_ROOT / "tasks" / "_templates"
REPO_ROOT / "knowledge"
REPO_ROOT / "skills-registry"
```

Asset discovery rules:
- `skills`: any `SKILL.md` under `skills/`
- `guides`: any `*.md` under `guides/`
- `rules`: any `*.rules` under `rules/`
- `templates`: selected template files under `tasks/_templates`
- `knowledge_links`: links derived from `knowledge/README.md` and `skills-registry`

- [ ] **Step 3: Normalize per-category item records**

Emit normalized category items like:

```python
{
    "asset_id": "skills:experiment-verifier",
    "category": "skills",
    "title": "experiment-verifier",
    "summary": "Validate runs through smoke tests, evals, or ablations.",
    "source_path": "E:/codex-home/skills/experiment-verifier/SKILL.md",
    "status": "active",
    "phase_hints": ["execution", "verification"],
    "tags": ["experiment", "verification"],
}
```

Use category-specific defaults:
- `skills`: derive title/summary from `SKILL.md` frontmatter/content
- `guides`: derive summary from heading + opening paragraph
- `rules`: derive summary from filename + first non-empty comment
- `templates`: derive summary from filename + folder purpose

- [ ] **Step 4: Add task-context recommendation derivation**

Create recommendation buckets keyed by task stage:

```python
STAGE_TO_RECOMMENDED_TAGS = {
    "clarification": ["brainstorming", "spec", "handoff"],
    "planning": ["plan", "design", "task-breakdown"],
    "execution": ["runtime", "experiment", "machine", "implementation"],
    "verification": ["verification", "review", "handoff"],
    "knowledge-review": ["memory", "handoff", "knowledge"],
}
```

For each stage, keep only the top few matching assets:

```python
recommendations = assets_for_stage[:5]
```

- [ ] **Step 5: Write the new index file**

Emit:

```python
write_json(indexes_dir / "assets.json", asset_payload)
```

Run:

```powershell
py -3 .\scripts\build_indexes.py --root E:\agent-harness-data
```

Expected:
- `E:\agent-harness-data\indexes\assets.json` exists
- categories include `skills`, `guides`, `rules`, `templates`, `knowledge_links`


### Task 2: Expose the asset index to the frontend

**Files:**
- Modify: `E:/codex-home/scripts/control_plane_server.py`
- Modify: `E:/codex-home/gui/app/src/api.ts`
- Modify: `E:/codex-home/gui/app/src/types.ts`
- Test: `py -3 E:/codex-home/scripts/control_plane_server.py`

- [ ] **Step 1: Keep `/indexes/assets.json` in the served index namespace**

Ensure the existing `/indexes/*` file-serving logic covers the new file with no special route needed:

```python
if request_path == "/indexes" or request_path.startswith("/indexes/"):
    ...
```

Expected: no new custom HTTP handler is required beyond the existing data-root index serving.

- [ ] **Step 2: Add frontend loader**

Add to `api.ts`:

```ts
export async function loadAssets(): Promise<AssetsIndex> {
  return fetchJson<AssetsIndex>("/indexes/assets.json");
}
```

- [ ] **Step 3: Add frontend types**

Add to `types.ts`:

```ts
export type TopLevelView = "tasks" | "assets" | "accounts" | "knowledge";

export type AssetCategoryId =
  | "skills"
  | "guides"
  | "rules"
  | "templates"
  | "knowledge_links";

export type AssetItem = {
  asset_id: string;
  category: AssetCategoryId;
  title: string;
  summary?: string;
  source_path?: string;
  status?: string;
  phase_hints?: string[];
  tags?: string[];
};

export type AssetCategory = {
  id: AssetCategoryId;
  title: string;
  description?: string;
  count: number;
  default_expanded: boolean;
  items: AssetItem[];
};

export type AssetsIndex = {
  generated_at?: string;
  categories: AssetCategory[];
  task_recommendations?: Record<string, AssetItem[]>;
};
```

- [ ] **Step 4: Add task recommendation type to task detail rendering**

Extend task-side typing to support a lightweight recommendation block:

```ts
export type RecommendedAsset = {
  asset_id: string;
  title: string;
  category: AssetCategoryId;
  summary?: string;
};
```

Expected: the frontend can render recommendation cards without re-parsing raw markdown.


### Task 3: Add the top-level workspace navigation shell

**Files:**
- Create: `E:/codex-home/gui/app/src/state.ts`
- Create: `E:/codex-home/gui/app/src/views/top-nav.ts`
- Create: `E:/codex-home/gui/app/src/views/tasks-view.ts`
- Modify: `E:/codex-home/gui/app/src/app.ts`
- Modify: `E:/codex-home/gui/app/src/styles-v2.css`
- Test: `cd E:\codex-home\gui; npm run build`

- [ ] **Step 1: Move top-level app state into a dedicated module**

Create `state.ts`:

```ts
import type { TopLevelView, TaskFilter } from "./types";

export type AppState = {
  currentView: TopLevelView;
  selectedTaskId: string | null;
  selectedTaskTab: "overview" | "plan" | "runtime" | "experiment" | "session";
  taskFilter: TaskFilter;
  expandedAssetCategories: Set<string>;
};
```

- [ ] **Step 2: Render a top-level nav strip**

Create `views/top-nav.ts` to render:

```ts
const ITEMS = [
  { id: "tasks", label: "任务" },
  { id: "assets", label: "资产" },
  { id: "accounts", label: "账号 / 路由", disabled: true },
  { id: "knowledge", label: "知识 / 复盘", disabled: true },
];
```

Only `tasks` and `assets` should be interactive in this phase.

- [ ] **Step 3: Wrap the existing task workspace in a `Tasks` view**

Create `views/tasks-view.ts` that hosts:

```ts
renderTaskSidebar(...)
renderTaskWorkspace(...)
```

Expected: the current task-centered behavior remains intact, but is now one top-level view instead of the whole app.

- [ ] **Step 4: Use the new shell in `app.ts`**

Render structure:

```ts
<div class="app-shell">
  {renderTopbar()}
  {renderTopLevelNav()}
  {renderCurrentView()}
</div>
```

Expected:
- `Tasks` is the default selected view
- `Assets` is reachable without disturbing task data flow


### Task 4: Implement the top-level Assets page

**Files:**
- Create: `E:/codex-home/gui/app/src/views/assets-view.ts`
- Modify: `E:/codex-home/gui/app/src/app.ts`
- Modify: `E:/codex-home/gui/app/src/styles-v2.css`
- Test: `cd E:\codex-home\gui; npm run build`

- [ ] **Step 1: Render a category-overview-first assets page**

The page header should show:

```ts
title: "资产"
subtitle: "按分类浏览支持任务推进的 skills、guides、rules 和模板。"
```

Under that, render a compact category overview:

```ts
Skills / Guides / Rules / Templates / Knowledge Links
```

with item counts and short descriptions.

- [ ] **Step 2: Render collapsible grouped sections**

Each category block should follow:

```ts
<section class="asset-group">
  <button class="asset-group-toggle">...</button>
  <div class="asset-group-body">...</div>
</section>
```

Expected defaults:
- expanded: `skills`, `guides`
- collapsed: `rules`, `templates`, `knowledge_links`

- [ ] **Step 3: Render item cards inside expanded groups**

Each item card should show:

```ts
title
summary
status/source metadata
phase hints
```

Do not dump raw file contents.

- [ ] **Step 4: Keep this page browsing-oriented, not file-browser-oriented**

Expected:
- no raw path table as the primary view
- no huge metadata grids
- no attempt to render the whole markdown file inline


### Task 5: Add recommended assets to the task overview

**Files:**
- Create: `E:/codex-home/gui/app/src/views/task-assets.ts`
- Modify: `E:/codex-home/gui/app/src/app.ts`
- Modify: `E:/codex-home/gui/app/src/styles-v2.css`
- Test: `cd E:\codex-home\gui; npm run build`

- [ ] **Step 1: Resolve recommendations from current task stage**

In task overview rendering, map the current task stage:

```ts
const stage = detail?.memory?.index?.current_stage ?? task.stage ?? "execution";
const recommended = assetsIndex.task_recommendations?.[stage] ?? [];
```

- [ ] **Step 2: Render a compact “推荐资产” block**

Create `task-assets.ts` and render:

```ts
<section class="panel-block">
  <div class="section-head">
    <h3>推荐资产</h3>
    <button data-view="assets">打开资产库</button>
  </div>
  <div class="asset-recommendation-list">...</div>
</section>
```

Show at most the top 3 to 5 items.

- [ ] **Step 3: Keep recommendation cards concise**

Each recommendation should show:

```ts
title
category badge
one-line summary
```

Expected: this block should help the user decide what to use next, not replace the full assets page.

- [ ] **Step 4: Keep recommendation logic phase-aware**

Expected sample behavior:
- `clarification` -> brainstorming/spec/handoff assets
- `execution` -> runtime/experiment/machine assets
- `verification` -> verification/review/memory assets


### Task 6: Update docs and verify the slice end-to-end

**Files:**
- Modify: `E:/codex-home/README.md`
- Modify: `E:/codex-home/docs/ARCHITECTURE.md`
- Modify: `E:/codex-home/gui/README.md`
- Test: `cd E:\codex-home\gui; npm run build`
- Test: `py -3 E:/codex-home/scripts/build_indexes.py --root E:\agent-harness-data`
- Test: `py -3 E:/codex-home/scripts/control_plane_server.py`

- [ ] **Step 1: Update public docs**

Add concise wording:

```md
- Tasks
- Assets
- Accounts / Routing (planned)
- Knowledge / Review (planned)
```

Make it explicit that the current delivered expansion slice is `Assets`.

- [ ] **Step 2: Verify the asset index**

Run:

```powershell
py -3 .\scripts\build_indexes.py --root E:\agent-harness-data
```

Expected:
- `assets.json` is regenerated
- counts and categories are populated

- [ ] **Step 3: Verify the frontend build**

Run:

```powershell
cd E:\codex-home\gui
npm run build
```

Expected:
- build succeeds
- dist includes the assets page bundle

- [ ] **Step 4: Verify the workspace behavior manually**

Run:

```powershell
py -3 .\scripts\control_plane_server.py
```

Expected:
- top-level nav shows `任务 / 资产 / 账号 / 知识`
- `任务` remains the default page
- `资产` opens and shows collapsible groups
- task `概览` shows a compact `推荐资产` block
- current task creation, archive, and runtime actions still work

---

## Self-Review

### Spec coverage

Covered in this plan:
- top-level navigation model
- `Assets` page
- category-overview-first structure
- collapsible groups
- default expansion of `Skills + Guides`
- task-context recommendations
- keeping `Tasks` primary

Deferred to later plans:
- `Accounts / Routing`
- `Knowledge / Review`
- automated quota scraping

### Placeholder scan

No `TODO`/`TBD` placeholders remain. The plan intentionally avoids vague “add support” wording and instead names exact files, routes, data shapes, and verification commands.

### Type consistency

This plan uses these exact names consistently:
- `TopLevelView`
- `AssetsIndex`
- `AssetCategory`
- `AssetItem`
- `RecommendedAsset`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-31-agent-harness-assets-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
