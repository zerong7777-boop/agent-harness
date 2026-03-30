# Schema

## Format

Control-plane source files are Markdown documents with TOML frontmatter:

```toml
+++
object_kind = "task"
title = "Example"
created_at = "2026-03-29T10:00:00+08:00"
updated_at = "2026-03-29T10:00:00+08:00"
+++
```

Use TOML frontmatter for two reasons:

- it stays human-readable
- the index builder can parse it with the Python standard library

## Common Fields

These fields are valid on every object unless noted otherwise:

- `object_kind`
- `title`
- `created_at`
- `updated_at`
- `tags`
- `linked_task_ids`
- `source_refs`

## Task

Required task-level fields:

- `task_id`
- `stage`
- `terminal_state`
- `priority`
- `paused`
- `blocked`
- `blocker_kinds`
- `active_phase_id`
- `assignee_account_id`
- `primary_repo`
- `supporting_repos`
- `machine_ids`
- `parent_task_id`
- `parent_plan_node_id`
- `success_criteria`
- `constraints`
- `unknowns`

Directory layout:

```text
tasks/<task-id>/
  task.md
  plan.md
  phases/
  decisions/
  experiments/
  findings/
  knowledge-candidates/
  memory/
  sessions/
```

## Phase

Required phase fields:

- `phase_id`
- `phase_kind`
- `status`
- `started_at`
- `ended_at`

## Decision

Required decision fields:

- `decision_id`
- `status`
- `question`
- `options`
- `selected_option`
- `confirmed_by`
- `impact_scope`
- `needs_user_confirmation`
- `superseded_by`

## Experiment Record

Required experiment fields:

- `experiment_id`
- `status`
- `code_commit`
- `code_snapshot_id`
- `config_fingerprint`
- `machine_id`
- `remote_run_path`
- `primary_artifact`
- `primary_artifact_reason`
- `result_summary`
- `metric_keys`

Every experiment record should explain:

- purpose
- why the problem mattered
- method or external reference
- run conditions
- result
- boundary of the conclusion
- next action

## Finding

Required finding fields:

- `finding_id`
- `finding_kind`
- `stability`
- `evidence_refs`
- `related_experiment_ids`
- `related_decision_ids`

## Knowledge Candidate

Required candidate fields:

- `candidate_id`
- `candidate_kind`
- `status`
- `knowledge_layer`
- `evidence_refs`

Candidates must not be free-form diary entries. Each one should point to a specific conclusion, failure mode, preference, or experiment lesson.

## Knowledge Entry

Required knowledge fields:

- `entry_id`
- `form`
- `knowledge_layer`
- `status`
- `source_task_ids`
- `source_refs`

Two supported forms:

- `atomic-card`
- `task-summary`

## Task Memory Index

Required task-memory index fields:

- `task_id`
- `current_stage`
- `current_phase_id`
- `current_phase_kind`
- `current_phase_status`
- `current_blockers`
- `recommended_next_step`
- `last_rollup_at`
- `pending_decision_count`
- `pending_verification_count`
- `active_session_ids`
- `recent_experiment_ids`
- `recent_finding_ids`
- `recent_decision_ids`

Task memory layout:

```text
tasks/<task-id>/memory/
  index.md
  state.md
  decisions.md
  evidence.md
  open-loops.md
  handoff.md
  session-rollups.md
  knowledge-links.md
  history/
```

```text
tasks/<task-id>/runtime/
  index.md
  status.md
  launch.md
  history.md
```

## Task Memory Block

Required task-memory block fields:

- `task_id`
- `block_kind`
- `snapshot_at`
- `source_session_ids`

Supported block kinds:

- `state`
- `decisions`
- `evidence`
- `open-loops`
- `handoff`
- `session-rollups`
- `knowledge-links`

## Task Memory Rollup

Required rollup fields:

- `rollup_id`
- `task_id`
- `rollup_kind`
- `source_session_ids`
- `source_phase_ids`
- `applied_at`

## Session

Required session fields:

- `session_id`
- `task_id`
- `status`
- `mode`
- `current_focus`
- `started_at`
- `ended_at`
- `last_event_at`
- `last_rollup_at`
- `cache_retention_policy`

Session layout:

```text
tasks/<task-id>/sessions/<session-id>/
  index.md
  cache.md
  summary.md
  handoff.md
  event-log.md
  attachments-index.md
```

## Session Cache

Required session-cache fields:

- `session_id`
- `task_id`
- `cache_scope`
- `last_compacted_at`

## Session Summary

Required session-summary fields:

- `session_id`
- `task_id`
- `summary_kind`
- `covers_event_ids`
- `recommended_next_step`

## Session Handoff

Required session-handoff fields:

- `session_id`
- `task_id`
- `handoff_kind`
- `target_mode`

## Session Event Log

Required session-event-log fields:

- `session_id`
- `task_id`
- `event_count`
- `last_compacted_at`

## Session Attachments Index

Required session-attachments-index fields:

- `session_id`
- `task_id`
- `attachment_count`
- `attachment_refs`

## Task Runtime Index

Required task-runtime index fields:

- `task_id`
- `runtime_status`
- `primary_session_id`
- `session_status`
- `last_event_at`
- `last_user_action_at`
- `last_error_summary`
- `current_mode`
- `current_focus`
- `runtime_adapter`
- `app_server_probe_status`
- `app_server_port`
- `app_server_ws_url`
- `app_server_pid`
- `app_server_last_probe_at`
- `app_server_attach_status`
- `app_server_thread_id`
- `app_server_last_attach_at`
- `account_id`
- `machine_id`

## Task Runtime Status

Required task-runtime status fields:

- `task_id`
- `runtime_status`
- `primary_session_id`
- `session_status`
- `waiting_for_user`
- `last_event_summary`
- `last_message_summary`
- `last_error_detail`
- `allowed_actions`
- `current_mode`
- `current_focus`
- `runtime_adapter`
- `app_server_probe_status`
- `app_server_ready`
- `app_server_healthy`
- `app_server_port`
- `app_server_ws_url`
- `app_server_ready_url`
- `app_server_health_url`
- `app_server_pid`
- `app_server_probe_error`
- `app_server_attach_status`
- `app_server_thread_id`
- `app_server_thread_path`
- `app_server_last_turn_id`
- `account_id`
- `machine_id`
- `working_directory`

## Task Runtime Launch

Required task-runtime launch fields:

- `task_id`
- `runtime_adapter`
- `account_id`
- `machine_id`
- `working_directory`
- `app_server_port`
- `app_server_ws_url`
- `app_server_ready_url`
- `app_server_health_url`
- `app_server_pid`
- `app_server_stdout_log`
- `app_server_stderr_log`
- `app_server_thread_id`
- `app_server_thread_path`
- `last_probe_at`
- `last_probe_result`
- `last_attach_at`
- `last_stop_at`
- `last_started_at`
- `last_start_result`
- `last_started_session_id`

## Task Runtime History

Required task-runtime history fields:

- `task_id`
- `event_count`
- `last_event_at`
- `last_event_kind`
- `last_session_id`

## Skills Registry Index

Required skills-registry index fields:

- `registry_id`
- `scope`
- `last_reviewed_at`

## Skill Source

Required skill-source fields:

- `source_id`
- `source_kind`
- `location`
- `upstream_url`
- `runtime_scope`
- `governance_status`
- `sync_strategy`

## Skill Record

Required skill-record fields:

- `skill_id`
- `source_id`
- `skill_path`
- `runtime_status`
- `availability_status`
- `enabled`
- `governance_status`
- `version_ref`

## Machine

Required machine fields:

- `machine_id`
- `host`
- `platform`
- `gpu_summary`
- `storage_summary`
- `root_paths`
- `status`

## Account

Required account fields:

- `account_id`
- `provider`
- `quota_notes`
- `is_default`
- `capabilities`
