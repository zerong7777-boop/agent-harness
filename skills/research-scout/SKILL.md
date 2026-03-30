---
name: research-scout
description: Use when you need to inspect a repo, paper, README, configs, logs, or prior notes before making changes. Produces a short implementation brief with candidate insertion points, recommended plan, rejected options, and concrete risks.
---

# Research Scout

Use this skill when the task is still in the "understand before changing" phase.

## Goals

- Find where the relevant implementation actually lives.
- Reduce the change surface before coding starts.
- Convert vague ideas into a short, actionable brief.

## Workflow

1. Read only the smallest set of files needed to localize the mechanism.
2. Prefer primary artifacts:
   - repository code
   - official README
   - configs
   - logs
   - paper or project notes supplied by the user
3. Identify:
   - the current baseline path
   - the likely insertion points
   - the minimum files that must change
   - assumptions that still need verification
4. If multiple designs are possible, shortlist at most 3.
5. Recommend 1 plan and explain why it is the lowest-risk next move.

## Output Format

Return a compact brief with these headings:

`Baseline Path`

`Candidate Insertion Points`

`Recommended Plan`

`Rejected Options`

`Risks / Unknowns`

## Guardrails

- Do not start editing while using this skill.
- Do not produce broad architecture rewrites unless the user asked for them.
- Prefer low-variance integration points over "clever" redesigns.
- When the project already has `docs/ai/` or `.repro/`, read the latest status before proposing a plan.
