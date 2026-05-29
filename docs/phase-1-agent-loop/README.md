# Phase 1 Agent PR Loop Kit

This kit turns the agent loop into a manual GitHub-native operating protocol:

Issue spec -> Codex draft PR -> CI -> Claude verification -> bounded revision loop -> human merge.

Phase 1 is intentionally manual. The goal is to prove that issue specs, evidence, and verifier feedback converge before adding automation.

## Included artifacts

- `.github/ISSUE_TEMPLATE/agent-ready.yml` - structured issue template for agent-ready specs.
- `.github/pull_request_template.md` - generator PR contract.
- `.github/labels.yml` - label set for routing and state.
- `docs/phase-1-agent-loop/labels-and-transitions.md` - label meanings and state transitions.
- `docs/phase-1-agent-loop/verifier-review.md` - Claude verifier checklist and comment format.
- `docs/phase-1-agent-loop/runbook.md` - manual operating procedure for Phase 1.

## Operating principle

Agents can do broad trial work, including larger features, but only inside a bounded loop:

- The issue must be specific enough to verify.
- Evidence is required. Tests are preferred; manual rubrics are allowed when tests are not practical.
- Every verifier change request must cite the spec, CI, a test gap, or a concrete codebase concern.
- Three review rounds is the maximum before human adjudication.
- Sensitive surfaces trigger `hard-stop` immediately.

