---
name: module-implementer
description: Use when a concrete implementation plan has already been selected and code changes should be made. Focuses on small-scope edits, clear file ownership, minimal diffs, and immediate smoke validation.
---

# Module Implementer

Use this skill after the implementation path is already chosen.

## Goals

- Turn an agreed plan into code with minimal drift.
- Keep changes small enough to verify and roll back.
- Preserve a clean baseline-vs-modified comparison.

## Workflow

1. Restate the exact change in one sentence before editing.
2. Limit edits to the smallest file set that can realize the change.
3. Keep the baseline path intact whenever possible:
   - add a switch
   - add a new module
   - add a new config
   - avoid silently rewriting the only baseline path
4. Prefer incremental implementation:
   - wire interfaces first
   - add logic second
   - add optional complexity last
5. After editing, run the smallest meaningful verification:
   - import check
   - config parse
   - single command smoke run

## Output Format

Return:

`Change Intent`

`Files Changed`

`Why This Diff Is Minimal`

`Immediate Verification`

`Known Gaps`

## Guardrails

- Do not combine design exploration and implementation in one pass.
- Do not hide behavioral changes inside unrelated refactors.
- If the project is experimental, preserve a clean baseline route for ablation.
- If you discover the original plan is wrong, stop and hand back to `research-scout`.
