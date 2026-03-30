---
name: experiment-verifier
description: Use when code or configuration needs to be validated through smoke tests, eval runs, ablations, or metric checks. Produces evidence-bound status updates with commands, logs, results, failures, and next actions.
---

# Experiment Verifier

Use this skill whenever the main question is "does it really run and what is the evidence?"

## Goals

- Replace impressionistic progress with command-backed evidence.
- Record the exact command, result, and artifact path.
- Distinguish environment failure, runtime failure, metric outcome, and blocked external dependency.

## Workflow

1. Choose the smallest test that can answer the current question.
2. Run verification in layers:
   - import / config parse
   - smoke run
   - partial eval
   - full eval
3. For each run, capture:
   - command
   - exit status
   - key log lines
   - output path
   - metrics, if any
4. If a run fails, classify the blocker:
   - environment
   - code bug
   - data path
   - external resource
   - resource limit
5. Recommend only one next action, the one that most reduces uncertainty.

## Output Format

Return:

`Question Being Verified`

`Command`

`Evidence`

`Result`

`Blocker Classification`

`Next Action`

## Guardrails

- Never say a step is complete without command-backed evidence.
- Never give ETA from memory; base it on the latest observable state.
- If long jobs are still running, report what is known now instead of guessing the final outcome.
