+++
object_kind = "plan"
title = "Example Plan"
task_id = "20260329-example-task"
plan_version = "v1"
status = "approved"
tags = []
linked_task_ids = ["20260329-example-task"]
source_refs = []
created_at = "2026-03-29T00:00:00+08:00"
updated_at = "2026-03-29T00:00:00+08:00"
+++
# Example Plan

## Milestones

- milestone: framing
- milestone: execution
- milestone: verification

## Dependency Graph

- node: collect-baseline
- depends_on: []
- node: run-ablation
- depends_on: ["collect-baseline"]
