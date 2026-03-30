# Tasks

`tasks/` stores the source records for long-lived work.

Each task is a first-class object in the control plane.

## Rules

- One directory per task id.
- Use `YYYYMMDD-short-name` ids.
- Keep the main task state in `task.md`.
- Keep the approved plan in `plan.md`.
- Open a new phase instead of rewriting prior history.
- Promote a plan node into a child task when it needs independent tracking.

## Templates

Start from `tasks/_templates/task/`.
