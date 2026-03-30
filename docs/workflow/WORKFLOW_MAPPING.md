# Workflow Mapping

This file records which external systems inform the local control plane.

## Current Source Map

- `obra/superpowers`
  - absorb: clarification, planning, parallel execution, verification
  - rewrite: strong software-TDD assumptions into evidence-first experiment flow
- `garrytan/gstack`
  - absorb: review, investigate, freeze, retro, operator-console thinking
  - rewrite: product-release workflow into research-task governance
- `lidangzzz/OnlySpecs`
  - absorb: spec versioning, multi-panel workspace ideas, spec/code pairing
  - rewrite: strict spec-only implementation into task-definition versioning
- `lidangzzz/goal-driven`
  - absorb: goal + success criteria + long-running control loop
  - rewrite: unchecked autonomy into decision gates, knowledge review, and evidence binding

## Local Modules

The control plane uses local names instead of upstream names:

- `clarify`
- `define-task`
- `plan-graph`
- `run-task`
- `review-stage`
- `record-decision`
- `record-experiment`
- `collect-findings`
- `audit-evidence`
- `review-knowledge`
- `archive-task`

## Future Intake Rule

When a new external skill or workflow looks useful, do not wire it straight into runtime behavior.

Capture it in this order:

1. source
2. layer it belongs to
3. ideas worth keeping
4. assumptions that do not fit this control plane
5. local module it should map to
6. status: `candidate`, `trial`, `adopted`, or `rejected`
