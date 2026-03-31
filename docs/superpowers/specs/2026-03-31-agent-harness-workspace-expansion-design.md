# Agent Harness Workspace Expansion Design

Date: 2026-03-31
Status: Draft for review
Scope: Product and information-architecture expansion for the long-term local workspace

## 1. What This Spec Covers

This spec defines the next product layer above the current `Task / Runtime / Session / Memory` workspace.

The current system already supports:

- task-centric workspaces
- runtime-backed Codex sessions
- session and event tracking
- memory and handoff scaffolding

What it does not yet provide is a stable top-level product structure for long-term daily use. The next step is to expand the workspace into a small number of explicit first-class areas instead of continuing to overload the task page.

This spec covers the product structure and behavior of those areas. It does not yet implement them.

## 2. Product Direction

Agent Harness should remain a **task-execution control plane**.

That means:

- the primary entry stays task-centric
- supporting information should help tasks progress, not compete with them
- advanced details should be available, but hidden by default
- the system should feel operational, not like a file browser or dashboard pile

The workspace therefore expands into four top-level areas:

1. `Tasks`
2. `Assets`
3. `Accounts / Routing`
4. `Knowledge / Review`

These are not equal in emphasis.

The intended usage priority is:

1. `Tasks`
2. `Assets`
3. `Accounts / Routing`
4. `Knowledge / Review`

`Tasks` remains the primary execution surface. The other areas exist to support and improve task execution.

## 3. Top-Level Navigation Model

The long-term workspace should use explicit first-level navigation, not a single growing page.

Recommended first-level navigation:

- `Tasks`
- `Assets`
- `Accounts / Routing`
- `Knowledge / Review`

The current task workspace becomes the first of these four entries, not the entire product.

Each top-level entry has a clear job:

- `Tasks`
  - active task execution
  - planning
  - runtime interaction
  - experiments and session traces

- `Assets`
  - skills, guides, rules, templates, and linked knowledge resources
  - organized for task support, not generic browsing

- `Accounts / Routing`
  - account status
  - usage-aware routing
  - runtime load
  - assignment suggestions

- `Knowledge / Review`
  - retrieval-oriented structured memory
  - category-first knowledge access
  - task and phase review

## 4. Tasks

The `Tasks` area remains the default operational center.

It should continue to expose:

- task list
- task overview
- plan
- runtime
- experiments
- session history

The design principle is unchanged:

- default to concise, decision-ready summaries
- let the user reveal low-level details on demand
- keep runtime trustworthy and explicit

Within `Tasks`, the existing task-level tabs remain valid:

- `Overview`
- `Plan`
- `Runtime`
- `Experiments`
- `Session`

This spec does not replace that structure. It defines what sits beside it at the top level.

## 5. Assets

### 5.1 Purpose

`Assets` is not a filesystem browser and not a dumping ground for every local file.

It is a **task support library**.

Its job is to answer:

- what can support this work
- which assets are available
- which ones are most relevant now

### 5.2 Product Role

`Assets` exists in two forms:

1. a **top-level Assets page**
2. a **task-context recommendation layer**

The top-level page supports browsing and management.

The task-context layer supports immediate execution by recommending what matters for the current task.

### 5.3 Top-Level Assets Page

The `Assets` page should be **category-overview-first**.

Primary categories:

- `Skills`
- `Guides`
- `Rules`
- `Templates`
- `Knowledge Links`

The page should use **collapsible grouped sections**.

Default expansion:

- `Skills`
- `Guides`

Default collapsed:

- `Rules`
- `Templates`
- `Knowledge Links`

This reflects actual task support priority:

- `Skills` influence how work is executed
- `Guides` influence how work is interpreted and referenced
- `Rules` and `Templates` are secondary support layers
- `Knowledge Links` are contextual references rather than the primary exploration mode

### 5.4 Per-Category Display

Each category block should show:

- item count
- short category description
- representative items
- recent or most relevant items

Then expand into item lists with fields appropriate to that category.

Examples:

`Skills`
- name
- source
- adoption/runtime status
- applicable phases or workflows

`Guides`
- name
- scenario
- related task type
- recent usage

`Rules`
- scope
- default enabled state
- affected tasks or runtime behavior

`Templates`
- purpose
- entry point
- suggested use case

### 5.5 Task-Context Asset Recommendations

Tasks should also show a compact recommended-assets block.

This block should answer:

- what is most relevant for the current phase
- what supports the current blocker
- what assets are likely needed next

Examples:

- `clarification`
  - brainstorming skills
  - design/spec guides
  - handoff templates

- `execution`
  - runtime guides
  - experiment verifier
  - machine/project specific guides

- `verification`
  - verification skills
  - review templates
  - memory/handoff assets

This turns `Assets` into **task-aware asset routing**, not static storage.

## 6. Accounts / Routing

### 6.1 Purpose

`Accounts / Routing` is not just configuration management.

It is a **usage-aware routing surface** for task execution.

Its main questions are:

- which accounts are currently usable
- which accounts are already busy
- which tasks are bound to which accounts
- whether a new or existing task should stay on its current account

### 6.2 Priority of Concerns

The page should balance three needs, in this order:

1. `state overview`
2. `task assignment`
3. `usage risk`

That means the first screen should help the user understand the current account landscape before showing deeper quota detail.

### 6.3 Main View

The top-level page should be **account-list-first**.

Each account row should show:

- account name
- default/backup status
- current runtime status category
- current task count
- current live runtime count
- `5h remaining`
- `week remaining`
- routing recommendation

Status categories:

- `available`
- `busy`
- `risk`
- `unavailable`

The page should prefer decision-ready text such as:

- `5h remaining 38% / 1h12m`
- `week remaining 41% / 3d4h`

instead of charts-only or decorative meters.

### 6.4 Account Detail

Selecting an account should reveal:

- bound tasks
- live/stub distribution
- runtime load
- data source
- manual usage overrides
- configuration foldout

### 6.5 Data Strategy

First version data strategy:

- automatic from local runtime / CLI / observable task state
- manually correctable by the user
- future support for web usage scraping

For v1, the page may combine:

- observed runtime state
- task count and live runtime count
- manually entered values for:
  - `5h remaining`
  - `week remaining`
  - reset time
  - risk notes

The system should clearly distinguish:

- observed values
- inferred values
- manual overrides

### 6.6 Why This Exists

The point is not to become a quota dashboard.

The point is to support routing decisions:

- continue on current account
- avoid assigning a new task
- move low-risk work elsewhere
- reserve high-value accounts for important tasks

## 7. Knowledge / Review

### 7.1 Purpose

`Knowledge / Review` is not just history.

It is a retrieval-oriented memory surface that makes past work easier to reuse.

It should answer:

- what has already been learned
- what is stable and reusable
- how to find the right lesson quickly

### 7.2 Structure

This should be a single top-level page with two internal modes:

- `Knowledge`
- `Review`

This avoids creating too many first-level entries while preserving a clear split:

- `Knowledge` is future-facing retrieval
- `Review` is past-facing reflection

### 7.3 Knowledge Mode

The default mode should be category-first and retrieval-oriented.

Primary categories:

- `Engineering`
- `Algorithm`
- `Experiment`
- `Failure`
- `Preference / Decision`

The page should support filtering by:

- category
- task source
- machine
- account
- stage
- tags
- verification state
- tentative vs stable

Each knowledge entry should be able to link back to:

- task
- session
- experiment
- decision
- guide or external source

### 7.4 Review Mode

`Review` should focus on:

- task retrospectives
- phase summaries
- unresolved follow-ups
- notable runtime or experiment patterns

It is secondary to `Knowledge` and should not dominate the default experience.

## 8. UI Principles

These top-level entries must follow a consistent design language:

- task execution remains primary
- advanced detail is folded, not hidden forever
- dense enough for real daily use
- explicit, short labels
- minimal visual noise

The system should avoid:

- making every area equally prominent
- turning support areas into dashboard overload
- exposing all fields by default
- file-browser-first experiences

Recommended visual behavior:

- concise list-first layouts
- detail panes or subpanes for selected items
- compact summaries by default
- foldouts for low-level metadata

## 9. Data Flow and Boundaries

These expansions should continue to build on the current control-plane model:

- source markdown records under the private data root
- JSON indexes as read models
- GUI reading indexes and writing through explicit API mutations

This spec does not require a new backend protocol.

Likely additions will be:

- new indexes for assets
- new indexes for account routing state
- new indexes for knowledge/review queries
- new API endpoints for manual account overrides and asset/status interactions

The existing `Task / Runtime / Session / Memory` structure remains the foundation.

## 10. Recommended Delivery Order

Recommended implementation order:

1. `Assets`
2. `Accounts / Routing`
3. `Knowledge / Review`

Reasoning:

- `Assets` most directly improves task execution with limited backend complexity
- `Accounts / Routing` is highly valuable but depends on reliable runtime and account-derived data
- `Knowledge / Review` benefits from the other two being in place so that captured material is more useful

## 11. Non-Goals for This Phase

This phase does not attempt to:

- build a full filesystem browser
- build a billing analytics suite
- merge all top-level areas into one dashboard
- replace the task execution model with a chat-first UI
- provide perfect automated quota truth for every account

## 12. Summary

Agent Harness should grow into a four-entry workspace:

- `Tasks`
- `Assets`
- `Accounts / Routing`
- `Knowledge / Review`

`Tasks` remains the operational center.

`Assets` becomes a category-overview-first support library with task-aware recommendations.

`Accounts / Routing` becomes a usage-aware routing surface centered on account lists and actionable remaining-window signals.

`Knowledge / Review` becomes a retrieval-oriented memory surface with category-first access and review as a secondary mode.

This structure keeps the product task-centered while making the surrounding support systems explicit, organized, and scalable for long-term use.
