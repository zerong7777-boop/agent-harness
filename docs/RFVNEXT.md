# Repro Factory vNext

## Trigger

When the user explicitly says `RFvNext` or `Repro Factory vNext`, prefer returning the task template first instead of starting execution immediately.

Template:

```text
Goal:
Success Criteria:
Constraints:
Allowed Search Space:
Deliverables:
```

## Execution Contract

After the input is clear, compile it internally into:

- task type
- success criteria
- constraints
- search space
- deliverables
- stop policy

## Default Policy

- conservative budget by default
- decision-point reporting instead of process spam
- three stop conditions:
  - achieved
  - budget exhausted
  - stagnated

## Deliverables

Every serious repro/optimization task should end with:

- result package
- verification evidence
- status / verify / next handoff docs
- troubleshooting and knowledge notes when relevant
