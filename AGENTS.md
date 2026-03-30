# Codex Launch Home

This directory is the preferred starting point for new Codex sessions.

## Routing Rules

If the user asks for a remote-machine task or gives a remote Linux path under a known remote mount prefix, read:

- [guides/REMOTE_EXECUTION.md](E:/codex-home/guides/REMOTE_EXECUTION.md)

If the user asks for reproduction, optimization, or `RFvNext`, read:

- [docs/RFVNEXT.md](E:/codex-home/docs/RFVNEXT.md)

If the task needs the custom execution workflows, consult:

- [docs/SKILLS_OVERVIEW.md](E:/codex-home/docs/SKILLS_OVERVIEW.md)
- the mirrored skill docs under `skills/`

If the task is about the local control plane, task tracking, knowledge capture, account routing, or GUI-backed orchestration, read:

- [docs/workflow/CONTROL_PLANE.md](E:/codex-home/docs/workflow/CONTROL_PLANE.md)
- [docs/workflow/STATE_MACHINE.md](E:/codex-home/docs/workflow/STATE_MACHINE.md)
- [docs/workflow/SCHEMA.md](E:/codex-home/docs/workflow/SCHEMA.md)
- [docs/workflow/WORKFLOW_MAPPING.md](E:/codex-home/docs/workflow/WORKFLOW_MAPPING.md)

## Important Behavior

Starting from this directory does not mean the task itself lives here.
If the user points to another local repo or a remote project root, treat that as the real work target.

This directory is for launch-time guidance, not for forcing all tasks into one workspace.
