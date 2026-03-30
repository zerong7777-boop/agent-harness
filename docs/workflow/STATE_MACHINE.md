# Task State Machine

## Active Stages

Tasks move through one active stage at a time:

1. `clarification`
2. `planning`
3. `execution`
4. `verification`
5. `knowledge-review`

`clarification` and `planning` are split on purpose. The task does not formally start until the plan is confirmed.

## Terminal States

- `completed`: work reached the success bar and you confirmed completion
- `archived`: the task is stored for later recall, possibly after completion
- `cancelled`: the task was intentionally stopped

`completed` and `archived` are not the same state. A completed task can later be archived.

## Overlay Flags

These do not replace the active stage:

- `paused`: intentionally parked
- `blocked`: cannot move because of an external dependency

Allowed blocker kinds:

- `waiting-user-decision`
- `waiting-remote-resource`
- `waiting-experiment`
- `waiting-external-info`

## Reopen Rule

- Archived tasks may reopen into a new phase.
- Reopening returns the task to an active stage.
- A reopened task adds a new phase instead of rewriting history.

## Parent And Child Rules

- A plan node may stay lightweight or be promoted into a child task.
- Promote to a child task when it needs independent decisions, independent experiment records, cross-account execution, or likely spans more than one phase.
- Child tasks inherit parent context and resources by default, but keep their own plans, decisions, experiments, and findings.
- Cross-cutting decisions live on the parent task and backlink to children.
- A parent task can complete once its key child tasks are completed, cancelled, or explicitly abandoned with a recorded decision.
