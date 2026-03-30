---
name: memory-and-handoff
description: Use when a project needs durable progress records, handoff notes, or reproducibility summaries. Updates project memory into compact status, verification, and next-step notes that another agent or future session can resume from quickly.
---

# Memory And Handoff

Use this skill to turn project work into durable records.

## Goals

- Leave the project resumable by another agent or by your future self.
- Compress long execution history into high-signal notes.
- Preserve result paths, commands, decisions, and next actions.

## Workflow

1. Read the latest artifacts first:
   - status notes
   - logs
   - result files
   - milestone docs
2. Write only the minimum durable documents needed:
   - status
   - verification
   - next-step handoff
3. Separate facts from recommendations.
4. Prefer stable references:
   - file paths
   - config names
   - command lines
   - metric values
5. End with one recommended next move, not a large wish list.

## Default Document Shapes

`STATUS.md`
- current state
- what is done
- what is missing

`VERIFY.md`
- exact commands or artifact paths
- metrics
- evidence-backed conclusion

`NEXT.md`
- recommended next step
- why it is next
- what should not be changed yet

## Guardrails

- Do not write vague retrospectives.
- Do not claim reproducibility without concrete command or artifact paths.
- Keep handoff short enough that a new agent can read it in minutes.
